import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import { isAuthenticated, getUserRole } from './utils/auth';
import { initSessionManager } from './utils/sessionManager';
import axios from 'axios';

const ProtectedRoute = ({ children, role }) => {
  if (!isAuthenticated()) return <Navigate to="/login" />;
  if (role && getUserRole() !== role) return <Navigate to="/login" />;
  return children;
};

function App() {
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const sessionInitialized = useRef(false);

  useEffect(() => {
    const applyTheme = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setTheme('light');
        document.documentElement.setAttribute('data-bs-theme', 'light');
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get('/profile');
        const userTheme = res.data.preferences?.theme || 'light';
        setTheme(userTheme);
        document.documentElement.setAttribute('data-bs-theme', userTheme);
        
        // Solo inicializar session manager si no está inicializado
        if (!sessionInitialized.current) {
          console.log('Inicializando SessionManager...');
          initSessionManager();
          sessionInitialized.current = true;
        }
        
      } catch (err) {
        console.warn('Error cargando preferencias:', err.message);
        document.documentElement.setAttribute('data-bs-theme', 'light');
        
        // Si el token es inválido, limpiar
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('sessionID');
          sessionInitialized.current = false;
        }
      } finally {
        setLoading(false);
      }
    };

    applyTheme();

    return () => {
      // No destruir session manager en recargas, solo en cierre de pestaña
      // El session manager se maneja a sí mismo
    };
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div data-bs-theme={theme}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/client" element={
            <ProtectedRoute role="client">
              <ClientDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;