/**
 * Stripe Products Seed Script
 * 
 * This script creates subscription products and prices in Stripe,
 * then updates the local plans table with the Stripe price IDs.
 * 
 * Run with: npx tsx scripts/seed-stripe-products.ts
 */

import { getUncachableStripeClient } from '../server/stripeClient';
import { db } from '../server/storage';
import { plans } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface PlanConfig {
  name: string;
  displayName: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  metadata: Record<string, string>;
}

const PLAN_CONFIGS: PlanConfig[] = [
  {
    name: 'pro',
    displayName: 'NextMonth Pro',
    description: 'Create up to 3 active ICE experiences with AI-powered story generation, character chat, and more.',
    monthlyPriceCents: 1900,
    yearlyPriceCents: 19000,
    metadata: {
      tier: 'pro',
      activeIceLimit: '3',
      features: 'cloud_llm,images,export,character_chat',
    },
  },
  {
    name: 'business',
    displayName: 'NextMonth Business',
    description: 'Create up to 10 active ICE experiences with video credits, voice credits, team collaboration, and priority support.',
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    metadata: {
      tier: 'business',
      activeIceLimit: '10',
      features: 'cloud_llm,images,export,character_chat,video,voice,collaboration',
    },
  },
];

async function seedStripeProducts() {
  console.log('🚀 Starting Stripe products seed...\n');

  const stripe = await getUncachableStripeClient();

  for (const config of PLAN_CONFIGS) {
    console.log(`\n📦 Processing ${config.displayName}...`);

    // Check if product already exists
    const existingProducts = await stripe.products.search({
      query: `name:'${config.displayName}'`,
    });

    let product;
    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`  ✅ Product exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: config.displayName,
        description: config.description,
        metadata: config.metadata,
      });
      console.log(`  ✨ Created product: ${product.id}`);
    }

    // Create or find monthly price
    let monthlyPrice;
    const existingMonthlyPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    const existingMonthly = existingMonthlyPrices.data.find(
      (p) => p.recurring?.interval === 'month' && p.unit_amount === config.monthlyPriceCents
    );

    if (existingMonthly) {
      monthlyPrice = existingMonthly;
      console.log(`  ✅ Monthly price exists: ${monthlyPrice.id}`);
    } else {
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: config.monthlyPriceCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan: config.name, billing: 'monthly' },
      });
      console.log(`  ✨ Created monthly price: ${monthlyPrice.id} ($${(config.monthlyPriceCents / 100).toFixed(2)}/mo)`);
    }

    // Create or find yearly price
    let yearlyPrice;
    const existingYearly = existingMonthlyPrices.data.find(
      (p) => p.recurring?.interval === 'year' && p.unit_amount === config.yearlyPriceCents
    );

    if (existingYearly) {
      yearlyPrice = existingYearly;
      console.log(`  ✅ Yearly price exists: ${yearlyPrice.id}`);
    } else {
      yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: config.yearlyPriceCents,
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { plan: config.name, billing: 'yearly' },
      });
      console.log(`  ✨ Created yearly price: ${yearlyPrice.id} ($${(config.yearlyPriceCents / 100).toFixed(2)}/yr)`);
    }

    // Update local plans table with Stripe price IDs
    console.log(`  📝 Updating local plans table...`);
    await db
      .update(plans)
      .set({
        stripePriceIdMonthly: monthlyPrice.id,
        stripePriceIdYearly: yearlyPrice.id,
      })
      .where(eq(plans.name, config.name));
    console.log(`  ✅ Updated plan '${config.name}' with price IDs`);
  }

  console.log('\n✅ Stripe products seed complete!\n');

  // Verify by listing all plans
  const allPlans = await db.select().from(plans);
  console.log('Current plans in database:');
  console.table(
    allPlans.map((p) => ({
      name: p.name,
      monthlyPrice: `$${(p.monthlyPrice / 100).toFixed(2)}`,
      stripePriceIdMonthly: p.stripePriceIdMonthly || '(none)',
      stripePriceIdYearly: p.stripePriceIdYearly || '(none)',
    }))
  );
}

seedStripeProducts().catch((error) => {
  console.error('❌ Seed error:', error);
  process.exit(1);
});
