require('dotenv').config();
const mongoose = require('mongoose');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const connectDB = require('../config/db');

const seedVehicles = async () => {
  try {
    await connectDB();

    // Get an owner ID (Rental Agency)
    const owner = await User.findOne({ role: 'owner' });
    if (!owner) {
      console.error('No owner (Rental Agency) found. Please create an owner account first.');
      process.exit(1);
    }

    // Delete existing vehicles
    await Vehicle.deleteMany({});
    console.log('Previous vehicles deleted.');

    const vehicles = [
      {
        name: 'Royal Enfield Classic 350',
        brand: 'ROYAL ENFIELD',
        type: '2W',
        fuel: 'Petrol',
        transmission: 'Manual',
        seats: 2,
        regNumber: 'MH01AB1234',
        model: '2023',
        priceDaily: 900,
        priceWeekly: 5000,
        priceMonthly: 17000,
        status: 'available',
        approved: true,
        location: 'Mumbai',
        image: 'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312101/bullet_cover.jpg',
        images: [
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312102/bullet_side.jpg',
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312103/bullet_meter.jpg'
        ],
        color: '#3b3b5e',
        ownerId: owner._id
      },
      {
        name: 'Maruti Swift',
        brand: 'MARUTI SUZUKI',
        type: '4W',
        fuel: 'Petrol',
        transmission: 'Manual',
        seats: 5,
        regNumber: 'MH02CD5678',
        model: '2022',
        priceDaily: 1800,
        priceWeekly: 10000,
        priceMonthly: 35000,
        status: 'available',
        approved: true,
        location: 'Pune',
        image: 'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312201/swift_cover.jpg',
        images: [
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312202/swift_interior.jpg',
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312203/swift_rear.jpg'
        ],
        color: '#6e3a3a',
        ownerId: owner._id
      },
      {
        name: 'Ola S1 Pro',
        brand: 'OLA ELECTRIC',
        type: '2W',
        fuel: 'Electric',
        transmission: 'Automatic',
        seats: 2,
        regNumber: 'MH03EF9012',
        model: '2024',
        priceDaily: 500,
        priceWeekly: 2800,
        priceMonthly: 9000,
        status: 'available',
        approved: true,
        location: 'Bangalore',
        image: 'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312301/ola_cover.jpg',
        images: [
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312302/ola_dashboard.jpg',
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312303/ola_front.jpg'
        ],
        color: '#004d40',
        ownerId: owner._id
      },
      {
        name: 'Tata Nexon EV',
        brand: 'TATA MOTORS',
        type: '4W',
        fuel: 'Electric',
        transmission: 'Automatic',
        seats: 5,
        regNumber: 'MH04GH3456',
        model: '2023',
        priceDaily: 2500,
        priceWeekly: 14000,
        priceMonthly: 48000,
        status: 'available',
        approved: true,
        location: 'Delhi',
        image: 'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312401/nexon_cover.jpg',
        images: [
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312402/nexon_dashboard.jpg',
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312403/nexon_rear.jpg'
        ],
        color: '#003d33',
        ownerId: owner._id
      },
      {
        name: 'Mahindra Thar',
        brand: 'MAHINDRA',
        type: '4W',
        fuel: 'Diesel',
        transmission: 'Manual',
        seats: 4,
        regNumber: 'MH05IJ7890',
        model: '2024',
        priceDaily: 3500,
        priceWeekly: 19000,
        priceMonthly: 65000,
        status: 'available',
        approved: true,
        location: 'Mumbai',
        image: 'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312501/thar_cover.jpg',
        images: [
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312502/thar_dashboard.jpg',
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312503/thar_side.jpg'
        ],
        color: '#d63031',
        ownerId: owner._id
      },
      {
        name: 'Yamaha R15 V4',
        brand: 'YAMAHA',
        type: '2W',
        fuel: 'Petrol',
        transmission: 'Manual',
        seats: 2,
        regNumber: 'MH06KL1234',
        model: '2023',
        priceDaily: 1200,
        priceWeekly: 7000,
        priceMonthly: 25000,
        status: 'available',
        approved: true,
        location: 'Mumbai',
        image: 'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312601/r15_cover.jpg',
        images: [
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312602/r15_side.jpg',
          'https://res.cloudinary.com/dxtesthosting/image/upload/v1717312603/r15_front.jpg'
        ],
        color: '#2980b9',
        ownerId: owner._id
      }
    ];

    await Vehicle.insertMany(vehicles);
    console.log(`${vehicles.length} vehicles seeded successfully!`);

    process.exit();
  } catch (error) {
    console.error(`Error with seeding: ${error.message}`);
    process.exit(1);
  }
};

seedVehicles();
