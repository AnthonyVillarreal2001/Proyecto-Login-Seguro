import React, { useState } from 'react';
import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleBiometricLogin = async () => {
    try {
      // Paso 1: Generar opciones de autenticación
      const optionsRes = await axios.post('/auth/login', { email }); // O endpoint específico si lo tienes
      const options = optionsRes.data;

      // Paso 2: Iniciar autenticación biométrica
      const authResponse = await startAuthentication(options);

      // Paso 3: Enviar respuesta al backend
      const verifyRes = await axios.post('/auth/login', {
        email,
        biometricResponse: authResponse
      });

      if (verifyRes.data.token) {
        localStorage.setItem('token', verifyRes.data.token);
        localStorage.setItem('role', verifyRes.data.role || 'client'); // Asume role del token
        window.location.href = verifyRes.data.role === 'admin' ? '/admin' : '/client';
      }
    } catch (err) {
      setError('Biometría fallida: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/auth/login', { email, fallbackPassword: password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role || 'client');
        window.location.href = res.data.role === 'admin' ? '/admin' : '/client';
      }
    } catch (err) {
      setError('Login fallido: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="text-center">Login Seguro</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handlePasswordLogin} className="mt-4">
        <div className="mb-3">
          <label htmlFor="email" className="form-label">Email</label>
          <input type="email" className="form-control" id="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">Contraseña (fallback)</label>
          <input type="password" className="form-control" id="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary">Login con Contraseña</button>
      </form>
      <button onClick={handleBiometricLogin} className="btn btn-success mt-3">Login con Biometría (Facial/Huella)</button>
    </div>
  );
};

export default Login;