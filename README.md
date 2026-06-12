# DriveX — Premium Vehicle Rental Management System

DriveX is a production-grade, state-of-the-art Vehicle Rental Management System (VRMS) designed for customers, vehicle owners, and administrators. It features an automated workflow for renting two-wheelers and four-wheelers, real-time availability tracking, dynamic pricing tiers, integrated payment verification, email notifications, and comprehensive moderation controls.

---

## 🚀 Key Features

* **Dual-Vehicle Support**: Seamless renting of 2-Wheelers (2W) and 4-Wheelers (4W) with customized attributes (fuel type, transmission, seating, color).
* **Multi-Role Dashboards**:
  * **Customer**: Browse vehicles, calculate fares, book slots securely, make payments, track refunds, and file/reply to complaints.
  * **Owner**: Register vehicles, approve/reject bookings, manage vehicle availability, and respond to customer complaints.
  * **Admin**: Oversee the entire system, moderate reviews/testimonials, approve vehicles, manage complaints, and audit security events.
* **OTP Verification**: Multi-stage OTP verification for registration, email verification, profile updates, and password resets.
* **Dynamic Pricing & snapshots**: Base rates configured per vehicle (Daily, Weekly, Monthly) with tax/charge calculations. Fare versions are snapshotted at booking creation to avoid retroactive price updates.
* **Razorpay Payment Gateway**: Secure frontend checkouts with backend validation and signature verification.
* **Complaint & Dispute Workflow**: File complaints with attachments (Cloudinary hosting), append-only activity tracking, and status transitions.
* **Testimonials & Reviews**: Verified customer reviews with optional admin features to highlight on the homepage.
* **Audit & Email Logging**: Backend log monitoring of every transaction, profile change, and SMTP notification dispatch.

---

## 🛠️ Tech Stack

* **Frontend**: React (Vite-powered SPA), HTML5, Vanilla CSS, Bootstrap 5, FontAwesome, Axios.
* **Backend**: Node.js, Express, Nodemailer (Email notifications with retry handling).
* **Database**: MongoDB Atlas (Mongoose ODM with custom indexes & Optimistic Concurrency Control).
* **Media Storage**: Cloudinary (Image uploads).
* **Payment Processing**: Razorpay.
* **Security & Reliability**: JWT Authentication, bcrypt, Helmet headers, express-mongo-sanitize, CORS policies.

---

## 📦 Project Structure

```
DriveX_React/
├── Frontend/           # React client application (Vite SPA)
│   ├── src/            # Components, Pages, Context, Services, Utils
│   ├── public/         # Static assets (logo, images)
│   ├── vite.config.js  # Vite dev & build configuration
│   └── vercel.json     # Vercel SPA routing rules
├── Backend/            # Node.js + Express API server
│   ├── config/         # DB connection utilities
│   ├── controllers/    # Business logic handlers
│   ├── middleware/     # Auth, rateLimiting, upload, ownership validators
│   ├── models/         # Mongoose schema definitions
│   ├── routes/         # API endpoint definitions
│   └── utils/          # Email service, seeder scripts, audit loggers
├── package.json        # Root scripts for concurrently running projects
└── .gitignore          # Production git ignore definitions
```

---

## ⚙️ Installation & Local Setup

### Prerequisites
* Node.js (v18+ recommended)
* MongoDB database (local or Atlas cluster)
* Gmail/SMTP account credentials (for notifications)
* Razorpay API keys (test mode)
* Cloudinary API credentials (for vehicle photo uploads)

### Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/DriveX.git
   cd DriveX
   ```

2. **Install Dependencies**:
   Install all dependencies for root, frontend, and backend with a single command:
   ```bash
   npm run install:all
   ```

3. **Configure Environment Variables**:
   * Create a `.env` file in the `Backend` directory using the structure from `Backend/.env.example`.
   * Create a `.env` file in the `Frontend` directory using the structure from `Frontend/.env.example`.

4. **Seed Mock Data (Optional)**:
   Seed the database with preconfigured vehicles, owners, customers, and administrative credentials:
   ```bash
   npm run seed --prefix Backend
   ```

5. **Start Development Server**:
   Launch both frontend (port 3000) and backend (port 8080) simultaneously:
   ```bash
   npm run dev
   ```

---

## 🔐 Environment Variables

### Backend (`Backend/.env`)
```env
PORT=8080
MONGO_URI=mongodb+srv://<db_user>:<password>@cluster.mongodb.net/drivex
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:3000

# Razorpay Integration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_sender_email@gmail.com
SMTP_PASS=your_app_specific_password
SMTP_FROM="DriveX Support" <your_sender_email@gmail.com>
```

### Frontend (`Frontend/.env`)
```env
VITE_API_URL=http://localhost:8080/api
```

---

## 🚀 Deployment Instructions

### 1. Frontend (Vercel)
1. Import the project folder to Vercel.
2. Set the **Root Directory** option to `Frontend`.
3. Select **Vite** as the Framework Preset (if not auto-detected).
4. Configure the environment variables:
   * `VITE_API_URL`: Set to your live Render API endpoint (e.g., `https://drivex-api.onrender.com/api`).
5. Click **Deploy**. SPA routing is automatically handled by the preconfigured `Frontend/vercel.json`.

### 2. Backend (Render)
1. Create a new **Web Service** on Render and link your repository.
2. Set the **Root Directory** option to `Backend`.
3. Set the **Build Command** to `npm install`.
4. Set the **Start Command** to `node server.js` or `npm start`.
5. In **Advanced Settings**, add the environment variables specified in the Backend section above (ensure `NODE_ENV` is set to `production`).
6. Add the Health Check Path as `/health`.
7. Click **Deploy**.

---

## 📷 Screenshots
*(Place application UI screenshots in `/screenshots` or host them online and insert links here)*
* **Landing Page & Testimonials**: Elegant dark Cyber-Crisis theme with high-contrast elements.
* **Interactive Booking Details**: Time-locked calendars and dynamic price calculation summaries.
* **Owner & Admin Operations**: Real-time audit trails, review moderation panels, and complaint feeds.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
