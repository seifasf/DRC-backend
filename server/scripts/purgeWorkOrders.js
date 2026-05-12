/**
 * Deletes ALL work orders and dependent records (testing reset).
 * Does NOT touch Users, Tests, BlockProducts, Machines, Appointments.
 *
 * Deletes: DailyLog, Payment, OrderItem, WorkOrder (in safe order).
 *
 * Usage:
 *   cd server && CONFIRM_PURGE_WORK_ORDERS=yes node scripts/purgeWorkOrders.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const DailyLog = require('../models/DailyLog.model');
const Payment = require('../models/Payment.model');
const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');

async function main() {
  if (process.env.CONFIRM_PURGE_WORK_ORDERS !== 'yes') {
    console.error(
      'Refusing to run. Set CONFIRM_PURGE_WORK_ORDERS=yes and ensure MONGO_URI points at the right database.'
    );
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const dl = await DailyLog.deleteMany({});
  const pay = await Payment.deleteMany({});
  const items = await OrderItem.deleteMany({});
  const wo = await WorkOrder.deleteMany({});

  console.log('Deleted counts:');
  console.log('  DailyLog:', dl.deletedCount);
  console.log('  Payment:', pay.deletedCount);
  console.log('  OrderItem:', items.deletedCount);
  console.log('  WorkOrder:', wo.deletedCount);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
