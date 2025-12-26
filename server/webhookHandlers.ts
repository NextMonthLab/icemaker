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
