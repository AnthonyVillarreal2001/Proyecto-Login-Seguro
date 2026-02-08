import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Button, Card, Form, Modal, Spinner, Alert } from 'react-bootstrap';

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
  const [livenessStatus, setLivenessStatus] = useState('Esperando cámara...');
  const [blinkCount, setBlinkCount] = useState(0);
  const [livenessLog, setLivenessLog] = useState([]);
  const [livenessStep, setLivenessStep] = useState(0);
  const videoRef = useRef(null);
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const navigate = useNavigate();

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const livenessSequence = [
    { key: 'turn_right', label: 'Gira la cabeza a la derecha' },
    { key: 'turn_left', label: 'Gira la cabeza a la izquierda' },
    { key: 'smile', label: 'Sonríe ampliamente' },
  ];

  const ensureLiveness = async () => {
    const timeoutMs = 12000;
    const start = Date.now();
    let step = 0;
    setLivenessStep(0);
    setBlinkCount(0);
    let lastNoseX = null;
    let movementAccum = 0;
    let stepFrames = 0;

    while (Date.now() - start < timeoutMs && step < livenessSequence.length) {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detection?.landmarks) {
        const box = detection.detection.box;
        const centerX = box.x + box.width / 2;
        const nose = detection.landmarks.getNose()[3];
        const mouth = detection.landmarks.getMouth();
        stepFrames += 1;

        const yawRight = nose.x - centerX > box.width * 0.1;
        const yawLeft = centerX - nose.x > box.width * 0.1;

        if (lastNoseX !== null) {
          movementAccum += Math.abs(nose.x - lastNoseX);
        }
        lastNoseX = nose.x;

        const mouthWidth = Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y);
        const mouthHeight = Math.hypot(mouth[3].x - mouth[9].x, mouth[3].y - mouth[9].y) || 1;
        const smileScore = (detection.expressions?.happy || 0) + mouthWidth / mouthHeight;

        const current = livenessSequence[step].key;

        if (current === 'turn_right' && yawRight && movementAccum > box.width * 0.15 && stepFrames >= 2) {
          logLiveness('Giro a la derecha detectado ✅');
          step += 1;
          setLivenessStep(step);
          movementAccum = 0;
          stepFrames = 0;
        } else if (current === 'turn_left' && yawLeft) {
          logLiveness('Giro a la izquierda detectado ✅');
          step += 1;
          setLivenessStep(step);
          movementAccum = 0;
          stepFrames = 0;
        } else if (current === 'smile' && smileScore > 2.8) {
          logLiveness('Sonrisa detectada ✅');
          step += 1;
          setLivenessStep(step);
          movementAccum = 0;
          stepFrames = 0;
        } else {
          logLiveness(`Mantén la acción: ${livenessSequence[step].label}`);
        }
      } else {
        logLiveness('Buscando rostro...');
      }

      await wait(220);
    }

    if (step < livenessSequence.length) {
      logLiveness('No se completó la secuencia de vida ❌');
      throw new Error('No se completaron las acciones de vida (girar y sonreír).');
    }
  };

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    } catch (err) {
      throw new Error('No se pudieron cargar los modelos de IA.');
    }
  };

  const logLiveness = (msg) => {
    setLivenessStatus(msg);
    setLivenessLog((prev) => [...prev.slice(-4), msg]);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLivenessStatus('Cámara activa. Busca ojos...');
      setBlinkCount(0);
      setLivenessLog([]);
      setLivenessStep(0);
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
    setLivenessStatus('Cámara detenida');
  };

  const captureFace = async () => {
    setLoading(true);
    try {
      await loadModels();

      await ensureLiveness();

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('No se detectó rostro. Asegúrate de estar bien iluminado y centrado.');
      }

      const embedding = Array.from(detection.descriptor);
      
      // ✅ NUEVO: Validar calidad del embedding antes de proceder
      if (embedding.length !== 128 && embedding.length !== 512) {
        throw new Error('Captura facial inválida. Por favor, intenta nuevamente.');
      }
      
      // ✅ NUEVO: Verificar si este rostro ya existe ANTES de registrar
      try {
        const checkRes = await axios.post('/auth/check-face-unique', {
          embedding,
          currentUserId: null // No tenemos userId aún porque estamos registrando
        });
        
        if (checkRes.data.isDuplicate) {
          const duplicateEmail = checkRes.data.duplicateUsers?.[0]?.email || 'otra cuenta';
          throw new Error(`Este rostro ya está registrado en ${duplicateEmail}. Cada persona debe tener una cuenta única.`);
        }
      } catch (checkErr) {
        // Si la API no existe, continuar sin validación (backward compatibility)
        console.log('API de verificación no disponible:', checkErr.message);
      }

      setFaceEmbedding(embedding);
      
      setModalMessage('✅ Rostro verificado como único. Completando registro...');
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
          <Modal.Title>⚠️ Registro Facial Único Obligatorio</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Alert variant="warning" className="text-start">
            <Alert.Heading>¡Importante!</Alert.Heading>
            <p>
              <strong>Cada rostro solo puede estar registrado en una cuenta.</strong>
              <br />
              Si ya tienes una cuenta, inicia sesión en lugar de registrarte nuevamente.
            </p>
            <hr />
            <p className="mb-0 small">
              El sistema verificará que este rostro no esté ya registrado.
              Intentar registrar el mismo rostro en múltiples cuentas será rechazado.
            </p>
          </Alert>
          
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
              border: '4px solid #dc3545',
              background: '#000'
            }}
          />

          <div className="mt-3 text-start">
            <p className="mb-1"><strong>Estado liveness:</strong> {livenessStatus}</p>
            <p className="mb-2 small text-muted">Paso {Math.min(livenessStep + 1, livenessSequence.length)} de {livenessSequence.length}: {livenessSequence[Math.min(livenessStep, livenessSequence.length - 1)].label}</p>
            <div className="small">
              <div className="fw-bold">Logs recientes:</div>
              <ul className="mb-0 ps-3">
                {livenessLog.length === 0 && <li>Sin eventos aún</li>}
                {livenessLog.map((msg, idx) => (
                  <li key={`${msg}-${idx}`}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-4">
            <Button 
              variant="danger" 
              size="lg" 
              onClick={captureFace}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Verificando unicidad...
                </>
              ) : (
                '🔍 Verificar y registrar mi rostro único'
              )}
            </Button>
          </div>
          
          <div className="mt-3 text-muted small">
            <p><strong>Requisitos estrictos:</strong></p>
            <ul className="list-unstyled">
              <li>✓ <strong>Cada rostro solo puede tener UNA cuenta</strong></li>
              <li>✓ Buena iluminación frontal</li>
              <li>✓ Rostro centrado y visible completamente</li>
              <li>✓ Sin lentes oscuros o gorras</li>
              <li>✓ Expresión neutra, mirando a la cámara</li>
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