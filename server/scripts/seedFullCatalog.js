/**
 * Seeds DRC Lab catalog with the FINAL price list (idempotent).
 * Uses $set so re-runs refresh the pricing for existing tests/blocks.
 *
 *   - Test catalog (incl. Nano leakage, Biaxial flexural strength): simple, tiered, or component pricing.
 *   - Block products (4 entries): small/large acrylic, acrylic w/ rubber base, epoxy resin.
 *
 * Run: npm run seed:full-catalog
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Test = require('../models/Test.model');
const BlockProduct = require('../models/BlockProduct.model');

/** Strip optional catalog fields; infer unitLabel when missing. */
function catalogDoc(t) {
  const tiers = t.pricingTiers || [];
  const comps = t.pricingComponents || [];
  let { unitLabel } = t;
  if (!unitLabel || !String(unitLabel).trim()) {
    if (tiers.length) unitLabel = 'package';
    else if (comps.length) unitLabel = 'billable unit';
    else unitLabel = 'sample';
  }
  return {
    ...t,
    description: '',
    machine: '',
    unitLabel,
  };
}

/* ---------------- Test catalog ---------------- */

const tests = [
  {
    name: 'Chewing simulator',
    category: 'Mechanical simulation',
    description:
      'Accelerated chewing fatigue simulation. Each tier price is per package of 4 samples; quantity = number of packages.',
    machine: 'Chewing simulator',
    unitLabel: 'package',
    pricePerUnit: 0,
    pricingTiers: [
      { code: 'chw_10k', label: '10,000 cycles (4 samples)', cycles: 10000, packageSamples: 4, price: 600 },
      { code: 'chw_60k', label: '60,000 cycles (4 samples)', cycles: 60000, packageSamples: 4, price: 3000 },
      { code: 'chw_125k', label: '125,000 cycles (4 samples)', cycles: 125000, packageSamples: 4, price: 6000 },
      { code: 'chw_250k', label: '250,000 cycles (4 samples)', cycles: 250000, packageSamples: 4, price: 10000 },
      { code: 'chw_500k', label: '500,000 cycles (4 samples)', cycles: 500000, packageSamples: 4, price: 17000 },
      { code: 'chw_1m', label: '1,000,000 cycles (4 samples)', cycles: 1000000, packageSamples: 4, price: 30000 },
      { code: 'chw_2m', label: '2,000,000 cycles (4 samples)', cycles: 2000000, packageSamples: 4, price: 45000 },
    ],
    pricingComponents: [],
    isAvailable: true,
  },

  {
    name: 'Micro-tensile test',
    category: 'Mechanical',
    description:
      'Cutting per sample (any number of beams obtained), micro-tensile per beam, failure-mode per beam.',
    machine: 'Micro-tensile rig',
    unitLabel: 'billable unit',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'cutting_sample', label: 'Cutting (per sample, any beams obtained)', pricePerUnit: 350, billUnitLabel: 'sample' },
      { code: 'microtensile_beam', label: 'Micro-tensile test (per beam)', pricePerUnit: 45, billUnitLabel: 'beam' },
      { code: 'failure_mode_beam', label: 'Failure mode (per beam)', pricePerUnit: 50, billUnitLabel: 'beam' },
    ],
    isAvailable: true,
  },

  {
    name: 'Thermocycling',
    category: 'Thermal aging',
    description: 'Thermal cycling � pick a cycle package; quantity = number of packages.',
    machine: 'Thermocycling chamber',
    unitLabel: 'package',
    pricePerUnit: 0,
    pricingTiers: [
      { code: 'th_500', label: '500 cycles', cycles: 500, price: 1500 },
      { code: 'th_1000', label: '1,000 cycles', cycles: 1000, price: 2500 },
      { code: 'th_1500', label: '1,500 cycles', cycles: 1500, price: 3000 },
      { code: 'th_2000', label: '2,000 cycles', cycles: 2000, price: 3500 },
      { code: 'th_5000', label: '5,000 cycles', cycles: 5000, price: 6500 },
      { code: 'th_10000', label: '10,000 cycles', cycles: 10000, price: 12500 },
    ],
    pricingComponents: [],
    isAvailable: true,
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
    isAvailable: true,
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
    isAvailable: true,
  },

  {
    name: 'Universal testing machine',
    category: 'Mechanical',
    description:
      'UTM � bill standard test group (shear, tensile, flexural, compressive, pull-out, retention, fracture resistance) at 200 LE/sample, OR micro-shear at 100 LE/sample.',
    machine: 'Universal testing machine',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      {
        code: 'utm_standard_group',
        label: 'Shear / tensile / flexural / compressive / pull-out / retention / fracture resistance',
        pricePerUnit: 200,
        billUnitLabel: 'sample',
      },
      { code: 'utm_micro_shear', label: 'Micro-shear', pricePerUnit: 100, billUnitLabel: 'sample' },
    ],
    isAvailable: true,
  },

  {
    name: 'Push out test',
    category: 'Mechanical',
    description:
      'Push-out bond strength evaluation. Cutting fee covers 3 sections per sample; testing fee covers 3 sections per sample.',
    machine: 'Universal testing machine / custom fixture',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'pushout_cutting', label: 'Cutting (3 sections per sample)', pricePerUnit: 400, billUnitLabel: 'sample' },
      { code: 'pushout_test', label: 'Test of 3 sections (per sample)', pricePerUnit: 200, billUnitLabel: 'sample' },
    ],
    isAvailable: true,
  },

  {
    name: 'Marginal adaptation',
    category: 'Clinical evaluation',
    description:
      '150 LE per surface, OR 600 LE for a 4-surface package (each with 3-point analysis).',
    machine: 'Stereomicroscope / SEM as applicable',
    unitLabel: 'billable unit',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'ma_per_surface', label: 'Per surface (3-point analysis)', pricePerUnit: 150, billUnitLabel: 'surface' },
      { code: 'ma_4_surfaces', label: 'Package: 4 surfaces (3-point analysis each)', pricePerUnit: 600, billUnitLabel: 'package' },
    ],
    isAvailable: true,
  },

  {
    name: 'Internal adaptation',
    category: 'Clinical evaluation',
    description:
      'Cutting + analysis. Pick option 1 (1 direction + 1 half analysis @ 300 LE) or option 2 (2 directions + analysis @ 600 LE).',
    machine: 'Sectioning / microscopy workflow',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'ia_one_direction_half', label: '1 direction + 1 half analysis', pricePerUnit: 300, billUnitLabel: 'sample' },
      { code: 'ia_two_directions_full', label: '2 directions + full analysis', pricePerUnit: 600, billUnitLabel: 'sample' },
    ],
    isAvailable: true,
  },

  {
    name: 'Tooth brushing simulation',
    category: 'Wear simulation',
    description: 'Per-sample price depends on cycle tier; quantity = number of samples.',
    machine: 'Brushing simulator',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [
      { code: 'tb_3000', label: '3,000 cycles (per sample)', cycles: 3000, price: 350 },
      { code: 'tb_5000', label: '5,000 cycles (per sample)', cycles: 5000, price: 450 },
      { code: 'tb_10000', label: '10,000 cycles (per sample)', cycles: 10000, price: 600 },
    ],
    pricingComponents: [],
    isAvailable: true,
  },

  {
    name: 'Color Test',
    category: 'Aesthetic',
    description: 'Color measurement (e.g. \u0394E).',
    machine: 'Spectrophotometer / colorimeter',
    unitLabel: 'sample',
    pricePerUnit: 200,
    pricingTiers: [],
    pricingComponents: [],
    isAvailable: true,
  },

  {
    name: 'Cutting',
    category: 'Sample prep',
    description: 'Standalone cutting service: occlusal removal per sample, and section cutting per slice.',
    machine: 'Sectioning saw',
    unitLabel: 'billable unit',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'cut_occlusal', label: 'Occlusal removal (per sample)', pricePerUnit: 200, billUnitLabel: 'sample' },
      { code: 'cut_section', label: 'Section cutting (per slice)', pricePerUnit: 200, billUnitLabel: 'slice' },
    ],
    isAvailable: true,
  },

  {
    name: 'Incubator',
    category: 'Aging / storage',
    description: 'Incubator usage for sample conditioning, billed per day.',
    machine: 'Incubator',
    unitLabel: 'day',
    pricePerUnit: 1200,
    pricingTiers: [],
    pricingComponents: [],
    isAvailable: true,
  },

  {
    name: 'Triple scan',
    category: 'Digital scanning',
    description:
      'Triple scan (marginal and internal adaptation) at 400 LE; optional Geomagic alignment & analysis at 200 LE.',
    machine: 'Lab scanner / Geomagic',
    unitLabel: 'sample',
    pricePerUnit: 0,
    pricingTiers: [],
    pricingComponents: [
      { code: 'ts_triple_scan', label: 'Triple scan (marginal + internal)', pricePerUnit: 400, billUnitLabel: 'sample' },
      { code: 'ts_geomagic', label: 'Geomagic alignment / analysis', pricePerUnit: 200, billUnitLabel: 'sample' },
    ],
    isAvailable: true,
  },

  {
    name: 'Microleakage',
    category: 'Clinical evaluation',
    description: 'Microleakage assessment (dye penetration / SEM).',
    machine: 'Sectioning + microscopy',
    unitLabel: 'sample',
    pricePerUnit: 500,
    pricingTiers: [],
    pricingComponents: [],
    isAvailable: true,
  },

  {
    name: 'Nano leakage',
    category: 'Surface / leakage',
    description: '',
    machine: '',
    unitLabel: 'package',
    pricePerUnit: 0,
    pricingTiers: [
      { code: 'nl_1sec', label: 'One section', price: 400, packageSamples: 1 },
      { code: 'nl_2sec', label: 'Two sections', price: 600, packageSamples: 1 },
    ],
    pricingComponents: [],
    isAvailable: true,
  },

  {
    name: 'Biaxial flexural strength',
    category: 'Mechanical',
    description: '',
    machine: '',
    unitLabel: 'sample',
    pricePerUnit: 200,
    pricingTiers: [],
    pricingComponents: [],
    isAvailable: true,
  },
];

