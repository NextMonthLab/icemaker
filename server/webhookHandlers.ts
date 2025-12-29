import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import type { Plan, PlanFeatures } from '@shared/schema';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
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
      console.log(`No subscription found for Stripe ID: ${stripeSubscriptionId}`);
      return;
    }

    const plan = await storage.getPlanByStripePriceId(priceId);
    if (!plan) {
      console.log(`No plan found for price ID: ${priceId}`);
      return;
    }

    const oldPlanId = subscription.planId;

    await storage.updateSubscription(subscription.id, {
      status: status as any,
      planId: plan.id,
      currentPeriodStart,
      currentPeriodEnd,
    });

    await WebhookHandlers.recomputeEntitlements(subscription.userId, plan);

    if (status === 'active' && plan.features) {
      const features = plan.features as PlanFeatures;
      if (features.monthlyVideoCredits > 0 || features.monthlyVoiceCredits > 0) {
        await storage.grantMonthlyCredits(
          subscription.userId,
          features.monthlyVideoCredits || 0,
          features.monthlyVoiceCredits || 0
        );
      }
    }

    // Handle auto-pause on downgrade or cancellation
    if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
      await WebhookHandlers.autoPauseExcessIces(subscription.userId, 0);
    } else if (oldPlanId !== plan.id) {
      // Plan changed - check if downgrade
      const newLimit = WebhookHandlers.getActiveIceLimit(plan.name);
      await WebhookHandlers.autoPauseExcessIces(subscription.userId, newLimit);
    }
  }

  static getActiveIceLimit(planName: string): number {
    const normalizedName = planName.toLowerCase();
    if (normalizedName.includes('business') || normalizedName.includes('intelligence')) return 10;
    if (normalizedName.includes('pro') || normalizedName.includes('grow') || normalizedName.includes('understand')) return 3;
    return 0; // Free tier
  }

  static async autoPauseExcessIces(userId: number, limit: number): Promise<void> {
    if (limit === -1) return; // Unlimited
    
    try {
      const icesToPause = await storage.getIcesToPauseOnDowngrade(userId, limit);
      for (const ice of icesToPause) {
        await storage.pauseIce(ice.id);
        console.log(`Auto-paused ICE ${ice.id} (${ice.name}) for user ${userId} due to plan limit`);
      }
      if (icesToPause.length > 0) {
        console.log(`Auto-paused ${icesToPause.length} ICEs for user ${userId} (new limit: ${limit})`);
      }
    } catch (error) {
      console.error(`Error auto-pausing ICEs for user ${userId}:`, error);
    }
  }

  static async recomputeEntitlements(userId: number, plan: Plan): Promise<void> {
    const features = (plan.features as PlanFeatures) || {};
    
    await storage.upsertEntitlements(userId, {
      canUseCloudLlm: features.canUseCloudLlm || false,
      canGenerateImages: features.canGenerateImages || false,
      canExport: features.canExport || false,
      canUseCharacterChat: features.canUseCharacterChat || false,
      maxCardsPerStory: features.maxCardsPerStory || 5,
      storageDays: features.storageDays || 7,
      collaborationRoles: features.collaborationRoles || false,
    });
  }
}
