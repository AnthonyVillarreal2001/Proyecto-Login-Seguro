import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Button, Form, Modal, Spinner, Card } from 'react-bootstrap';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [loginStep, setLoginStep] = useState('credentials'); // 'credentials' o 'face'
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  // Verificar si venimos de logout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reason = urlParams.get('reason');
    
    if (reason) {
      let message = '';
      switch(reason) {
        case 'timeout':
        case 'Sesión cerrada por inactividad':
          message = 'Tu sesión se cerró por inactividad. Por seguridad, vuelve a iniciar sesión.';
          break;
        case 'expired':
          message = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
          break;
        default:
          message = reason;
      }
      
      setModalMessage(message);
      setShowErrorModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
      setShowFaceModal(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setModalMessage('Email y contraseña son obligatorios');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/auth/login', { 
        email, 
        password // Enviar solo 'password', no 'fallbackPassword'
      });

      console.log('Respuesta del login:', res.data); // Para debug

      // Si el login requiere verificación facial
      if (res.data.requiresFaceVerification) {
        setModalMessage('Contraseña válida. Ahora verifique su identidad facial.');
        setShowSuccessModal(true);
        
        // Mostrar modal de verificación facial
        setTimeout(() => {
          setShowFaceModal(true);
          startCamera();
        }, 1500);
        
      } else if (res.data.token) {
        // Si por alguna razón devuelve token directamente (backward compatibility)
        localStorage.setItem('token', res.data.token);
        const role = JSON.parse(atob(res.data.token.split('.')[1])).role;
        navigate(role === 'admin' ? '/admin' : '/client');
      } else {
        throw new Error('Respuesta inesperada del servidor');
      }
      
    } catch (err) {
      console.error('Error completo en login:', err.response || err);
      
      // Manejar diferentes tipos de errores
      if (err.response) {
        const { status, data } = err.response;
        
        if (status === 400 && data.errors) {
          // Error de validación
          const validationErrors = data.errors.map(e => e.msg).join(', ');
          setModalMessage(`Error de validación: ${validationErrors}`);
        } else if (status === 403 && data.requiresBiometric) {
          // Usuario no tiene biometría registrada
          setModalMessage(data.error || 'Debe registrar su biometría facial primero.');
        } else {
          // Otros errores
          setModalMessage(data.error || 'Error al iniciar sesión');
        }
      } else if (err.request) {
        setModalMessage('No hay respuesta del servidor. Verifica que el backend esté corriendo.');
      } else {
        setModalMessage(err.message || 'Error desconocido');
      }
      
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const verifyFace = async () => {
    setLoading(true);
    try {
      await loadModels();

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No se detectó rostro. Asegúrate de estar bien iluminado.');
      }

      const embedding = Array.from(detection.descriptor);
      
      // Enviar para verificación
      const res = await axios.post('/auth/verify-face', { 
        email, 
        embedding 
      });

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        setModalMessage('¡Verificación facial exitosa! Bienvenido.');
        setShowSuccessModal(true);
        
        // Detener cámara
        stopCamera();
        setShowFaceModal(false);
        
        // Redirigir después de mostrar mensaje
        setTimeout(() => {
          const role = JSON.parse(atob(res.data.token.split('.')[1])).role;
          navigate(role === 'admin' ? '/admin' : '/client');
        }, 1500);
      }
      
    } catch (err) {
      setModalMessage(err.response?.data?.error || 'Error en verificación facial');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card style={{ maxWidth: '500px', width: '100%' }} className="shadow-lg">
        <Card.Header className="bg-primary text-white text-center">
          <h3 className="mb-0">Inicio de Sesión Biométrico</h3>
        </Card.Header>
        <Card.Body>
          <p className="text-center text-muted mb-4">
            Por seguridad, el inicio de sesión requiere verificación facial obligatoria
          </p>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Correo electrónico *</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value.trim())}
                placeholder="tu@email.com"
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Contraseña *</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </Form.Group>

            <div className="d-grid">
              <Button 
                variant="primary" 
                size="lg" 
                onClick={handlePasswordLogin}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Verificando...
                  </>
                ) : (
                  '🔐 Verificar credenciales y continuar'
                )}
              </Button>
            </div>
          </Form>

          <p className="text-center mt-3">
            ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
          </p>
          <p className="text-center text-muted small">
            * Después de ingresar email y contraseña, se requerirá verificación facial
          </p>
        </Card.Body>
      </Card>

      {/* Modal para verificación facial */}
      <Modal
        show={showFaceModal}
        onHide={() => {
          setShowFaceModal(false);
          stopCamera();
        }}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Verificación Facial Obligatoria</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p className="mb-3">
            <strong>Paso 2 de 2: Verificación de identidad</strong>
            <br />
            Por seguridad, debemos verificar que eres tú. Mira directamente a la cámara.
          </p>
          
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{
              width: '100%',
              maxHeight: '400px',
              borderRadius: '12px',
              border: '4px solid #007bff',
              background: '#000'
            }}
          />
          
          <div className="mt-4">
            <Button 
              variant="success" 
              size="lg" 
              onClick={verifyFace}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Verificando rostro...
                </>
              ) : (
                '✅ Verificar mi identidad'
              )}
            </Button>
          </div>
          
          <div className="mt-3 text-muted small">
            <p>Instrucciones:</p>
            <ul className="list-unstyled">
              <li>✓ Mantén tu rostro centrado</li>
              <li>✓ Asegura buena iluminación</li>
              <li>✓ No muevas la cabeza bruscamente</li>
              <li>✓ Permanece frente a la cámara 2-3 segundos</li>
            </ul>
          </div>
        </Modal.Body>
      </Modal>

      {/* Modales de éxito/error */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¡Proceso completado!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>
            Continuar
          </Button>
        </Modal.Footer>
      </Modal>

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