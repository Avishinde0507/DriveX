require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('./middleware/mongoSanitize');
const connectDB = require('./config/db');

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE VALIDATION
// ─────────────────────────────────────────────────────────────────
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.warn(`\n⚠️  [WARN] Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn(`👉 Please check your .env file or configuration provider before proceeding.\n`);
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ [FATAL] Missing critical environment variables in production. Exiting application.');
    process.exit(1);
  }
}

// Connect Database
connectDB();

const app = express();

// ─────────────────────────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
// 1. HTTP Headers Security (XSS protection, Clickjacking protection, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to ensure uploads and local interfaces load easily
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Prevent NoSQL Injection
app.use(mongoSanitize());

// 3. Strict CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://drivex-react-0507.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, postman, curl)
    if (!origin) return callback(null, true);

    const isVercel = origin.endsWith('.vercel.app') || /^https:\/\/.*\.vercel\.app$/.test(origin);

    if (allowedOrigins.indexOf(origin) !== -1 || isVercel || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    } else {
      const msg = `The CORS policy for this site does not allow access from origin: ${origin}`;
      return callback(new Error(msg), false);
    }
  },
  credentials: true
}));

app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/owner/complaints', require('./routes/ownerComplaintRoutes'));
app.use('/api/admin/complaints', require('./routes/adminComplaintRoutes'));
app.use('/api/refunds', require('./routes/refundRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/testimonials', require('./routes/testimonialRoutes'));
app.use('/api/admin/reviews', require('./routes/adminReviewRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// ─────────────────────────────────────────────────────────────────
// HEALTH & DIAGNOSTIC ENDPOINTS
// ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('DriveX API is running...');
});

app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';

  const healthStatus = {
    status: dbStatus === 'UP' ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      server: 'UP'
    },
    system: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    }
  };

  const statusCode = healthStatus.status === 'UP' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
