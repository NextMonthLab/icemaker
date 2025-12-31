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
    
    const oldStatus = subscription.status;
    
    await storage.updateSubscription(subscription.id, {
      status: 'canceled',
    });
    
    // Log cancellation
    await storage.createBillingAuditLog({
      userId: subscription.userId,
      eventType: 'subscription_status_changed',
      subscriptionId: stripeSubscriptionId,
      statusBefore: oldStatus,
      statusAfter: 'canceled',
      metadata: { reason: 'subscription_deleted' },
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
    
    const oldStatus = subscription.status;
    
    await storage.updateSubscription(subscription.id, {
      status: 'past_due',
    });
    
    // Log payment failure status change
    await storage.createBillingAuditLog({
      userId: subscription.userId,
      eventType: 'subscription_status_changed',
      subscriptionId: stripeSubscriptionId,
      statusBefore: oldStatus,
      statusAfter: 'past_due',
      metadata: { reason: 'invoice_payment_failed', invoiceId: invoice.id },
    });
    
    console.log(`[webhook] Payment failed for subscription ${subscription.id}, user ${subscription.userId}`);
  }
  
  static async handleCheckoutCompleted(session: any): Promise<void> {
    const checkoutSessionId = session.id;
    const idempotencyKey = session.metadata?.idempotencyKey;
    const paymentIntentId = session.payment_intent;
    const amountTotal = session.amount_total; // in cents
    const totalDiscount = session.total_details?.amount_discount || 0;
    const hasDiscount = totalDiscount > 0;
    
    console.log(`[webhook] Checkout session completed: ${checkoutSessionId}, payment_intent: ${paymentIntentId}, amount: ${amountTotal}, discount: ${totalDiscount}`);
    
    if (idempotencyKey) {
      const transaction = await storage.getCheckoutTransactionByKey(idempotencyKey);
      if (transaction) {
        // Validate amount - but allow Stripe-applied discounts
        // Stripe is the source of truth for discount calculations
        if (transaction.amountCents && amountTotal !== undefined) {
          const expectedAfterDiscount = transaction.amountCents - totalDiscount;
          
          if (!hasDiscount && transaction.amountCents !== amountTotal) {
            // No discount applied but amounts don't match - suspicious
            console.error(`[webhook] SECURITY ALERT: Amount mismatch for transaction ${transaction.id}! Expected: ${transaction.amountCents}, Stripe charged: ${amountTotal}. No discount applied. BLOCKING entitlements.`);
            await storage.updateCheckoutTransaction(transaction.id, {
              status: 'failed' as any,
              stripePaymentIntentId: paymentIntentId || null,
            });
            // Log rejected payment
            await storage.createBillingAuditLog({
              userId: transaction.userId || undefined,
              eventType: 'payment_rejected_amount_mismatch',
              checkoutSessionId,
              paymentIntentId: paymentIntentId || undefined,
              expectedAmountCents: transaction.amountCents || undefined,
              stripeAmountCents: amountTotal,
              metadata: { reason: 'no_discount_but_amount_mismatch' },
            });
            return;
          }
          
          if (hasDiscount && amountTotal > transaction.amountCents) {
            // With a discount, amount should be less than or equal to original
            console.error(`[webhook] SECURITY ALERT: Amount exceeds expected for transaction ${transaction.id}! Expected max: ${transaction.amountCents}, Stripe charged: ${amountTotal}. BLOCKING entitlements.`);
            await storage.updateCheckoutTransaction(transaction.id, {
              status: 'failed' as any,
              stripePaymentIntentId: paymentIntentId || null,
            });
            // Log rejected payment
            await storage.createBillingAuditLog({
              userId: transaction.userId || undefined,
              eventType: 'payment_rejected_amount_mismatch',
              checkoutSessionId,
              paymentIntentId: paymentIntentId || undefined,
              expectedAmountCents: transaction.amountCents || undefined,
              stripeAmountCents: amountTotal,
              discountAmountCents: totalDiscount,
              metadata: { reason: 'discount_but_amount_exceeds_expected' },
            });
            return;
          }
          
          if (hasDiscount) {
            console.log(`[webhook] Discount applied: original ${transaction.amountCents}, discount ${totalDiscount}, charged ${amountTotal}`);
          }
        }
        
        await storage.updateCheckoutTransaction(transaction.id, {
          status: 'completed',
          completedAt: new Date(),
          stripePaymentIntentId: paymentIntentId || null,
        });
        // Log successful payment verification
        await storage.createBillingAuditLog({
          userId: transaction.userId || undefined,
          eventType: 'payment_verified',
          checkoutSessionId,
          paymentIntentId: paymentIntentId || undefined,
          priceId: transaction.priceId || undefined,
          expectedAmountCents: transaction.amountCents || undefined,
          stripeAmountCents: amountTotal,
          discountAmountCents: totalDiscount || undefined,
        });
        console.log(`[webhook] Marked checkout transaction ${transaction.id} as completed with payment_intent: ${paymentIntentId}`);
      }
    } else {
      // No idempotency key in metadata - legacy checkout or direct Stripe session
      console.log(`[webhook] Checkout completed without idempotency key: ${checkoutSessionId}`);
    }
  }

  static normalizeStripeStatus(stripeStatus: string): 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused' {
    switch (stripeStatus) {
      case 'active':
        return 'active';
      case 'trialing':
        return 'trialing';
      case 'canceled':
        return 'canceled';
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
        return 'past_due';
      case 'paused':
        return 'paused';
      default:
        console.warn(`[webhook] Unknown Stripe status "${stripeStatus}", treating as past_due`);
        return 'past_due';
    }
  }

  static isInactiveStatus(status: string): boolean {
    return status === 'canceled' || status === 'past_due' || status === 'paused' || 
           status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired';
  }

  static async handleSubscriptionChange(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    stripeStatus: string,
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

    const normalizedStatus = WebhookHandlers.normalizeStripeStatus(stripeStatus);
    const oldPlanId = subscription.planId;
    const oldStatus = subscription.status;
    const lastCreditGrant = subscription.lastCreditGrantPeriodEnd;

    await storage.updateSubscription(subscription.id, {
      status: normalizedStatus,
      planId: plan.id,
      currentPeriodStart,
      currentPeriodEnd,
    });

    // Log subscription status change
    if (oldStatus !== normalizedStatus) {
      await storage.createBillingAuditLog({
        userId: subscription.userId,
        eventType: 'subscription_status_changed',
        subscriptionId: stripeSubscriptionId,
        priceId,
        statusBefore: oldStatus,
        statusAfter: normalizedStatus,
        metadata: { oldPlanId, newPlanId: plan.id },
      });
    }

    await WebhookHandlers.recomputeEntitlements(subscription.userId, plan);

    if (normalizedStatus === 'active' && plan.features) {
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

    const wasInactive = WebhookHandlers.isInactiveStatus(oldStatus);
    const isNowActive = normalizedStatus === 'active';
    
    if (WebhookHandlers.isInactiveStatus(stripeStatus)) {
      await WebhookHandlers.autoPauseExcessIces(subscription.userId, 0);
    } else if (wasInactive && isNowActive) {
      const newLimit = WebhookHandlers.getActiveIceLimit(plan.name);
      await WebhookHandlers.autoRestorePausedIces(subscription.userId, newLimit);
      console.log(`[webhook] Subscription reactivated for user ${subscription.userId}, restored ICEs up to limit ${newLimit}`);
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
        await storage.createBillingAuditLog({
          userId,
          eventType: 'ice_paused_due_to_subscription',
          metadata: { universeId: universe.id, reason: 'exceeded_plan_limit', limit },
        });
        console.log(`[webhook] Auto-paused ICE ${universe.id} for user ${userId} (limit: ${limit})`);
      }
    } catch (error) {
      console.error(`[webhook] Error auto-pausing ICEs for user ${userId}:`, error);
    }
  }

  static async autoRestorePausedIces(userId: number, limit: number): Promise<void> {
    try {
      const allUniverses = await storage.getUniversesByCreator(userId);
      const pausedUniverses = allUniverses
        .filter(u => u.iceStatus === 'paused')
        .sort((a, b) => {
          const aTime = a.pausedAt ? new Date(a.pausedAt).getTime() : 0;
          const bTime = b.pausedAt ? new Date(b.pausedAt).getTime() : 0;
          return bTime - aTime;
        });
      const activeCount = allUniverses.filter(u => u.iceStatus === 'active').length;
      
      if (limit === -1) {
        for (const universe of pausedUniverses) {
          await storage.updateUniverse(universe.id, { iceStatus: 'active', pausedAt: null });
          console.log(`[webhook] Restored ICE ${universe.id} for user ${userId}`);
        }
        return;
      }
      
      const slotsAvailable = Math.max(0, limit - activeCount);
      const toRestore = pausedUniverses.slice(0, slotsAvailable);
      
      for (const universe of toRestore) {
        await storage.updateUniverse(universe.id, { iceStatus: 'active', pausedAt: null });
        await storage.createBillingAuditLog({
          userId,
          eventType: 'ice_restored',
          metadata: { universeId: universe.id, limit },
        });
        console.log(`[webhook] Restored ICE ${universe.id} for user ${userId} (limit: ${limit})`);
      }
    } catch (error) {
      console.error(`[webhook] Error restoring ICEs for user ${userId}:`, error);
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
