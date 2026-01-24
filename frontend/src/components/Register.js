import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button, Card, Form, Modal } from 'react-bootstrap';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setModalMessage('Las contraseñas no coinciden.');
      setShowErrorModal(true);
      return;
    }

    if (formData.password.length < 8) {
      setModalMessage('La contraseña debe tener al menos 8 caracteres.');
      setShowErrorModal(true);
      return;
    }

    try {
      await axios.post('/auth/public-register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password
      });

      setModalMessage('¡Registro exitoso! Ahora puedes iniciar sesión.');
      setShowSuccessModal(true);

      setTimeout(() => {
        navigate('/login');
      }, 2200);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrarte. Intenta de nuevo.';
      setModalMessage(msg);
      setShowErrorModal(true);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card style={{ maxWidth: '500px', width: '100%' }} className="shadow-lg">
        <Card.Header className="bg-success text-white text-center">
          <h3 className="mb-0">Crear Cuenta</h3>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre completo</Form.Label>
              <Form.Control
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej: Anthony Nestor"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Correo electrónico</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="tu@correo.com"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Confirmar contraseña</Form.Label>
              <Form.Control
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repite tu contraseña"
                required
              />
            </Form.Group>

            <div className="d-grid">
              <Button type="submit" variant="success" size="lg">
                Registrarme
              </Button>
            </div>
          </Form>

          <p className="text-center mt-3">
            ¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a>
          </p>
        </Card.Body>
      </Card>

      {/* Modal éxito */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Bienvenido!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
      </Modal>

      {/* Modal error */}
      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Atención!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
      </Modal>
    </div>
  );
};

export default Register;