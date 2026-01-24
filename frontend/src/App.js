import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import { isAuthenticated, getUserRole } from './utils/auth';
import { useEffect } from 'react';
import axios from 'axios';

const ProtectedRoute = ({ children, role }) => {
  if (!isAuthenticated()) return <Navigate to="/login" />;
  if (role && getUserRole() !== role) return <Navigate to="/login" />;
  return children;
};

function App() {

  useEffect(() => {
    const applyTheme = async () => {
      if (!isAuthenticated()) return;

      try {
        const res = await axios.get('/profile');
        const theme = res.data.preferences?.theme || 'light';
        document.documentElement.setAttribute('data-bs-theme', theme);
      } catch (err) {
        // Si falla, tema por defecto light
        document.documentElement.setAttribute('data-bs-theme', 'light');
      }
    };

    applyTheme();

    // Escuchar cambios en localStorage (por si se actualiza en otra pestaña)
    const handleStorageChange = () => applyTheme();
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  return (
    <Router>
      <div data-bs-theme="light">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/client" element={<ProtectedRoute role="client"><ClientDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;