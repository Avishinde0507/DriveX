# DriveX VRMS — React.js

A **Vehicle Rental Management System** built with React.js + Bootstrap 5.

## 🚀 Tech Stack
- **React.js 18** — Component-based UI
- **React Router v6** — Client-side routing
- **Bootstrap 5** — Responsive layout & utilities
- **Context API** — Global state (auth, toast)
- **Node.js / Express API** — Backend services (connecting to http://localhost:8080/api)

## 📁 Project Structure
```
src/
├── services/
│   └── api.js              ← Axios/Fetch API wrappers
├── utils/
│   └── helpers.js          ← formatPrice, formatDate, etc.
├── context/
│   └── AppContext.jsx       ← Global auth + toast state
├── components/
│   ├── Toast.jsx            ← Global toast notification
│   ├── StatusBadge.jsx      ← Coloured status pill
│   └── Sidebar.jsx          ← Dashboard sidebar (shared)
├── pages/
│   ├── Home.jsx             ← Landing page (public)
│   ├── Login.jsx            ← Login / Register page
│   ├── CustomerDashboard.jsx
│   ├── OwnerDashboard.jsx
│   └── AdminDashboard.jsx
├── styles/
│   └── style.css            ← Full custom design system
├── App.jsx                  ← Router + Protected Routes
└── index.js
```

## 🛠️ Getting Started

### Install dependencies
```bash
npm install
```

### Start development server
```bash
npm start
```
> Opens at **http://localhost:3000**

### Build for production
```bash
npm run build
```

## 🔑 Demo Credentials
| Role     | Email              | Password  |
|----------|--------------------|-----------|
| Customer | rahul@demo.com     | demo123   |
| Owner    | owner@demo.com     | demo123   |
| Admin    | admin@demo.com     | admin123  |

## 📌 Routes
| Path        | Page                  | Access     |
|-------------|----------------------|------------|
| `/`         | Landing Page          | Public     |
| `/login`    | Login / Register      | Public     |
| `/customer` | Customer Dashboard    | Customer   |
| `/owner`    | Owner Dashboard       | Owner      |
| `/admin`    | Admin Dashboard       | Admin      |

## ✨ Features
- **Role-based access control** (Customer / Owner / Admin)
- **Browse & filter vehicles** (type, fuel, price)
- **Booking system** with price calculator
- **Owner fleet management** (add/edit/delete vehicles)
- **Booking approval** workflow
- **Admin analytics** with KPI cards + charts
- **Fully responsive** mobile layout
- **Dark glassmorphism** design system
- **Toast notifications** for all actions
