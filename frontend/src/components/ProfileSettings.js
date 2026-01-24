import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import axios from 'axios';
import { Alert, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';

const ProfileSettings = () => {
  const [hasBiometric, setHasBiometric] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get('/profile');
        setHasBiometric(!!res.data.preferences?.faceEmbedding);
      } catch (err) {
        setModalMessage('No se pudo cargar el perfil. ¿Sesión expirada?');
        setShowErrorModal(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
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

  const handleRegisterBiometric = async () => {
    if (!password.trim()) {
      setModalMessage('Ingresa tu contraseña para confirmar.');
      setShowErrorModal(true);
      return;
    }

    setShowCameraModal(true);
    await startCamera();

    // Iniciar detección automática después de 1.5 segundos
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
        await axios.post('/profile/save-face-embedding', { embedding, password });

        setHasBiometric(true);
        setModalMessage('¡Rostro registrado exitosamente! Ahora puedes usarlo para login.');
        setShowSuccessModal(true);
        setShowCameraModal(false);
        stopCamera();
      } catch (err) {
        setModalMessage(err.message || 'Error al registrar el rostro.');
        setShowErrorModal(true);
        setShowCameraModal(false);
        stopCamera();
      }
    }, 1500);
  };

  const handleRemoveBiometric = async () => {
    if (!password.trim()) {
      setModalMessage('Ingresa tu contraseña para confirmar.');
      setShowErrorModal(true);
      return;
    }

    try {
      await axios.delete('/profile/biometric', { data: { password } });
      setHasBiometric(false);
      setModalMessage('Biometría eliminada correctamente.');
      setShowSuccessModal(true);
    } catch (err) {
      setModalMessage(err.response?.data?.error || 'Error al eliminar biometría.');
      setShowErrorModal(true);
    }
  };

  return (
    <Card className="mt-4 shadow-sm">
      <Card.Header>Biometría Facial</Card.Header>
      <Card.Body>
        {loading ? <Spinner animation="border" /> : hasBiometric ? (
          <div>
            <p>Rostro registrado.</p>
            <Form.Group className="mb-3">
              <Form.Label>Contraseña para confirmar eliminación</Form.Label>
              <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirma" aria-label="Contraseña para eliminar" />
            </Form.Group>
            <Button variant="danger" onClick={handleRemoveBiometric}>Eliminar</Button>
          </div>
        ) : (
          <div>
            <p>Registra rostro.</p>
            <Form.Group className="mb-3">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirma" aria-label="Contraseña para registrar" />
            </Form.Group>
            <Button variant="primary" onClick={handleRegisterBiometric}>Registrar</Button>
          </div>
        )}
      </Card.Body>

      {/* Modal de cámara para registro */}
      <Modal show={showCameraModal} onHide={() => { setShowCameraModal(false); stopCamera(); }} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Registrando tu Rostro</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p>Mantén tu rostro centrado y bien iluminado. ¡Estamos capturando!</p>
          <video ref={videoRef} autoPlay muted style={{ width: '100%', borderRadius: '8px', border: '2px solid #007bff' }} />
        </Modal.Body>
      </Modal>

      {/* Modales de éxito/error (iguales que antes) */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>¡Éxito!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
      </Modal>

      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>¡Error!</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
      </Modal>
    </Card>
  );
};

export default ProfileSettings;