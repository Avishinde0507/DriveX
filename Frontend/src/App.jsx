import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Toast from './components/Toast';
import Home from './pages/Home';
import Login from './pages/Login';
import CustomerDashboard from './pages/CustomerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AddVehicle from './pages/AddVehicle';
import UpdateVehicle from './pages/UpdateVehicle';
import BookVehicle from './pages/BookVehicle';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/style.css';

function ProtectedRoute({ children, role }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (role && currentUser.role !== role) {
    const dashMap = { customer: '/customer', owner: '/owner', admin: '/admin' };
    return <Navigate to={dashMap[currentUser.role] || '/login'} replace />;
  }
  return children;
}

function AppRoutes() {
  const { theme } = useApp();
  return (
    <div className="vrms-app" data-theme={theme}>
      <Toast />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/customer" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/customer/book/:id" element={<ProtectedRoute role="customer"><BookVehicle /></ProtectedRoute>} />
        <Route path="/owner" element={<ProtectedRoute role="owner"><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/owner/add-vehicle" element={<ProtectedRoute role="owner"><AddVehicle /></ProtectedRoute>} />
        <Route path="/owner/update-vehicle/:id" element={<ProtectedRoute role="owner"><UpdateVehicle /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
