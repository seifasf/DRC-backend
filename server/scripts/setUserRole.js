/**
 * One-off role update for a user by email (e.g. promote to manager).
 *
 * Usage:
 *   cd server && node scripts/setUserRole.js hamdyramadan737@gmail.com manager
 *
 * Requires MONGO_URI in server/.env. User must sign out and back in so JWT/client picks up role.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Check server/.env');
    process.exit(1);
  }

  const email = String(process.argv[2] || 'hamdyramadan737@gmail.com')
    .trim()
    .toLowerCase();
  const role = String(process.argv[3] || 'manager').trim();

  const allowed = ['employee', 'admin', 'manager'];
  if (!allowed.includes(role)) {
    console.error(`role must be one of: ${allowed.join(', ')}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const r = await User.updateOne({ email }, { $set: { role } });
  console.log('email:', email, 'role:', role);
  console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
  if (r.matchedCount === 0) {
    console.warn('No user found with that email.');
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
