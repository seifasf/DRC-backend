/**
 * Upserts an admin user (hash password, force role admin, activate).
 * Do not commit secrets. Run once:
 *   ADMIN_SEED_EMAIL=you@example.com ADMIN_SEED_PASSWORD='yourpass' ADMIN_SEED_NAME='Your Name' npm run seed:admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Check server/.env');
    process.exit(1);
  }

  const email = (process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || '';
  const name = (process.env.ADMIN_SEED_NAME || 'Admin').trim();

  if (!email || !password) {
    console.error(
      'Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD, then: npm run seed:admin'
    );
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hashed = await bcrypt.hash(password, 12);

  await User.updateOne(
    { email },
    {
      $set: {
        name,
        email,
        password: hashed,
        role: 'admin',
        isActive: true,
      },
    },
    { upsert: true }
  );

  const user = await User.findOne({ email }).select('name email role isActive createdAt');
  console.log('Admin user ready:', user ? user.toObject() : '(not found)');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
