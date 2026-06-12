require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

const seedAdmin = async () => {
  try {
    await connectDB();

    // Delete existing admin
    await User.deleteMany({ role: 'admin' });
    console.log('Previous admin(s) deleted.');

    // Create new admin
    const admin = new User({
      name: 'Super Admin',
      email: 'admin@gmail.com',
      password: 'admin@0507', // Will be hashed by the User model's pre-save middleware
      role: 'admin',
      active: true,
      isVerified: true
    });

    await admin.save();
    console.log('New admin created successfully: admin@gmail.com / admin@0507');

    process.exit();
  } catch (error) {
    console.error(`Error with seeding: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
