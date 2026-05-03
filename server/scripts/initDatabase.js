/**
 * Creates the drc_db database (on first use) and all app collections with indexes.
 * Run: npm run db:init
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const User = require('../models/User.model');
const Machine = require('../models/Machine.model');
const BlockProduct = require('../models/BlockProduct.model');
const Test = require('../models/Test.model');
const WorkOrder = require('../models/WorkOrder.model');
const OrderItem = require('../models/OrderItem.model');
const DailyLog = require('../models/DailyLog.model');
const Appointment = require('../models/Appointment.model');
const Payment = require('../models/Payment.model');

const models = [User, Machine, BlockProduct, Test, WorkOrder, OrderItem, DailyLog, Appointment, Payment];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Check server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const { host, name } = mongoose.connection;
  console.log(`Connected: ${host}  database: ${name}`);

  for (const Model of models) {
    const collectionName = Model.collection.name;
    await Model.syncIndexes();
    const count = await Model.estimatedDocumentCount();
    console.log(`  ${collectionName}: indexes synced (documents: ${count})`);
  }

  await mongoose.connection.close();
  console.log('Done. Database and collections are ready in Atlas.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
