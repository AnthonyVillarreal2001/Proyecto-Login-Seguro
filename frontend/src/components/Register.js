import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Button, Card, Form, Modal, Spinner } from 'react-bootstrap';

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
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [registerStep, setRegisterStep] = useState('form'); // 'form' o 'face'
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const navigate = useNavigate();

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    } catch (err) {
      throw new Error('No se pudieron cargar los modelos de IA.');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setModalMessage('No se pudo acceder a la cámara. Revisa permisos.');
      setShowErrorModal(true);
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureFace = async () => {
    setLoading(true);
    try {
      await loadModels();

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No se detectó rostro. Asegúrate de estar bien iluminado y centrado.');
      }

      const embedding = Array.from(detection.descriptor);
      setFaceEmbedding(embedding);
      
      setModalMessage('¡Rostro capturado exitosamente! Completando registro...');
      setShowSuccessModal(true);
      
      // Proceder con el registro completo
      await completeRegistration(embedding);
      
    } catch (err) {
      setModalMessage(err.message || 'Error al capturar el rostro.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
      stopCamera();
      setShowCameraModal(false);
    }
  };

  const completeRegistration = async (embedding) => {
    try {
      await axios.post('/auth/public-register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        embedding: embedding
      });

      setModalMessage('¡Registro biométrico completado! Ahora puedes iniciar sesión.');
      setShowSuccessModal(true);

      setTimeout(() => {
        navigate('/login');
      }, 2200);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al completar el registro.';
      setModalMessage(msg);
      setShowErrorModal(true);
    }
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

    // Mostrar modal de cámara para capturar rostro
    setShowCameraModal(true);
    await startCamera();
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card style={{ maxWidth: '500px', width: '100%' }} className="shadow-lg">
        <Card.Header className="bg-success text-white text-center">
          <h3 className="mb-0">Registro Biométrico Obligatorio</h3>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre completo *</Form.Label>
              <Form.Control
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Anthony Nestor"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Correo electrónico *</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@correo.com"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Contraseña *</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
                required
              />
              <Form.Text className="text-muted">
                La contraseña es necesaria para verificación adicional
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Confirmar contraseña *</Form.Label>
              <Form.Control
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Repite tu contraseña"
                required
              />
            </Form.Group>

            <div className="d-grid">
              <Button type="submit" variant="success" size="lg" disabled={loading}>
                {loading ? 'Procesando...' : 'Continuar con registro facial'}
              </Button>
            </div>
          </Form>

          <p className="text-center mt-3">
            ¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a>
          </p>
          <p className="text-center text-muted small">
            * El registro facial es obligatorio para mayor seguridad
          </p>
        </Card.Body>
      </Card>

      {/* Modal de cámara para captura facial */}
      <Modal
        show={showCameraModal}
        onHide={() => {
          setShowCameraModal(false);
          stopCamera();
        }}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Registro Facial Obligatorio</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p className="mb-3">
            <strong>Paso 2 de 2: Captura de rostro</strong>
            <br />
            Por seguridad, debemos registrar tu rostro. Colócate frente a la cámara.
          </p>
          
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{
              width: '100%',
              maxHeight: '400px',
              borderRadius: '12px',
              border: '4px solid #28a745',
              background: '#000'
            }}
          />
          
          <div className="mt-4">
            <Button 
              variant="primary" 
              size="lg" 
              onClick={captureFace}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Capturando rostro...
                </>
              ) : (
                '✅ Capturar mi rostro'
              )}
            </Button>
          </div>
          
          <div className="mt-3 text-muted small">
            <p>Requisitos:</p>
            <ul className="list-unstyled">
              <li>✓ Buena iluminación</li>
              <li>✓ Rostro centrado en cámara</li>
              <li>✓ Sin lentes oscuros</li>
              <li>✓ Sin gorras/sombreros</li>
            </ul>
          </div>
        </Modal.Body>
      </Modal>

      {/* Modales de éxito/error */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Éxito!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
      </Modal>

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