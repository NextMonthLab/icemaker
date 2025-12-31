import Stripe from 'stripe';
import { getStripeSync, getUncachableStripeClient, getWebhookSecret } from './stripeClient';
import { storage } from './storage';
import type { Plan, PlanFeatures } from '@shared/schema';

const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const webhookSecret = getWebhookSecret();
    let event: Stripe.Event;

    if (webhookSecret) {
      const stripe = await getUncachableStripeClient();
      try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch (err: any) {
        console.error('[webhook] Signature verification failed:', err.message);
        throw new Error('Webhook signature verification failed');
      }
    } else {
      console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set - using stripe-replit-sync for verification');
      const sync = await getStripeSync();
      await sync.processWebhook(payload, signature);
      event = JSON.parse(payload.toString());
    }

    if (WebhookHandlers.isDuplicateEvent(event.id)) {
      console.log(`[webhook] Ignoring duplicate event: ${event.id}`);
      return;
    }

    WebhookHandlers.markEventProcessed(event.id);

    try {
      await WebhookHandlers.handleEvent(event);
    } catch (error) {
      console.error('[webhook] Error handling event:', error);
    }
  }

  static isDuplicateEvent(eventId: string): boolean {
    return processedEventIds.has(eventId);
  }

  static markEventProcessed(eventId: string): void {
    if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
      const firstKey = processedEventIds.values().next().value;
      if (firstKey) processedEventIds.delete(firstKey);
    }
    processedEventIds.add(eventId);
  }
  
  static async handleEvent(event: any): Promise<void> {
    const eventType = event.type;
    const data = event.data?.object;
    
    if (!data) return;

    console.log(`[webhook] Processing event: ${eventType} (${event.id})`);
    
    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await WebhookHandlers.handleSubscriptionUpdate(data);
        break;
        
      case 'customer.subscription.deleted':
        await WebhookHandlers.handleSubscriptionCancellation(data);
        break;
        
      case 'checkout.session.completed':
        await WebhookHandlers.handleCheckoutCompleted(data);
        break;
        
      case 'invoice.payment_succeeded':
        console.log(`[webhook] Invoice payment succeeded: ${data.id}`);
        break;
        
      case 'invoice.payment_failed':
        await WebhookHandlers.handlePaymentFailed(data);
        break;
        
      default:
        break;
    }
  }
  
  static async handleSubscriptionUpdate(stripeSubscription: any): Promise<void> {
    const stripeSubscriptionId = stripeSubscription.id;
    const stripeCustomerId = stripeSubscription.customer;
    const status = stripeSubscription.status;
    const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
    
    if (!priceId) {
      console.log(`[webhook] No price ID found for subscription ${stripeSubscriptionId}`);
      return;
    }
    
    const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    
    await WebhookHandlers.handleSubscriptionChange(
      stripeCustomerId,
      stripeSubscriptionId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      priceId
    );
  }
  
  static async handleSubscriptionCancellation(stripeSubscription: any): Promise<void> {
    const stripeSubscriptionId = stripeSubscription.id;
    const subscription = await storage.getSubscriptionByStripeId(stripeSubscriptionId);
    
    if (!subscription) {
      console.log(`[webhook] No subscription found for canceled Stripe ID: ${stripeSubscriptionId}`);
      return;
    }
    
    await storage.updateSubscription(subscription.id, {
      status: 'canceled',
    });
    
    const freePlan = await storage.getPlanByName('free');
    if (freePlan) {
      await WebhookHandlers.recomputeEntitlements(subscription.userId, freePlan);
    }
    
    await WebhookHandlers.autoPauseExcessIces(subscription.userId, 0);
    
    console.log(`[webhook] Subscription ${subscription.id} canceled for user ${subscription.userId}`);
  }
  
  static async handlePaymentFailed(invoice: any): Promise<void> {
    const stripeSubscriptionId = invoice.subscription;
    if (!stripeSubscriptionId) return;
    
    const subscription = await storage.getSubscriptionByStripeId(stripeSubscriptionId);
    if (!subscription) return;
    
    await storage.updateSubscription(subscription.id, {
      status: 'past_due',
    });
    
    console.log(`[webhook] Payment failed for subscription ${subscription.id}, user ${subscription.userId}`);
  }
  
  static async handleCheckoutCompleted(session: any): Promise<void> {
    const checkoutSessionId = session.id;
    const idempotencyKey = session.metadata?.idempotencyKey;
    const paymentIntentId = session.payment_intent;
    const amountTotal = session.amount_total; // in cents
    
    console.log(`[webhook] Checkout session completed: ${checkoutSessionId}, payment_intent: ${paymentIntentId}, amount: ${amountTotal}`);
    
    if (idempotencyKey) {
      const transaction = await storage.getCheckoutTransactionByKey(idempotencyKey);
      if (transaction) {
        // CRITICAL: Verify amount matches what we stored - REJECT if mismatched
        // This prevents attackers from manipulating Stripe sessions to pay less
        if (transaction.amountCents && amountTotal && transaction.amountCents !== amountTotal) {
          console.error(`[webhook] SECURITY ALERT: Amount mismatch for transaction ${transaction.id}! Expected: ${transaction.amountCents}, Stripe charged: ${amountTotal}. BLOCKING entitlements.`);
          await storage.updateCheckoutTransaction(transaction.id, {
            status: 'failed' as any, // Mark as failed, not completed
            stripePaymentIntentId: paymentIntentId || null,
          });
          // NOTE: Do NOT proceed with entitlements - payment was tampered
          // Admin should investigate and potentially refund if needed
          return;
        }
        
        await storage.updateCheckoutTransaction(transaction.id, {
          status: 'completed',
          completedAt: new Date(),
          stripePaymentIntentId: paymentIntentId || null,
        });
        console.log(`[webhook] Marked checkout transaction ${transaction.id} as completed with payment_intent: ${paymentIntentId}`);
      }
    } else {
      // No idempotency key in metadata - legacy checkout or direct Stripe session
      console.log(`[webhook] Checkout completed without idempotency key: ${checkoutSessionId}`);
    }
  }

  static async handleSubscriptionChange(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    priceId: string
  ): Promise<void> {
    const subscription = await storage.getSubscriptionByStripeId(stripeSubscriptionId);
    if (!subscription) {
      console.log(`[webhook] No subscription found for Stripe ID: ${stripeSubscriptionId}`);
      return;
    }

    const plan = await storage.getPlanByStripePriceId(priceId);
    if (!plan) {
      console.log(`[webhook] No plan found for price ID: ${priceId}`);
      return;
    }

    const oldPlanId = subscription.planId;
    const lastCreditGrant = subscription.lastCreditGrantPeriodEnd;

    await storage.updateSubscription(subscription.id, {
      status: status as any,
      planId: plan.id,
      currentPeriodStart,
      currentPeriodEnd,
    });

    await WebhookHandlers.recomputeEntitlements(subscription.userId, plan);

    if (status === 'active' && plan.features) {
      const features = plan.features as PlanFeatures;
      const hasCredits = (features.monthlyVideoCredits || 0) > 0 || (features.monthlyVoiceCredits || 0) > 0;
      
      const alreadyGranted = lastCreditGrant && 
        currentPeriodEnd.getTime() <= lastCreditGrant.getTime();
      
      if (hasCredits && !alreadyGranted) {
        await storage.grantMonthlyCredits(
          subscription.userId,
          features.monthlyVideoCredits || 0,
          features.monthlyVoiceCredits || 0
        );
        await storage.updateSubscription(subscription.id, {
          lastCreditGrantPeriodEnd: currentPeriodEnd,
        });
        console.log(`[webhook] Granted monthly credits for user ${subscription.userId} (period: ${currentPeriodEnd.toISOString()})`);
      }
    }

    if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
      await WebhookHandlers.autoPauseExcessIces(subscription.userId, 0);
    } else if (oldPlanId !== plan.id) {
      const newLimit = WebhookHandlers.getActiveIceLimit(plan.name);
      await WebhookHandlers.autoPauseExcessIces(subscription.userId, newLimit);
    }
  }

  static getActiveIceLimit(planName: string): number {
    const normalizedName = planName.toLowerCase();
    if (normalizedName.includes('business') || normalizedName.includes('intelligence')) return 10;
    if (normalizedName.includes('pro') || normalizedName.includes('understand')) return 3;
    if (normalizedName.includes('grow')) return 1;
    return 0;
  }

  static async autoPauseExcessIces(userId: number, limit: number): Promise<void> {
    try {
      const allUniverses = await storage.getUniversesByCreator(userId);
      const activeUniverses = allUniverses.filter(u => u.iceStatus === 'active');
      
      if (limit === -1 || activeUniverses.length <= limit) {
        return;
      }
      
      const excessCount = activeUniverses.length - limit;
      const toRemove = activeUniverses.slice(-excessCount);
      
      for (const universe of toRemove) {
        await storage.updateUniverse(universe.id, { iceStatus: 'paused', pausedAt: new Date() });
        console.log(`[webhook] Auto-paused ICE ${universe.id} for user ${userId} (limit: ${limit})`);
      }
    } catch (error) {
      console.error(`[webhook] Error auto-pausing ICEs for user ${userId}:`, error);
    }
  }

  static async recomputeEntitlements(userId: number, plan: Plan): Promise<void> {
    const features = plan.features as PlanFeatures | null;
    
    await storage.upsertEntitlements(userId, {
      canUseCloudLlm: features?.canUseCloudLlm || false,
      canGenerateImages: features?.canGenerateImages || false,
      canExport: features?.canExport || false,
      canUseCharacterChat: features?.canUseCharacterChat || false,
      maxCardsPerStory: features?.maxCardsPerStory || 5,
      storageDays: features?.storageDays || 7,
      collaborationRoles: features?.collaborationRoles || false,
    });
    
    console.log(`[webhook] Updated entitlements for user ${userId} to plan ${plan.name}`);
  }
}