/* ---------------- Block products ---------------- */

const blocks = [
  {
    name: 'Acrylic block - small',
    category: 'Acrylic blocks',
    unitLabel: 'block',
    pricePerUnit: 80,
    currency: 'LE',
    isAvailable: true,
  },
  {
    name: 'Acrylic block - large',
    category: 'Acrylic blocks',
    unitLabel: 'block',
    pricePerUnit: 100,
    currency: 'LE',
    isAvailable: true,
  },
  {
    name: 'Acrylic block with rubber base',
    category: 'Acrylic blocks',
    unitLabel: 'block',
    pricePerUnit: 150,
    currency: 'LE',
    isAvailable: true,
  },
  {
    name: 'Epoxy resin',
    category: 'Epoxy resin',
    unitLabel: 'block',
    pricePerUnit: 300,
    currency: 'LE',
    isAvailable: true,
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Check server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected:', mongoose.connection.name);

  let testInserted = 0;
  let testUpdated = 0;
  for (const t of tests) {
    const doc = catalogDoc(t);
    const res = await Test.updateOne({ name: doc.name }, { $set: doc }, { upsert: true });
    if (res.upsertedCount === 1) testInserted += 1;
    else testUpdated += 1;
  }

  let blockInserted = 0;
  let blockUpdated = 0;
  for (const b of blocks) {
    const res = await BlockProduct.updateOne(
      { name: b.name, category: b.category },
      { $set: b },
      { upsert: true }
    );
    if (res.upsertedCount === 1) blockInserted += 1;
    else blockUpdated += 1;
  }

  const testTotal = await Test.countDocuments();
  const blockTotal = await BlockProduct.countDocuments();

  console.log(`Tests: ${testInserted} inserted, ${testUpdated} updated. Total in DB: ${testTotal}`);
  console.log(`Blocks: ${blockInserted} inserted, ${blockUpdated} updated. Total in DB: ${blockTotal}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
