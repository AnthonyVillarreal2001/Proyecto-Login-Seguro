import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminDashboard = () => {
  const [welcome, setWelcome] = useState('Bienvenido Admin');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'client' });
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setWelcome(`Bienvenido, ${res.data.name}`))
      .catch(err => console.error(err));
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/auth/register', newUser, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Usuario registrado');
      setNewUser({ name: '', email: '', password: '', role: 'client' });
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSearch = async () => {
    try {
      const res = await axios.get(`/users/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(res.data);
    } catch (err) {
      alert('Error en búsqueda');
    }
  };

  const handleEdit = async (id, updates) => {
    try {
      await axios.put(`/users/${id}`, updates, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Usuario editado');
      handleSearch(); // Refrescar lista
    } catch (err) {
      alert('Error al editar');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
  };

  return (
    <div className="container mt-5">
      <h2>{welcome}</h2>
      <button onClick={handleLogout} className="btn btn-danger mb-4">Logout</button>

      <h4>Registrar Nuevo Usuario</h4>
      <form onSubmit={handleRegister}>
        <input type="text" placeholder="Nombre" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required className="form-control mb-2" aria-label="Nombre" />
        <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required className="form-control mb-2" aria-label="Email" />
        <input type="password" placeholder="Contraseña" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required className="form-control mb-2" aria-label="Contraseña" />
        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="form-select mb-2" aria-label="Rol">
          <option value="client">Cliente</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="btn btn-success">Registrar</button>
      </form>

      <h4 className="mt-5">Búsqueda y Edición de Usuarios</h4>
      <input type="text" placeholder="Buscar por nombre o email" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-control mb-2" aria-label="Buscar usuario" />
      <button onClick={handleSearch} className="btn btn-primary mb-3">Buscar</button>

      <ul className="list-group">
        {users.map(user => (
          <li key={user.id} className="list-group-item">
            {user.name} - {user.email} ({user.role})
            <button onClick={() => handleEdit(user.id, { name: 'Editado' })} className="btn btn-sm btn-warning ms-3">Editar Nombre</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminDashboard;