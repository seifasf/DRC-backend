/**
 * Seeds default block catalog (LE prices). Idempotent by name/category.
 * Run: npm run seed:blocks
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const BlockProduct = require('../models/BlockProduct.model');

const catalog = [
  {
    name: 'Acrylic block — small',
    category: 'Acrylic blocks',
    unitLabel: 'block',
    pricePerUnit: 80,
    currency: 'LE',
    isAvailable: true,
  },
  {
    name: 'Acrylic block — large',
    category: 'Acrylic blocks',
    unitLabel: 'block',
    pricePerUnit: 100,
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
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected:', mongoose.connection.name);

  let inserted = 0;
  let skipped = 0;

  for (const doc of catalog) {
    const result = await BlockProduct.updateOne(
      { name: doc.name, category: doc.category },
      { $setOnInsert: doc },
      { upsert: true }
    );
    if (result.upsertedCount === 1) inserted += 1;
    else skipped += 1;
  }

  const total = await BlockProduct.countDocuments();
  console.log(`Block products: ${inserted} inserted, ${skipped} already present. Total: ${total}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
