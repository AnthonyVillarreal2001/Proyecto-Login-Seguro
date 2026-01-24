import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // Instala con npm install uuid

axios.defaults.baseURL = 'http://localhost:5000';

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Generar sessionID único al login
export const login = async (email, fallbackPassword = null, biometricResponse = null) => {
  const payload = { email };
  if (fallbackPassword) payload.fallbackPassword = fallbackPassword;
  if (biometricResponse) payload.biometricResponse = biometricResponse;

  const response = await axios.post('/auth/login', payload);
  const { token } = response.data;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('sessionID', uuidv4()); // ID único para esta sesión
  }
  return token;
};

// Logout seguro
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('sessionID');
  window.location.href = '/login';
};

// Verificar autenticación
export const isAuthenticated = () => !!localStorage.getItem('token');

// Obtener rol
export const getUserRole = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).role;
  } catch (err) {
    logout();
    return null;
  }
};

// Listener para multi-ventana: Si token o sessionID cambia en otra pestaña → logout
window.addEventListener('storage', (event) => {
  if (event.key === 'token' || event.key === 'sessionID') {
    const currentSessionID = localStorage.getItem('sessionID');
    const newSessionID = event.newValue;

    if (currentSessionID && newSessionID && currentSessionID !== newSessionID) {
      alert('¡Sesión iniciada en otra ventana! Cerrando esta por seguridad. 🔒');
      logout();
    }
  }
});