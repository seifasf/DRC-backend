/**
 * Seeds the catalog tests for DRC Lab (idempotent by test name).
 * Inserts base rows only on first insert ($setOnInsert). Run `npm run seed:test-pricing`
 * after seeding to apply pricing on existing databases.
 * Run: npm run seed:tests
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Test = require('../models/Test.model');

const catalog = [
  {
    name: 'Chewing simulator',
    category: 'Mechanical simulation',
    description:
      'Accelerated chewing fatigue simulation. Prices are per package (4 samples); choose a cycle tier when ordering.',
    machine: 'Chewing simulator',
    unitLabel: 'package',
    pricePerUnit: 0,
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
    estimatedDaysPerUnit: 2,
  },
  {
    name: 'Micro-tensile test',
    category: 'Mechanical',
    description: 'Cutting, micro-tensile beams, and failure-mode beams billed separately.',
    machine: 'Micro-tensile rig',
    unitLabel: 'billable unit',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'cutting_sample', label: 'Cutting (per sample, any number of beams obtained)', pricePerUnit: 350, billUnitLabel: 'sample' },
      { code: 'microtensile_beam', label: 'Micro-tensile test (per beam)', pricePerUnit: 40, billUnitLabel: 'beam' },
      { code: 'failure_mode_beam', label: 'Failure mode (per beam)', pricePerUnit: 50, billUnitLabel: 'beam' },
    ],
    estimatedDaysPerUnit: 3,
  },
  {
    name: 'Thermocycling',
    category: 'Thermal aging',
    description: 'Thermal cycling — select a cycle package tier.',
    machine: 'Thermocycling chamber',
    unitLabel: 'package',
    pricePerUnit: 0,
    pricingTiers: [
      { code: 'th_500', label: '500 cycles — package price', cycles: 500, price: 1500 },
      { code: 'th_1000', label: '1,000 cycles — package price', cycles: 1000, price: 2500 },
      { code: 'th_1500', label: '1,500 cycles — package price', cycles: 1500, price: 3000 },
      { code: 'th_2000', label: '2,000 cycles — package price', cycles: 2000, price: 3500 },
      { code: 'th_5000', label: '5,000 cycles — package price', cycles: 5000, price: 6500 },
      { code: 'th_10000', label: '10,000 cycles — package price', cycles: 10000, price: 12500 },
    ],
    pricingComponents: [],
    estimatedDaysPerUnit: 1,
  },
  {
    name: 'Microhardness test',
    category: 'Surface analysis',
    description: 'Indentation hardness mapping (e.g. Vickers/Knoop).',
    machine: 'Microhardness tester',
    unitLabel: 'sample',
    pricePerUnit: 200,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 1,
  },
  {
    name: 'Roughness test',
    category: 'Surface analysis',
    description: 'Surface roughness profiling (Ra/Rz).',
    machine: 'Profilometer',
    unitLabel: 'sample',
    pricePerUnit: 200,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 1,
  },
  {
    name: 'Universal testing machine',
    category: 'Mechanical',
    description: 'UTM — bill standard group vs micro-shear per sample.',
    machine: 'Universal testing machine',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      {
        code: 'utm_standard_group',
        label:
          'Shear, tensile, flexural, compressive, pull-out, retention, fracture resistance (per sample)',
        pricePerUnit: 200,
        billUnitLabel: 'sample',
      },
      { code: 'utm_micro_shear', label: 'Micro-shear (per sample)', pricePerUnit: 100, billUnitLabel: 'sample' },
    ],
    estimatedDaysPerUnit: 2,
  },
  {
    name: 'Push out test',
    category: 'Mechanical',
    description:
      'Push-out bond strength evaluation. Pricing TBD — update catalog when finalized.',
    machine: 'Universal testing machine / custom fixture',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 2,
  },
  {
    name: 'Marginal adaptation',
    category: 'Clinical evaluation',
    description: 'Assessment of marginal integrity (per surface).',
    machine: 'Stereomicroscope / SEM as applicable',
    unitLabel: 'surface',
    pricePerUnit: 150,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 3,
  },
  {
    name: 'Internal adaptation',
    category: 'Clinical evaluation',
    description: 'Evaluation of internal fit and adaptation of indirect restorations.',
    machine: 'Sectioning / microscopy workflow',
    unitLabel: 'specimens',
    pricePerUnit: 130,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 3,
  },
  {
    name: 'Tooth brushing simulation',
    category: 'Wear simulation',
    description: 'Simulated tooth brushing abrasion protocol.',
    machine: 'Brushing simulator',
    unitLabel: 'cycles',
    pricePerUnit: 85,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 2,
  },
  {
    name: 'Color Test',
    category: 'Aesthetic',
    description: 'Color measurement (e.g. ΔE).',
    machine: 'Spectrophotometer / colorimeter',
    unitLabel: 'measurements',
    pricePerUnit: 70,
    pricingTiers: [],
    pricingComponents: [],
    estimatedDaysPerUnit: 1,
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Check server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected:', mongoose.connection.name);

  let inserted = 0;
  let skipped = 0;

  for (const doc of catalog) {
    const payload = {
      ...doc,
      isAvailable: true,
    };

    const result = await Test.updateOne(
      { name: doc.name },
      { $setOnInsert: payload },
      { upsert: true }
    );

    if (result.upsertedCount === 1) inserted += 1;
    else skipped += 1;
  }

  const total = await Test.countDocuments();
  console.log(`Catalog sync: ${inserted} inserted, ${skipped} already present. Total tests in DB: ${total}`);
  console.log('Tip: run npm run seed:test-pricing to refresh pricing on existing rows.');

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
