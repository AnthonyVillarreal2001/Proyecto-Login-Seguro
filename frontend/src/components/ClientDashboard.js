import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ClientDashboard = () => {
  const [profile, setProfile] = useState({});
  const [preferences, setPreferences] = useState({ theme: 'light', notifications: true });

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setProfile(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleUpdatePreferences = async () => {
    try {
      await axios.put('/profile/preferences', { preferences }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Preferencias actualizadas');
    } catch (err) {
      alert('Error al actualizar');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
  };

  return (
    <div className="container mt-5">
      <h2>Dashboard Cliente</h2>
      <button onClick={handleLogout} className="btn btn-danger mb-4">Logout</button>

      <h4>Perfil</h4>
      <p><strong>Nombre:</strong> {profile.name}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Fecha de registro:</strong> {new Date(profile.registration_date).toLocaleDateString()}</p>

      <h4>Preferencias</h4>
      <div className="form-check">
        <input type="checkbox" className="form-check-input" id="notifications" checked={preferences.notifications} onChange={e => setPreferences({...preferences, notifications: e.target.checked})} aria-label="Notificaciones" />
        <label className="form-check-label" htmlFor="notifications">Notificaciones</label>
      </div>
      <select value={preferences.theme} onChange={e => setPreferences({...preferences, theme: e.target.value})} className="form-select mb-3" aria-label="Tema">
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
      <button onClick={handleUpdatePreferences} className="btn btn-primary">Actualizar Preferencias</button>
    </div>
  );
};

export default ClientDashboard;