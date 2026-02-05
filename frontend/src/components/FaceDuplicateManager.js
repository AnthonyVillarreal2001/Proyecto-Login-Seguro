// frontend/src/components/FaceDuplicateManager.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Table, Alert, Badge, Modal, Spinner } from 'react-bootstrap';

const FaceDuplicateManager = () => {
    const [duplicates, setDuplicates] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedDuplicate, setSelectedDuplicate] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchDuplicates();
    }, []);

    const fetchDuplicates = async () => {
        try {
        const res = await axios.get('/admin/face-duplicates');
        setDuplicates(res.data.duplicates || []);
        setClusters(res.data.clusters || []);
        } catch (err) {
        console.error('Error fetching duplicates:', err);
        } finally {
        setLoading(false);
        }
    };

    const handleForceRemoveFace = async (userId) => {
        setActionLoading(true);
        try {
        await axios.delete(`/admin/users/${userId}/force-remove-face`);
        setModalMessage(`Biometría eliminada forzosamente del usuario ${userId}`);
        setShowSuccessModal(true);
        fetchDuplicates(); // Refrescar lista
        } catch (err) {
        setModalMessage('Error al eliminar biometría: ' + (err.response?.data?.error || err.message));
        setShowErrorModal(true);
        } finally {
        setActionLoading(false);
        setShowConfirmModal(false);
        }
    };

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    if (loading) {
        return (
        <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-2">Buscando rostros duplicados...</p>
        </div>
        );
    }

    return (
        <Card className="mt-4 shadow-sm border-danger">
        <Card.Header className="bg-danger text-white">
            <h5 className="mb-0">⚠️ Gestión de Rostros Duplicados</h5>
        </Card.Header>
        <Card.Body>
            {duplicates.length === 0 ? (
            <Alert variant="success">
                <Alert.Heading>✅ No se encontraron rostros duplicados</Alert.Heading>
                <p>
                Todos los rostros registrados en el sistema son únicos.
                <br />
                <small className="text-muted">
                    Total de usuarios con biometría: {duplicates.length > 0 ? duplicates[0]?.usersWithBiometric || 0 : 0}
                </small>
                </p>
            </Alert>
            ) : (
            <>
                <Alert variant="warning">
                <Alert.Heading>¡ALERTA DE SEGURIDAD!</Alert.Heading>
                <p>
                    Se encontraron <strong>{duplicates.length}</strong> pares de rostros duplicados 
                    agrupados en <strong>{clusters.length}</strong> clusters.
                </p>
                <hr />
                <p className="mb-0">
                    <strong>Acción requerida:</strong> Investigar y eliminar biometrías duplicadas.
                </p>
                </Alert>

                <h6>Clusters de rostros similares:</h6>
                {clusters.map((cluster, idx) => (
                <Card key={idx} className="mb-3 border-warning">
                    <Card.Header className="bg-warning text-dark">
                    <strong>Cluster #{idx + 1}</strong> - Similitud: {(cluster.similarity * 100).toFixed(1)}%
                    </Card.Header>
                    <Card.Body>
                    <Table striped bordered hover size="sm">
                        <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Email</th>
                            <th>Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        {cluster.users.map((user, userIdx) => (
                            <tr key={user.id}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>
                                <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => {
                                    setSelectedDuplicate(user);
                                    setShowConfirmModal(true);
                                }}
                                disabled={actionLoading}
                                >
                                🗑️ Eliminar biometría
                                </Button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </Table>
                    </Card.Body>
                </Card>
                ))}

                <h6 className="mt-4">Todos los pares duplicados:</h6>
                <Table striped bordered hover>
                <thead>
                    <tr>
                    <th>Usuario 1</th>
                    <th>Usuario 2</th>
                    <th>Similitud</th>
                    <th>Distancia</th>
                    <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {duplicates.map((dup, idx) => (
                    <tr key={idx}>
                        <td>{dup.user1.email}</td>
                        <td>{dup.user2.email}</td>
                        <td>
                        <Badge bg={dup.similarity > 0.8 ? "danger" : "warning"}>
                            {(dup.similarity * 100).toFixed(1)}%
                        </Badge>
                        </td>
                        <td>{dup.distance}</td>
                        <td>
                        {dup.isDuplicate ? (
                            <Badge bg="danger">DUPLICADO CRÍTICO</Badge>
                        ) : (
                            <Badge bg="warning">SIMILAR</Badge>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </Table>
            </>
            )}
        </Card.Body>

        {/* Modal de confirmación */}
        <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
            <Modal.Header closeButton>
            <Modal.Title>⚠️ Confirmar Eliminación Forzosa</Modal.Title>
            </Modal.Header>
            <Modal.Body>
            <p>¿Estás seguro de eliminar la biometría de:</p>
            <div className="alert alert-danger">
                <strong>{selectedDuplicate?.name}</strong><br />
                {selectedDuplicate?.email}
            </div>
            <p className="text-danger">
                <strong>Esta acción:</strong>
                <ul>
                <li>Eliminará permanentemente el registro facial</li>
                <li>El usuario no podrá usar login biométrico</li>
                <li>Debe registrar un nuevo rostro único</li>
                <li>No se puede deshacer</li>
                </ul>
            </p>
            </Modal.Body>
            <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
                Cancelar
            </Button>
            <Button 
                variant="danger" 
                onClick={() => handleForceRemoveFace(selectedDuplicate?.id)}
                disabled={actionLoading}
            >
                {actionLoading ? (
                <Spinner animation="border" size="sm" />
                ) : (
                'Sí, eliminar biometría'
                )}
            </Button>
            </Modal.Footer>
        </Modal>

        {/* Modales de éxito/error */}
        <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
            <Modal.Header closeButton>
            <Modal.Title>✅ Éxito</Modal.Title>
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
            <Modal.Title>❌ Error</Modal.Title>
            </Modal.Header>
            <Modal.Body>{modalMessage}</Modal.Body>
            <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
                Cerrar
            </Button>
            </Modal.Footer>
        </Modal>
        </Card>
    );
    };

    export default FaceDuplicateManager;