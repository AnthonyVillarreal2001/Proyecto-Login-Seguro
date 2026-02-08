import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import axios from 'axios';
import { Alert, Button, Card, Form, Modal, Spinner, ProgressBar, Badge } from 'react-bootstrap';

const ProfileSettings = () => {
  const [biometricStatus, setBiometricStatus] = useState({
    hasBiometric: false,
    isUnique: true,
    duplicateCount: 0,
    registeredAt: null,
    loading: true
  });
  const [loadingBiometric, setLoadingBiometric] = useState(false);
  const [password, setPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [detectionMessage, setDetectionMessage] = useState('');
  const [actionType, setActionType] = useState(''); // 'register', 'update', 'delete'
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchBiometricStatus();
  }, []);

  const fetchBiometricStatus = async () => {
    try {
      const res = await axios.get('/profile/face-unique');
      setBiometricStatus({
        hasBiometric: res.data.hasBiometric,
        isUnique: res.data.isUnique || true,
        duplicateCount: res.data.duplicateCount || 0,
        registeredAt: res.data.registeredAt,
        loading: false
      });
    } catch (err) {
      // Si el endpoint no existe, hacer fallback a la vieja forma
      try {
        const res = await axios.get('/profile');
        setBiometricStatus({
          hasBiometric: !!res.data.preferences?.faceEmbedding,
          isUnique: true,
          duplicateCount: 0,
          registeredAt: res.data.preferences?.faceRegisteredAt,
          loading: false
        });
      } catch (fallbackErr) {
        console.error('Error cargando estado biométrico:', fallbackErr);
        setBiometricStatus({
          hasBiometric: false,
          isUnique: true,
          duplicateCount: 0,
          registeredAt: null,
          loading: false
        });
      }
    }
  };

  const loadModels = async () => {
    try {
      setDetectionMessage('Cargando modelos de IA...');
      setDetectionProgress(20);
      
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      
      setDetectionProgress(40);
      setDetectionMessage('Modelos cargados correctamente');
      
    } catch (err) {
      throw new Error('No se pudieron cargar los modelos de IA.');
    }
  };

  const startCamera = async () => {
    try {
      setDetectionMessage('Iniciando cámara...');
      setDetectionProgress(50);
      
      const constraints = {
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setDetectionProgress(70);
        setDetectionMessage('Cámara activa. Posiciona tu rostro...');
      }
    } catch (err) {
      let errorMsg = 'No se pudo acceder a la cámara. ';
      if (err.name === 'NotAllowedError') {
        errorMsg += 'Permiso denegado. Por favor, permite el acceso a la cámara.';
      } else if (err.name === 'NotFoundError') {
        errorMsg += 'No se encontró cámara.';
      } else {
        errorMsg += 'Error: ' + err.message;
      }
      throw new Error(errorMsg);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => {
        track.stop();
        track.enabled = false;
      });
      videoRef.current.srcObject = null;
    }
  };

  const handleBiometricAction = async () => {
    if (!password.trim()) {
      setModalMessage('Ingresa tu contraseña para confirmar.');
      setShowErrorModal(true);
      return;
    }

    setLoadingBiometric(true);
    setShowCameraModal(true);
    
    try {
      await startCamera();
      await loadModels();

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDetectionProgress(80);
      setDetectionMessage(`${actionType === 'update' ? 'Actualizando' : 'Registrando'} rostro...`);

      let detection = null;
      let attempts = 0;
      
      while (!detection && attempts < 3) {
        detection = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor();
          
        if (detection) break;
        
        attempts++;
        setDetectionMessage(`Intento ${attempts}/3 - Ajusta tu posición...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!detection) {
        throw new Error('No se detectó ningún rostro. Asegúrate de estar bien iluminado.');
      }

      setDetectionProgress(90);
      setDetectionMessage('Verificando unicidad...');

      const embedding = Array.from(detection.descriptor);
      
      // Verificar unicidad siempre (registro o actualización) para el usuario logueado
      try {
        const token = localStorage.getItem('token');
        const currentUserId = token ? JSON.parse(atob(token.split('.')[1])).id : null;
        const checkRes = await axios.post('/auth/check-face-unique', { 
          embedding, 
          currentUserId 
        });
        
        if (checkRes.data.isDuplicate) {
          const duplicateAccounts = checkRes.data.duplicateUsers || [];
          throw new Error(
            `Este rostro ya está registrado en ${duplicateAccounts.length} cuenta(s). ` +
            `Cada persona debe tener una cuenta única.`
          );
        }
      } catch (checkErr) {
        console.log('API de verificación no disponible:', checkErr.message);
      }

      await axios.post('/profile/save-face-embedding', { 
        embedding, 
        password 
      });

      await fetchBiometricStatus();
      
      setModalMessage(
        actionType === 'update' 
          ? '✅ Rostro actualizado exitosamente!'
          : '✅ Rostro registrado exitosamente! Ahora puedes usar login biométrico.'
      );
      setShowSuccessModal(true);
      
    } catch (err) {
      setModalMessage(err.message || 'Error al procesar el rostro.');
      setShowErrorModal(true);
    } finally {
      setLoadingBiometric(false);
      setDetectionProgress(0);
      setDetectionMessage('');
      stopCamera();
      setTimeout(() => {
        setShowCameraModal(false);
        setPassword('');
      }, 500);
    }
  };

  const handleRemoveBiometric = async () => {
    if (!password.trim()) {
      setModalMessage('Ingresa tu contraseña para confirmar la eliminación.');
      setShowErrorModal(true);
      return;
    }

    try {
      await axios.delete('/profile/biometric', { 
        data: { password } 
      });
      await fetchBiometricStatus();
      setPassword('');
      setModalMessage('✅ Biometría eliminada correctamente. Ya no podrás usar login facial.');
      setShowSuccessModal(true);
      setShowDeleteModal(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al eliminar biometría. Verifica tu contraseña.';
      setModalMessage(errorMsg);
      setShowErrorModal(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No disponible';
    return new Date(dateString).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (biometricStatus.loading) {
    return (
      <Card className="mt-4 shadow-sm">
        <Card.Header className="bg-primary text-white">
          <h5 className="mb-0">Gestión de Biometría Facial</h5>
        </Card.Header>
        <Card.Body className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Cargando estado biométrico...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mt-4 shadow-sm">
      <Card.Header className="bg-primary text-white">
        <h5 className="mb-0">Gestión de Biometría Facial</h5>
      </Card.Header>
      <Card.Body>
        {biometricStatus.hasBiometric ? (
          <div>
            <Alert variant={biometricStatus.isUnique ? "success" : "danger"}>
              <Alert.Heading>
                {biometricStatus.isUnique ? '✅ Rostro Registrado' : '⚠️ Problema Detectado'}
              </Alert.Heading>
              <p>
                {biometricStatus.isUnique 
                  ? 'Tu rostro está registrado y verificado como único en el sistema.'
                  : `ALERTA: Tu rostro está registrado en ${biometricStatus.duplicateCount} cuenta(s) adicional(es).`
                }
                <br />
                <small className="text-muted">
                  Fecha de registro: {formatDate(biometricStatus.registeredAt)}
                </small>
              </p>
              {!biometricStatus.isUnique && (
                <p className="mb-0">
                  <strong>Acción requerida:</strong> Contacta al administrador para resolver este problema.
                </p>
              )}
            </Alert>
            
            <div className="row mb-3">
              <div className="col-md-6">
                <Form.Group>
                  <Form.Label>
                    <strong>Contraseña actual para modificar</strong>
                  </Form.Label>
                  <Form.Control 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Ingresa tu contraseña" 
                  />
                  <Form.Text className="text-muted">
                    Requerida por seguridad para modificar tu biometría.
                  </Form.Text>
                </Form.Group>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <div>
                  <Button 
                    variant="outline-primary" 
                    className="me-2"
                    onClick={() => {
                      if (!password.trim()) {
                        setModalMessage('Primero ingresa tu contraseña.');
                        setShowErrorModal(true);
                        return;
                      }
                      setActionType('update');
                      setShowUpdateModal(true);
                    }}
                    disabled={!password.trim() || !biometricStatus.isUnique}
                  >
                    🔄 Actualizar mi rostro
                  </Button>
                  
                  <Button 
                    variant="outline-danger"
                    onClick={() => {
                      if (!password.trim()) {
                        setModalMessage('Primero ingresa tu contraseña.');
                        setShowErrorModal(true);
                        return;
                      }
                      setShowDeleteModal(true);
                    }}
                    disabled={!password.trim()}
                  >
                    🗑️ Eliminar mi rostro
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="mt-3">
              <small className="text-muted">
                <strong>Nota:</strong> Actualizar tu rostro reemplazará el registro anterior.
                Solo debes hacerlo si tu apariencia ha cambiado significativamente.
              </small>
            </div>
          </div>
        ) : (
          <div>
            <Alert variant="info">
              <Alert.Heading>🔒 Registro Biométrico Requerido</Alert.Heading>
              <p>
                Registra tu rostro para poder iniciar sesión de forma rápida y segura.
                <br />
                <small className="text-muted">
                  <strong>Importante:</strong> Cada rostro solo puede estar registrado en una cuenta.
                </small>
              </p>
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>
                <strong>Contraseña actual para registrar</strong>
              </Form.Label>
              <Form.Control 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Ingresa tu contraseña para confirmar" 
              />
              <Form.Text className="text-muted">
                Requerida por seguridad para registrar tu rostro.
              </Form.Text>
            </Form.Group>
            
            <Button 
              variant="primary" 
              onClick={() => {
                if (!password.trim()) {
                  setModalMessage('Primero ingresa tu contraseña.');
                  setShowErrorModal(true);
                  return;
                }
                setActionType('register');
                setShowCameraModal(true);
              }}
              disabled={!password.trim()}
            >
              📷 Registrar mi rostro
            </Button>
          </div>
        )}
      </Card.Body>

      {/* Modal de cámara */}
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
          <Modal.Title>
            {actionType === 'update' ? '🔄 Actualizar Rostro' : '📷 Registrar Rostro'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Alert variant={actionType === 'update' ? "warning" : "info"}>
            {actionType === 'update' 
              ? 'Estás a punto de actualizar tu rostro registrado. El anterior será reemplazado.'
              : 'Estás a punto de registrar tu rostro. Verificaremos que sea único en el sistema.'
            }
          </Alert>
          
          <div className="mb-3">
            <ProgressBar 
              now={detectionProgress} 
              label={`${detectionProgress}%`} 
              variant="primary" 
              animated 
            />
          </div>
          
          <p className={detectionMessage ? 'text-primary fw-bold' : 'text-muted'}>
            {detectionMessage || 'Preparando cámara...'}
          </p>
          
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              style={{ 
                width: '100%', 
                maxWidth: '500px',
                borderRadius: '8px', 
                border: '3px solid #007bff',
                transform: 'scaleX(-1)'
              }} 
            />
            <canvas 
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            />
          </div>
          
          <div className="mt-3">
            <small className="text-muted">
              📍 Mantén tu rostro centrado<br />
              👁️ Mira directamente a la cámara 3 segundos<br />
              💡 Asegura buena iluminación frontal
            </small>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowCameraModal(false);
              stopCamera();
            }}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleBiometricAction}
            disabled={loadingBiometric}
          >
            {loadingBiometric ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Procesando...
              </>
            ) : actionType === 'update' ? (
              '🔄 Actualizar Rostro'
            ) : (
              '📷 Registrar Rostro'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de confirmación para actualizar */}
      <Modal show={showUpdateModal} onHide={() => setShowUpdateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🔄 Confirmar Actualización</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Estás seguro de que quieres actualizar tu rostro registrado?</p>
          <ul>
            <li>El rostro anterior será reemplazado</li>
            <li>Deberás usar el nuevo rostro para login biométrico</li>
            <li>Se verificará que el nuevo rostro sea único</li>
          </ul>
          <p className="text-warning">
            <strong>Fecha de registro actual:</strong> {formatDate(biometricStatus.registeredAt)}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUpdateModal(false)}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={() => {
            setShowUpdateModal(false);
            setShowCameraModal(true);
          }}>
            Sí, actualizar mi rostro
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de confirmación para eliminar */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Confirmar Eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Estás seguro de que quieres eliminar tu biometría facial?</p>
          <ul>
            <li>No podrás usar reconocimiento facial para login</li>
            <li>Deberás usar contraseña siempre</li>
            <li>Esta acción no se puede deshacer</li>
          </ul>
          <p className="text-danger">
            <strong>Contraseña ingresada:</strong> ••••••••
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleRemoveBiometric}>
            Sí, eliminar mi rostro
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modales de éxito/error */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>✅ Éxito</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎉</div>
            <p>{modalMessage}</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>
            Continuar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>❌ Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
            <p>{modalMessage}</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default ProfileSettings;