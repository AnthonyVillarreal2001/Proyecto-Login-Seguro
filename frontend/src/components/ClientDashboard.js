import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProfileSettings from './ProfileSettings';
import { Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { initSessionManager } from '../utils/sessionManager';

const ClientDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState({ theme: 'light', notifications: true });
  const [loading, setLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!window.sessionManager || !window.sessionManager.initialized) {
      console.log('Inicializando SessionManager desde dashboard...');
      initSessionManager();
    }
    const fetchProfile = async () => {
      try {
        const res = await axios.get('/profile');
        setProfile(res.data);
        setPreferences(res.data.preferences || { theme: 'light', notifications: true });
      } catch (err) {
        setModalMessage('No pudimos cargar tu perfil. ¿Sesión cerrada?');
        setShowErrorModal(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdatePreferences = async () => {
    try {
      await axios.put('/profile/preferences', { preferences });
      // Aplicar tema inmediatamente
      document.documentElement.setAttribute('data-bs-theme', preferences.theme);
      setModalMessage('¡Preferencias guardadas! Tema aplicado.');
      setShowSuccessModal(true);
    } catch (err) {
      setModalMessage('No se pudieron guardar las preferencias. Intenta de nuevo.');
      setShowErrorModal(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
        <p>Cargando tu perfil...</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Bienvenido, {profile?.name || 'Usuario'}</h2>
        <Button variant="outline-danger" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>

      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-success text-white">
          <h5 className="mb-0">Tu Perfil</h5>
        </Card.Header>
        <Card.Body>
          <p><strong>Nombre:</strong> {profile?.name}</p>
          <p><strong>Correo:</strong> {profile?.email}</p>
          <p><strong>Fecha de registro:</strong> {profile?.registration_date ? new Date(profile.registration_date).toLocaleDateString('es-EC') : 'No disponible'}</p>
          <p><strong>Rol:</strong> Cliente</p>
        </Card.Body>
      </Card>

      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-info text-white">
          <h5 className="mb-0">Preferencias</h5>
        </Card.Header>
        <Card.Body>
          <Form>
            <Form.Check
              type="checkbox"
              id="notifications"
              label="Recibir notificaciones"
              checked={preferences.notifications}
              onChange={e => setPreferences({ ...preferences, notifications: e.target.checked })}
              className="mb-3"
            />

            <Form.Group className="mb-3">
              <Form.Label>Tema de la aplicación</Form.Label>
              <Form.Select
                value={preferences.theme}
                onChange={e => setPreferences({ ...preferences, theme: e.target.value })}
              >
                <option value="light">Claro (modo día ☀️)</option>
                <option value="dark">Oscuro (modo noche 🌙)</option>
              </Form.Select>
            </Form.Group>

            <Button variant="primary" onClick={handleUpdatePreferences}>
              Guardar preferencias
            </Button>
          </Form>
        </Card.Body>
      </Card>
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-warning text-dark">
          <h5 className="mb-0">Editar mi perfil</h5>
        </Card.Header>
        <Card.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                type="text"
                value={profile?.name || ''}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Correo electrónico</Form.Label>
              <Form.Control
                type="email"
                value={profile?.email || ''}
                onChange={e => setProfile({ ...profile, email: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nueva contraseña (opcional)</Form.Label>
              <Form.Control
                type="password"
                placeholder="Deja vacío si no quieres cambiarla"
                onChange={e => setProfile({ ...profile, password: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Contraseña actual (requerida)</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tu contraseña actual"
                required
              />
            </Form.Group>

            <Button
              variant="warning"
              onClick={async () => {
                if (!password.trim()) {
                  setModalMessage('Debes ingresar tu contraseña actual para confirmar cambios.');
                  setShowErrorModal(true);
                  return;
                }

                try {
                  await axios.put('/profile', {
                    name: profile.name,
                    email: profile.email,
                    password: profile.password || undefined,
                    currentPassword: password
                  });
                  setModalMessage('¡Perfil actualizado correctamente!');
                  setShowSuccessModal(true);
                  setPassword('');
                } catch (err) {
                  setModalMessage(err.response?.data?.error || 'Error al actualizar perfil.');
                  setShowErrorModal(true);
                }
              }}
            >
              Guardar cambios en perfil
            </Button>
          </Form>
        </Card.Body>
      </Card>
      <ProfileSettings />

      {/* Modal Éxito */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Perfecto!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>
            Continuar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Error */}
      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Atención!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClientDashboard;