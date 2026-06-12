const KEY = 'vrms_current_user';

export function getCurrentUser() {
  const data = localStorage.getItem(KEY);
  return data ? JSON.parse(data) : null;
}

export function saveCurrentUser(user) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  localStorage.removeItem(KEY);
}
