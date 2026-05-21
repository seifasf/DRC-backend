/**
 * Applies DRC catalog pricing (tiers / components / simple) to tests by name.
 * Safe to re-run: uses $set on matched documents.
 *
 * Run: npm run seed:test-pricing
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Test = require('../models/Test.model');

const patches = [
  {
    name: 'Chewing simulator',
    pricePerUnit: 0,
    unitLabel: 'package',
    pricingTiers: [
      { code: 'chw_10k', label: '10,000 cycles — price per package (4 samples)', cycles: 10000, packageSamples: 4, price: 600 },
      { code: 'chw_60k', label: '60,000 cycles — price per package (4 samples)', cycles: 60000, packageSamples: 4, price: 3000 },
      { code: 'chw_125k', label: '125,000 cycles — price per package (4 samples)', cycles: 125000, packageSamples: 4, price: 6000 },
      { code: 'chw_250k', label: '250,000 cycles — price per package (4 samples)', cycles: 250000, packageSamples: 4, price: 10000 },
      { code: 'chw_500k', label: '500,000 cycles — price per package (4 samples)', cycles: 500000, packageSamples: 4, price: 17000 },
      { code: 'chw_1m', label: '1,000,000 cycles — price per package (4 samples)', cycles: 1000000, packageSamples: 4, price: 30000 },
      { code: 'chw_2m', label: '2,000,000 cycles — price per package (4 samples)', cycles: 2000000, packageSamples: 4, price: 45000 },
    ],
    pricingComponents: [],
  },
  {
    name: 'Micro-tensile test',
    pricePerUnit: 0,
    unitLabel: 'billable unit',
    pricingTiers: [],
    pricingComponents: [
      { code: 'cutting_sample', label: 'Cutting (per sample, any number of beams obtained)', pricePerUnit: 350, billUnitLabel: 'sample' },
      { code: 'microtensile_beam', label: 'Micro-tensile test (per beam)', pricePerUnit: 40, billUnitLabel: 'beam' },
    ],
  },
  {
    name: 'Mode of failure',
    pricePerUnit: 100,
    unitLabel: 'beam',
    pricingTiers: [],
    pricingComponents: [],
    allowOrderUnitPriceOverride: true,
  },
  {
    name: 'EDX',
    pricePerUnit: 300,
    unitLabel: 'sample',
    pricingTiers: [],
    pricingComponents: [],
    allowOrderUnitPriceOverride: true,
  },
  {
    name: 'Thermocycling',
    pricePerUnit: 0,
    unitLabel: 'package',
    pricingTiers: [
      { code: 'th_500', label: '500 cycles — package price', cycles: 500, price: 1500 },
      { code: 'th_1000', label: '1,000 cycles — package price', cycles: 1000, price: 2500 },
      { code: 'th_1500', label: '1,500 cycles — package price', cycles: 1500, price: 3000 },
      { code: 'th_2000', label: '2,000 cycles — package price', cycles: 2000, price: 3500 },
      { code: 'th_5000', label: '5,000 cycles — package price', cycles: 5000, price: 6500 },
      { code: 'th_10000', label: '10,000 cycles — package price', cycles: 10000, price: 12500 },
    ],
    pricingComponents: [],
  },
  {
    name: 'Microhardness test',
    pricePerUnit: 200,
    unitLabel: 'sample',
    pricingTiers: [],
    pricingComponents: [],
  },
  {
    name: 'Roughness test',
    pricePerUnit: 200,
    unitLabel: 'sample',
    pricingTiers: [],
    pricingComponents: [],
  },
  { name: 'Shear test', pricePerUnit: 200, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  { name: 'Tensile test', pricePerUnit: 200, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  { name: 'Flexural test', pricePerUnit: 200, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  { name: 'Compressive test', pricePerUnit: 200, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  { name: 'Pull-out test (UTM)', pricePerUnit: 200, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  { name: 'Retention test', pricePerUnit: 200, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  {
    name: 'Fracture resistance test',
    pricePerUnit: 200,
    unitLabel: 'sample',
    pricingTiers: [],
    pricingComponents: [],
  },
  { name: 'Micro-shear test', pricePerUnit: 100, unitLabel: 'sample', pricingTiers: [], pricingComponents: [] },
  {
    name: 'Push out test',
    pricePerUnit: 0,
    unitLabel: 'sample',
    pricingTiers: [],
    pricingComponents: [],
    description:
      'Push-out bond strength evaluation for posts, cores, or adhesive luting interfaces. Pricing TBD — update when finalized.',
  },
  {
    name: 'Marginal adaptation',
    pricePerUnit: 150,
    unitLabel: 'surface',
    pricingTiers: [],
    pricingComponents: [],
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected:', mongoose.connection.name);

  let updated = 0;
  let missing = 0;

  for (const p of patches) {
    const { name, ...setFields } = p;
    const res = await Test.updateOne({ name }, { $set: setFields });
    if (res.matchedCount === 0) {
      console.warn(`No test matched name: "${name}"`);
      missing += 1;
    } else {
      updated += 1;
      console.log(`Updated pricing: ${name}`);
    }
  }

  await Test.updateOne(
    { name: 'Universal testing machine' },
    {
      $set: {
        isAvailable: false,
        pricePerUnit: 0,
        pricingTiers: [],
        pricingComponents: [],
      },
    }
  );

  console.log(`Done. Matched & updated: ${updated}. Not found: ${missing}.`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
