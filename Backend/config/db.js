const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  try {
    // Override DNS servers to handle SRV resolution issues on some networks
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('Connecting to MongoDB...');
    const maskedUri = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@') : 'UNDEFINED';
    console.log(`URI being used: ${maskedUri}`);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
