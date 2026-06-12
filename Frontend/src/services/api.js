import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to requests
apiClient.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('vrms_current_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage');
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Helper to extract response data or throw error message
const request = async (config) => {
  try {
    const response = await apiClient(config);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Request failed';
    throw new Error(message);
  }
};

export const authAPI = {
  login: (email, password) => request({ url: '/users/login', method: 'POST', data: { email, password } }),
  register: (userData) => request({ url: '/users/register', method: 'POST', data: userData }),
  verifyOTP: (email, otp) => request({ url: '/users/verify-otp', method: 'POST', data: { email, otp } }),
  resendOTP: (email, reason) => request({ url: '/users/resend-otp', method: 'POST', data: { email, reason } }),
  forgotPassword: (email) => request({ url: '/users/forgot-password', method: 'POST', data: { email } }),
  verifyForgotOTP: (email, otp) => request({ url: '/users/verify-forgot-otp', method: 'POST', data: { email, otp } }),
  resetPassword: (email, otp, password) => request({ url: '/users/reset-password', method: 'POST', data: { email, otp, password } }),
};

export const userAPI = {
  getAll: () => request({ url: '/users', method: 'GET' }),
  getById: (id) => request({ url: `/users/${id}`, method: 'GET' }),
  getByRole: (role) => request({ url: `/users/role/${role}`, method: 'GET' }),
  toggleActive: (id) => request({ url: `/users/${id}/toggle-active`, method: 'PUT' }),
  update: (id, data) => request({ url: `/users/${id}`, method: 'PUT', data }),
  delete: (id) => request({ url: `/users/${id}`, method: 'DELETE' }),
};

export const vehicleAPI = {
  getAll: () => request({ url: '/vehicles', method: 'GET' }),
  getById: (id) => request({ url: `/vehicles/${id}`, method: 'GET' }),
  getByOwner: (ownerId) => request({ url: `/vehicles/owner/${ownerId}`, method: 'GET' }),
  getAvailable: () => request({ url: '/vehicles/available', method: 'GET' }),
  getByLocation: (location) => request({ url: `/vehicles/location/${location}`, method: 'GET' }),
  add: (data) => request({ url: '/vehicles', method: 'POST', data }),
  update: (id, data) => request({ url: `/vehicles/${id}`, method: 'PUT', data }),
  delete: (id) => request({ url: `/vehicles/${id}`, method: 'DELETE' }),
  approve: (id, approved) => request({ url: `/vehicles/${id}/approve?approved=${approved}`, method: 'PUT' }),
  updateStatus: (id, status) => request({ url: `/vehicles/${id}/status?status=${status}`, method: 'PUT' }),
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post('/vehicles/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data; // expects URL string back
  }
};

export const bookingAPI = {
  getAll: () => request({ url: '/bookings', method: 'GET' }),
  getById: (id) => request({ url: `/bookings/${id}`, method: 'GET' }),
  getByCustomer: (id) => request({ url: `/bookings/customer/${id}`, method: 'GET' }),
  getByOwner: (id) => request({ url: `/bookings/owner/${id}`, method: 'GET' }),
  create: (data) => request({ url: '/bookings', method: 'POST', data }),
  updateStatus: (id, status, extraData = {}) => request({ url: `/bookings/${id}/status?status=${status}`, method: 'PUT', data: extraData }),
  checkAvailability: (vehicleId, start, end) => request({ url: `/bookings/availability?vehicleId=${vehicleId}&startDate=${start}&endDate=${end}`, method: 'GET' }),
};

export const paymentAPI = {
  createOrder: (amount) => request({ url: '/payments/create-order', method: 'POST', data: { amount } }),
  verifyPayment: (data) => request({ url: '/payments/verify-payment', method: 'POST', data }),
};

export const profileAPI = {
  getMe: () => request({ url: '/profile/me', method: 'GET' }),
  update: (data) => request({ url: '/profile/update', method: 'PUT', data }),
  sendEmailOTP: (newEmail) => request({ url: '/profile/send-email-otp', method: 'POST', data: { newEmail } }),
  verifyEmailOTP: (otp) => request({ url: '/profile/verify-email-otp', method: 'POST', data: { otp } }),
  changePassword: (oldPassword, newPassword, confirmPassword) =>
    request({ url: '/profile/change-password', method: 'PUT', data: { oldPassword, newPassword, confirmPassword } }),
};

export const complaintAPI = {
  // Customer
  create: (data) => request({ url: '/complaints/create', method: 'POST', data }),
  getMyComplaints: () => request({ url: '/complaints/my-complaints', method: 'GET' }),
  getById: (id) => request({ url: `/complaints/${id}`, method: 'GET' }),
  reply: (id, data) => request({ url: `/complaints/${id}/reply`, method: 'PUT', data }),
  getAll: () => request({ url: '/complaints', method: 'GET' }),
  update: (id, data) => request({ url: `/complaints/${id}/reply`, method: 'PUT', data }),

  // Owner
  ownerGetAll: () => request({ url: '/owner/complaints', method: 'GET' }),
  ownerRespond: (id, data) => request({ url: `/owner/complaints/respond/${id}`, method: 'POST', data }),

  // Admin
  adminGetAll: (params) => request({ url: '/admin/complaints', method: 'GET', params }),
  adminUpdateStatus: (id, data) => request({ url: `/admin/complaints/update-status/${id}`, method: 'PUT', data }),
  adminResolve: (id, data) => request({ url: `/admin/complaints/resolve/${id}`, method: 'PUT', data }),
};

export const refundAPI = {
  getAll: () => request({ url: '/refunds', method: 'GET' }),
  request: (bookingId, refundReason) => request({ url: '/refunds', method: 'POST', data: { bookingId, refundReason } }),
  process: (id, status, adminNotes) => request({ url: `/refunds/${id}/process`, method: 'PUT', data: { status, adminNotes } }),
};

export const reviewAPI = {
  getAll: () => request({ url: '/reviews', method: 'GET' }),
  getByVehicle: (vehicleId) => request({ url: `/reviews/vehicle/${vehicleId}`, method: 'GET' }),
  submit: (bookingId, rating, feedback) => request({ url: '/reviews', method: 'POST', data: { bookingId, rating, feedback } }),
  moderate: (id, moderationStatus, moderationReason) => request({ url: `/reviews/${id}/moderate`, method: 'PUT', data: { moderationStatus, moderationReason } }),
  delete: (id) => request({ url: `/reviews/${id}`, method: 'DELETE' }),
  getTestimonials: () => request({ url: '/testimonials', method: 'GET' }),
  feature: (id) => request({ url: `/admin/reviews/${id}/feature`, method: 'PUT' }),
  unfeature: (id) => request({ url: `/admin/reviews/${id}/unfeature`, method: 'PUT' }),
};

export const auditAPI = {
  getAll: (params) => request({ url: '/audit', method: 'GET', params }),
};


