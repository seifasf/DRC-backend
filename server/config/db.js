const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Do not exit: allow process to run (e.g. health checks) while Atlas credentials/IP are fixed
  }
};

module.exports = connectDB;
