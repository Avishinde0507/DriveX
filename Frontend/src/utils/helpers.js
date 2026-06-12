/* ── Format Date ── */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Format Price ── */
export function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

/* ── Status Badge classes ── */
export function getStatusBadgeClass(status) {
  const map = {
    available: 'bg-success',
    rented: 'bg-info text-dark',
    maintenance: 'bg-warning text-dark',
    pending: 'bg-warning text-dark',
    approved: 'bg-success',
    active: 'bg-info text-dark',
    completed: 'bg-primary',
    rejected: 'bg-danger',
    cancelled: 'bg-danger',
    true: 'bg-success',
    false: 'bg-warning text-dark',
  };
  return map[String(status)] || 'bg-primary';
}

/* ── Today / Tomorrow helpers ── */
export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}
export function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
export function getDayAfterStr(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getTodayDateTimeStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
export function getTomorrowDateTimeStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
export function addDaysToDateTime(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/* ── Price Calculator (moved from db.js) ── */
export function calculatePrice(priceDaily, priceWeekly, priceMonthly, durationType, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
  let baseFare = 0;
  switch (durationType) {
    case 'daily': baseFare = days * priceDaily; break;
    case 'weekly': baseFare = (days / 7) * priceWeekly; break;
    case 'monthly': baseFare = (days / 30) * priceMonthly; break;
    default: baseFare = days * priceDaily; break;
  }
  const finalFare = Math.round(baseFare) + Math.round(baseFare * 0.18);
  return finalFare;
}

export function getVehicleImageUrl(image) {
  if (!image || typeof image !== 'string') return null;

  // 1. Return as-is if it's already a full URL or data URL
  if (image.startsWith('data:') || image.startsWith('http')) {
    return image;
  }

  // 2. Normalize path separators
  let path = image.replace(/\\/g, '/');

  // 3. Check if it's an uploaded file path or filename
  const isUpload = path.includes('uploads/') || path.match(/\.(jpg|jpeg|png|webp|gif)$/i);

  if (isUpload) {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // Use configured VITE_API_URL or fallback to local port
    const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : 'http://127.0.0.1:8080';
    return `${backendUrl}${path}`;
  }

  return null; // Fallback for legacy icons
}
