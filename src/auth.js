// Frontend auth module - communicates with /api/auth/* endpoints

let currentUser = null;
let authListeners = [];

export function onAuthChange(callback) {
  authListeners.push(callback);
}

function notifyAuthChange() {
  authListeners.forEach(fn => fn(currentUser));
}

export async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    currentUser = await res.json();
  } catch {
    currentUser = null;
  }
  notifyAuthChange();
  return currentUser;
}

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return currentUser !== null;
}

export function isAdmin() {
  return currentUser?.is_admin === true;
}

export function login() {
  window.location.href = '/api/auth/login';
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  notifyAuthChange();
}

export function needsProfile() {
  return currentUser && (!currentUser.relation || currentUser.relation === '');
}
