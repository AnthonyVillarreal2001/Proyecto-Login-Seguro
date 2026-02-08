import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // Instala con npm install uuid

axios.defaults.baseURL = 'http://localhost:5000';

axios.interceptors.request.use(async config => {
  const token = localStorage.getItem('token');
  if (token) {
    // Intentar renovar solo si está permitido tras continuar
    const newToken = await renewTokenIfNeeded();
    config.headers.Authorization = `Bearer ${newToken || token}`;
  }
  return config;
});

const renewState = { renewing: false, lastRenew: 0 };
const RENEW_COOLDOWN_MS = 60 * 1000; // no renovar más de 1 vez por minuto
const canRenew = () => window.__ALLOW_TOKEN_RENEW !== false;

// Función para renovar token automáticamente
export const renewTokenIfNeeded = async () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = (() => {
      try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
    })();
    if (!payload?.exp) return token; // si no hay exp, no renovar
    const expiresAt = payload.exp * 1000;
    const timeLeft = expiresAt - Date.now();
    
      // Renovar si queda menos de 45s, respetando cooldown y evitando reentradas
      if (timeLeft < 45 * 1000 && canRenew()) {
        const now = Date.now();
        if (renewState.renewing) return token; // evita loop por llamadas simultáneas
        if (now - renewState.lastRenew < RENEW_COOLDOWN_MS) return token; // cooldown

        renewState.renewing = true;
        renewState.lastRenew = now;
        console.log('Token por expirar, renovando...');
      
        const response = await axios.post('/auth/renew-token', {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      
        renewState.renewing = false;

        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          return response.data.token;
        }
        // Si backend no devuelve token, forzar logout para evitar loops 401
        logout();
      }
      return token;
  } catch (err) {
    console.error('Error renovando token:', err);
    renewState.renewing = false;
    if (err.response?.status === 401) logout();
    return null;
  }
};  

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
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    
    // Si el token ya expiró, limpiarlo
    if (Date.now() > expiresAt) {
      console.log('Token expirado, limpiando...');
      localStorage.removeItem('token');
      localStorage.removeItem('sessionID');
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error verificando token:', err);
    return false;
  }
};

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