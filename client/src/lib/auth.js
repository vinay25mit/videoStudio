export function getStoredUser() {
  try {
    const raw = localStorage.getItem('mcq_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem('mcq_token'));
}

export function logout() {
  localStorage.removeItem('mcq_token');
  localStorage.removeItem('mcq_user');
  window.location.href = '/';
}
