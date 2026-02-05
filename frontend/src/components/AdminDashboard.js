import React, { useState, useEffect  } from 'react';
import axios from 'axios';
import ProfileSettings from './ProfileSettings';
import { Button, Card, Form, ListGroup, Modal, Spinner } from 'react-bootstrap';
import { initSessionManager } from '../utils/sessionManager';
import FaceDuplicateManager from './FaceDuplicateManager';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'client' });
    const [editingUser, setEditingUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [preferences, setPreferences] = useState({ theme: 'light', notifications: true });
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    useEffect(() => {
        if (!window.sessionManager || !window.sessionManager.initialized) {
            console.log('Inicializando SessionManager desde dashboard...');
            initSessionManager();
        }
        const loadData = async () => {
            await fetchUsers();
            
            // Cargar preferencias directamente aquí
            try {
                const res = await axios.get('/profile');
                setPreferences(res.data.preferences || { theme: 'light', notifications: true });
                document.documentElement.setAttribute('data-bs-theme', res.data.preferences?.theme || 'light');
            } catch (err) {
                console.error('Error cargando preferencias:', err);
            }
        };
        loadData();
    }, []);
    
    const fetchUsers = async (query = '') => {
        setLoading(true);
        try {
        const res = await axios.get(`/users/search?query=${query}`);
        setUsers(res.data);
        } catch (err) {
            setModalMessage('No pudimos cargar los usuarios. ¿El servidor está de siesta? 😴');
            setShowErrorModal(true);
        } finally {
        setLoading(false);
        }
    };

    const handleUpdatePreferences = async () => {
        try {
            // Primero obtenemos el perfil actual para no perder el faceEmbedding
            const resProfile = await axios.get('/profile');
            const currentPrefs = resProfile.data.preferences || {};
            
            // Mantenemos el faceEmbedding si existe
            const updatedPreferences = {
            ...currentPrefs,  // ← Mantiene faceEmbedding si existe
            theme: preferences.theme,
            notifications: preferences.notifications
            };
            
            await axios.put('/profile/preferences', { preferences: updatedPreferences });
            
            // Aplicar tema inmediatamente
            document.documentElement.setAttribute('data-bs-theme', preferences.theme);
            setModalMessage('¡Preferencias guardadas! Tema aplicado.');
            setShowSuccessModal(true);
            
            // Actualizar estado local manteniendo faceEmbedding
            setPreferences(updatedPreferences);
        } catch (err) {
            setModalMessage('No se pudieron guardar las preferencias. Intenta de nuevo.');
            setShowErrorModal(true);
        }
        };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
        setModalMessage('¡Completa todos los campos, por favor! No queremos usuarios fantasma 👻');
        setShowErrorModal(true);
        return;
        }

        try {
        await axios.post('/auth/register', newUser);
        setNewUser({ name: '', email: '', password: '', role: 'client' });
        fetchUsers();
        setModalMessage('¡Nuevo usuario creado con éxito! Bienvenido al equipo. 🎉');
        setShowSuccessModal(true);
        } catch (err) {
        const msg = err.response?.data?.error || 'Error al registrar. ¿Email ya existe?';
        setModalMessage(msg);
        setShowErrorModal(true);
        }
    };

    const startEdit = (user) => {
        setEditingUser({ ...user, password: '' }); // password vacío para no mostrar el hash
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        try {
        await axios.put(`/users/${editingUser.id}`, editingUser);
        setEditingUser(null);
        fetchUsers();
        setModalMessage('Usuario actualizado correctamente. ¡Buen trabajo, jefe! 👍');
        setShowSuccessModal(true);
        } catch (err) {
        setModalMessage('No se pudo editar el usuario. Intenta de nuevo.');
        setShowErrorModal(true);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Realmente quieres eliminar este usuario? Esta acción NO se puede deshacer. 😱')) return;

        try {
        await axios.delete(`/users/${id}`);
        fetchUsers();
        setModalMessage('Usuario eliminado permanentemente. Adiós, cuenta. 👋');
        setShowSuccessModal(true);
        } catch (err) {
        setModalMessage('Error al eliminar usuario. ¿Tiene dependencias?');
        setShowErrorModal(true);
        }
    };

    const handleDeleteBiometric = async (id) => {
        if (!window.confirm('¿Eliminar la biometría de este usuario? Perderá acceso facial. ¿Seguro?')) return;

        try {
        await axios.delete(`/users/${id}/biometric`);
        fetchUsers();
        setModalMessage('Biometría facial eliminada con éxito.');
        setShowSuccessModal(true);
        } catch (err) {
        setModalMessage('No se pudo eliminar la biometría. Intenta más tarde.');
        setShowErrorModal(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    return (
        <div className="container mt-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Panel de Administración</h2>
            <Button variant="outline-danger" onClick={handleLogout}>
            Cerrar sesión
            </Button>
        </div>

        {loading && <div className="text-center my-5"><Spinner animation="border" /></div>}

        {/* Registro de nuevo usuario */}
        <Card className="mb-4 shadow-sm">
            <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">Registrar Nuevo Usuario</h5>
            </Card.Header>
            <Card.Body>
            <Form onSubmit={handleRegister}>
                <Form.Group className="mb-3">
                <Form.Label>Nombre completo</Form.Label>
                <Form.Control
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    required
                />
                </Form.Group>

                <Form.Group className="mb-3">
                <Form.Label>Correo electrónico</Form.Label>
                <Form.Control
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    required
                />
                </Form.Group>

                <Form.Group className="mb-3">
                <Form.Label>Contraseña</Form.Label>
                <Form.Control
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    required
                />
                </Form.Group>

                <Form.Group className="mb-3">
                <Form.Label>Rol</Form.Label>
                <Form.Select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                    <option value="client">Cliente</option>
                    <option value="admin">Administrador</option>
                </Form.Select>
                </Form.Group>

                <Button type="submit" variant="success">
                Crear usuario
                </Button>
            </Form>
            </Card.Body>
        </Card>

        {/* Búsqueda y lista de usuarios */}
        <Card className="mb-4 shadow-sm">
            <Card.Header className="bg-info text-white">
            <h5 className="mb-0">Usuarios del sistema</h5>
            </Card.Header>
            <Card.Body>
            <div className="input-group mb-3">
                <Form.Control
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                />
                <Button variant="primary" onClick={() => fetchUsers(searchQuery)}>
                Buscar
                </Button>
            </div>

            <ListGroup>
                {users.length === 0 ? (
                <ListGroup.Item className="text-center text-muted">
                    No hay usuarios que coincidan con la búsqueda
                </ListGroup.Item>
                ) : (
                users.map(user => (
                    <ListGroup.Item key={user.id} className="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>{user.name}</strong> — {user.email}
                        <br />
                        <small className="text-muted">
                        Rol: {user.role} | {user.preferences?.faceEmbedding ? 'Con biometría' : 'Sin biometría'}
                        </small>
                    </div>
                    <div>
                        <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => startEdit(user)}
                        >
                        Editar
                        </Button>
                        <Button
                        variant="outline-danger"
                        size="sm"
                        className="me-2"
                        onClick={() => handleDelete(user.id)}
                        >
                        Eliminar
                        </Button>
                        {user.preferences?.faceEmbedding && (
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => handleDeleteBiometric(user.id)}
                        >
                            Quitar biometría
                        </Button>
                        )}
                    </div>
                    </ListGroup.Item>
                ))
                )}
            </ListGroup>
            </Card.Body>
        </Card>

        {/* Modal de edición */}
        {editingUser && (
            <Modal show={true} onHide={() => setEditingUser(null)} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Editar usuario: {editingUser.name}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleEdit}>
                <Form.Group className="mb-3">
                    <Form.Label>Nombre</Form.Label>
                    <Form.Control
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                    type="email"
                    value={editingUser.email}
                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Nueva contraseña (dejar vacío si no cambia)</Form.Label>
                    <Form.Control
                    type="password"
                    value={editingUser.password || ''}
                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="Solo si deseas cambiarla"
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Rol</Form.Label>
                    <Form.Select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                    >
                    <option value="client">Cliente</option>
                    <option value="admin">Administrador</option>
                    </Form.Select>
                </Form.Group>

                <div className="d-grid">
                    <Button type="submit" variant="primary">
                    Guardar cambios
                    </Button>
                </div>
                </Form>
            </Modal.Body>
            </Modal>
        )}

        <Card className="mb-4 shadow-sm border-warning">
            <Card.Header className="bg-warning text-dark">
                <h5 className="mb-0">🔍 Auditoría de Rostros Únicos</h5>
            </Card.Header>
            <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                <p className="mb-0">
                    Verifica que cada rostro esté registrado solo en una cuenta.
                </p>
                <Button 
                    variant="outline-danger" 
                    onClick={() => {
                    // Función para verificar duplicados
                    axios.get('/admin/face-duplicates')
                        .then(res => {
                        if (res.data.totalDuplicates > 0) {
                            setModalMessage(
                            `⚠️ Se encontraron ${res.data.totalDuplicates} rostros duplicados. ` +
                            `Revisa la sección de auditoría para más detalles.`
                            );
                            setShowErrorModal(true);
                        } else {
                            setModalMessage('✅ Todos los rostros son únicos en el sistema.');
                            setShowSuccessModal(true);
                        }
                        })
                        .catch(err => {
                        setModalMessage('Error al verificar duplicados: ' + err.message);
                        setShowErrorModal(true);
                        });
                    }}
                >
                    🔎 Escanear duplicados
                </Button>
                </div>
                
                {/* Agregar estadísticas rápidas */}
                <div className="row text-center">
                <div className="col-md-4">
                    <div className="card">
                    <div className="card-body">
                        <h3>{users.filter(u => u.preferences?.faceEmbedding).length}</h3>
                        <p className="text-muted mb-0">Con biometría</p>
                    </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card">
                    <div className="card-body">
                        <h3>{users.filter(u => !u.preferences?.faceEmbedding).length}</h3>
                        <p className="text-muted mb-0">Sin biometría</p>
                    </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card">
                    <div className="card-body">
                        <h3>{users.length}</h3>
                        <p className="text-muted mb-0">Total usuarios</p>
                    </div>
                    </div>
                </div>
                </div>
            </Card.Body>
        </Card>

        {/* Agregar el gestor de duplicados */}
        <FaceDuplicateManager />

        <ProfileSettings />

        {/* Modal Éxito */}
        <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
            <Modal.Header closeButton>
            <Modal.Title>¡Operación exitosa!</Modal.Title>
            </Modal.Header>
            <Modal.Body>{modalMessage}</Modal.Body>
            <Modal.Footer>
            <Button variant="success" onClick={() => setShowSuccessModal(false)}>
                Genial
            </Button>
            </Modal.Footer>
        </Modal>

        {/* Modal Error */}
        <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} centered>
            <Modal.Header closeButton>
            <Modal.Title>¡Algo falló!</Modal.Title>
            </Modal.Header>
            <Modal.Body>{modalMessage}</Modal.Body>
            <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
                Entendido
            </Button>
            </Modal.Footer>
        </Modal>
        </div>
    );
};

export default AdminDashboard;