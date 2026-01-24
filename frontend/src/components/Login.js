import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Button, Form, Modal } from 'react-bootstrap';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const navigate = useNavigate();

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    } catch (err) {
      throw new Error('No se pudieron cargar los modelos de IA. Revisa tu conexión o los archivos en /public/models.');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setModalMessage('No se pudo acceder a la cámara. Revisa permisos.');
      setShowErrorModal(true);
      setShowBiometricModal(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email.trim()) {
      setModalMessage('¡Primero ingresa tu correo, por favor! 📧');
      setShowErrorModal(true);
      return;
    }

    try {
      const res = await axios.post('/auth/login', { email, fallbackPassword: password });
      localStorage.setItem('token', res.data.token);
      setModalMessage('¡Login exitoso con contraseña! Bienvenido de vuelta. 🎉');
      setShowSuccessModal(true);

      setTimeout(() => {
        const role = JSON.parse(atob(res.data.token.split('.')[1])).role;
        navigate(role === 'admin' ? '/admin' : '/client');
      }, 1800);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión. ¿Credenciales correctas?';
      setModalMessage(msg);
      setShowErrorModal(true);
    }
  };

  const handleBiometricLogin = async () => {
    if (!email.trim()) {
      setModalMessage('¡Necesitas ingresar tu correo primero para usar biometría! 🧐');
      setShowErrorModal(true);
      return;
    }

    setShowBiometricModal(true);
    await startCamera();

    // Iniciar detección después de 1.5–2 segundos
    setTimeout(async () => {
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
        const res = await axios.post('/auth/biometric/login', { email, embedding });

        localStorage.setItem('token', res.data.token);
        setModalMessage('¡Reconocido! Login biométrico exitoso. 😎');
        setShowSuccessModal(true);
        setShowBiometricModal(false);
        stopCamera();

        setTimeout(() => {
          const role = JSON.parse(atob(res.data.token.split('.')[1])).role;
          navigate(role === 'admin' ? '/admin' : '/client');
        }, 1500);
      } catch (err) {
        setModalMessage(err.message || 'No se pudo reconocer tu rostro.');
        setShowErrorModal(true);
        setShowBiometricModal(false);
        stopCamera();
      }
    }, 1800);
  };

  return (
    <div className="container mt-5" style={{ maxWidth: '500px' }}>
      <h2 className="text-center mb-4">Iniciar Sesión</h2>

      <Form>
        <Form.Group className="mb-3">
          <Form.Label>Correo electrónico</Form.Label>
          <Form.Control
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value.trim())}
            placeholder="tu@email.com"
            aria-label="Correo electrónico"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Contraseña (opcional)</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-label="Contraseña"
          />
        </Form.Group>

        <div className="d-grid gap-2">
          <Button variant="primary" size="lg" onClick={handlePasswordLogin}>
            Iniciar con contraseña
          </Button>
          <Button variant="success" size="lg" onClick={handleBiometricLogin}>
            Iniciar con rostro (biometría)
          </Button>
        </div>
      </Form>

      <p className="text-center mt-3">
        ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
      </p>

      {/* Modal para login biométrico */}
      <Modal
        show={showBiometricModal}
        onHide={() => {
          setShowBiometricModal(false);
          stopCamera();
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Reconocimiento Facial</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p className="mb-3">Coloca tu rostro frente a la cámara y espera un momento...</p>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowBiometricModal(false);
            stopCamera();
          }}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Modal de Éxito */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Éxito!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>
            Continuar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Error */}
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

export default Login;