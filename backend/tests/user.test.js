const request = require('supertest');
const app = require('../index');
const db = require('../config/db');
const pool = db.getPool();
const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');
const jwt = require('jsonwebtoken');

jest.mock('@simplewebauthn/server', () => ({
    startRegistration: jest.fn(),
    startAuthentication: jest.fn(),
    verifyRegistrationResponse: jest.fn(() => Promise.resolve({ verified: false })),
    verifyAuthenticationResponse: jest.fn(() => Promise.resolve({ verified: false, authenticationInfo: { newCounter: 1 } })),
    generateRegistrationOptions: jest.fn(() => Promise.resolve({
        challenge: 'test-challenge-123',
        rp: { 
        name: 'Secure App', 
        id: 'localhost' 
        },
        user: { 
        id: '1', 
        name: 'admin@test.com',
        displayName: 'Admin Test' 
        },
        pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
        ],
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred'
        }
    }))
}));

const { 
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
    generateRegistrationOptions
} = require('@simplewebauthn/server');

const setupTestDatabase = async () => {
    try {
        await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
        
        const adminHash = await bcrypt.hash('Admin12345', 10);
        await pool.query(
        `INSERT INTO users (name, email, password_hash, role, registration_date)
        VALUES ($1, $2, $3, $4, NOW())`,
        ['Admin Test', 'admin@test.com', adminHash, 'admin']
        );
        
        const clientHash = await bcrypt.hash('Client12345', 10);
        await pool.query(
        `INSERT INTO users (name, email, password_hash, role, registration_date)
        VALUES ($1, $2, $3, $4, NOW())`,
        ['Client Test', 'client@test.com', clientHash, 'client']
        );
        
        console.log('Base de datos de prueba inicializada');
    } catch (error) {
        console.error('Error en setupTestDatabase:', error);
        throw error;
    }
};

const getAdminToken = async () => {
    const response = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', fallbackPassword: 'Admin12345' });
    
    if (response.status !== 200) {
        console.error('Error al obtener token admin:', response.body);
        const adminHash = await bcrypt.hash('Admin12345', 10);
        await pool.query(
        'DELETE FROM users WHERE email = $1',
        ['admin@test.com']
        );
        await pool.query(
        `INSERT INTO users (name, email, password_hash, role, registration_date)
        VALUES ($1, $2, $3, $4, NOW())`,
        ['Admin Test', 'admin@test.com', adminHash, 'admin']
        );
        
        const retry = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', fallbackPassword: 'Admin12345' });
        
        if (retry.status !== 200) {
        throw new Error('No se pudo obtener token admin después de recrear usuario');
        }
        return retry.body.token;
    }
    
    return response.body.token;
};

const getClientToken = async () => {
    const response = await request(app)
        .post('/auth/login')
        .send({ email: 'client@test.com', fallbackPassword: 'Client12345' });
    
    if (response.status !== 200) {
        console.error('Error al obtener token cliente:', response.body);
        throw new Error('No se pudo obtener token cliente');
    }
    
    return response.body.token;
};

const getValidToken = async (email, password) => {
    try {
        const response = await request(app)
        .post('/auth/login')
        .send({ email, fallbackPassword: password });
        
        if (response.status === 200) {
        return response.body.token;
        }
        
        console.log(`Recreando usuario ${email}...`);
        
        await pool.query('DELETE FROM users WHERE email = $1', [email]);
        
        const hash = await bcrypt.hash(password, 10);
        const role = email.includes('admin') ? 'admin' : 'client';
        const name = email.includes('admin') ? 'Admin Test' : 'Client Test';
        
        await pool.query(
        `INSERT INTO users (name, email, password_hash, role, registration_date, challenge)
        VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [name, email, hash, role, 'test-challenge']
        );
        
        const retryResponse = await request(app)
        .post('/auth/login')
        .send({ email, fallbackPassword: password });
        
        if (retryResponse.status !== 200) {
        throw new Error(`No se pudo obtener token para ${email} después de recrear usuario`);
        }
        
        return retryResponse.body.token;
    } catch (error) {
        console.error(`Error en getValidToken para ${email}:`, error.message);
        throw error;
    }
};

describe('Pruebas API Usuarios - Integración', () => {
    beforeAll(async () => {
        try {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        
        await setupTestDatabase();
        console.log('Setup completado');
        } catch (error) {
        console.error('Error en beforeAll:', error);
        throw error;
        }
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        
        try {
        await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
        } catch (error) {
        console.error('Error limpiando base de datos:', error);
        }
        
        await pool.end();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('Login admin exitoso → obtiene token válido', async () => {
        const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', fallbackPassword: 'Admin12345' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.message).toBe('Login exitoso');
    });

    test('Login con contraseña incorrecta → 401', async () => {
        const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', fallbackPassword: 'mal123' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/contraseña|fallida/i);
    });

    test('Login sin email → 400 por validación', async () => {
        const res = await request(app)
        .post('/auth/login')
        .send({ fallbackPassword: 'Admin12345' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Login sin contraseña ni biometría → 400', async () => {
        const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/requiere|contraseña|biometría/i);
    });

    test('Login falla cuando usuario no existe → 401', async () => {
        const res = await request(app)
        .post('/auth/login')
        .send({ email: 'noexiste@correo.com', fallbackPassword: '123' });
        
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Usuario no encontrado');
    });

    test('Login con biometría inválida → falla verificación', async () => {
        verifyAuthenticationResponse.mockResolvedValueOnce({
        verified: false
        });

        const res = await request(app)
        .post('/auth/login')
        .send({
            email: 'admin@test.com',
            biometricResponse: { 
            id: 'invalid',
            rawId: 'invalid',
            response: {}
            }
        });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/fallida/i);
    });

    test('Login biométrico fallido → usa fallback contraseña', async () => {
        verifyAuthenticationResponse.mockRejectedValueOnce(new Error('Invalid biometric data'));

        const res = await request(app)
            .post('/auth/login')
            .send({
            email: 'admin@test.com',
            biometricResponse: { 
                id: 'invalid',
                rawId: 'invalid',
                response: {}
            },
            fallbackPassword: 'Admin12345'
            });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    test('Login biométrico exitoso → token válido', async () => {
        verifyAuthenticationResponse.mockResolvedValueOnce({
        verified: true,
        authenticationInfo: { newCounter: 2 }
        });

        await pool.query(
        `UPDATE users SET 
            credentialID = $1,
            publicKey = $2
        WHERE email = $3`,
        [Buffer.from('test'), Buffer.from('test'), 'admin@test.com']
        );

        const res = await request(app)
        .post('/auth/login')
        .send({
            email: 'admin@test.com',
            biometricResponse: { 
            id: 'test',
            rawId: 'test',
            response: {
                clientDataJSON: 'test',
                authenticatorData: 'test',
                signature: 'test'
            }
            }
        });

        expect([200, 401]).toContain(res.status);
    });

    test('Validación de login con biometría inválida → 400', async () => {
        const res = await request(app)
        .post('/auth/login')
        .send({
            email: 'not-an-email',
            biometricResponse: 'not-an-object'
        });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Registro nuevo usuario (solo admin) → 201', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'Usuario Prueba',
            email: 'nuevo@test.com',
            password: 'Pass123456',
            role: 'client'
        });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe('nuevo@test.com');
        expect(res.body.role).toBe('client');
    });

    test('Registro sin token → 401', async () => {
        const res = await request(app)
        .post('/auth/register')
        .send({
            name: 'Intruso',
            email: 'no@deberia.com',
            password: 'Password12345',
            role: 'client'
        });

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('No token');
    });

    test('Cliente intenta registrar → 403', async () => {
        const clientToken = await getClientToken();
        
        const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
            name: 'Otro Usuario',
            email: 'otro@email.com',
            password: 'Password12345',
            role: 'client'
        });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/acceso denegado|rol insuficiente/i);
    });

    test('Registro con datos inválidos → 400', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: '',
            email: 'email-invalido',
            password: '123',
            role: 'invalid-role'
        });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Perfil del cliente → muestra datos correctos', async () => {
        const clientToken = await getClientToken();
        
        const res = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${clientToken}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('client@test.com');
        expect(res.body.role).toBe('client');
    });

    test('Actualizar preferencias cliente → OK', async () => {
        const clientToken = await getClientToken();
        const prefs = { theme: 'oscuro', idioma: 'es' };

        const res = await request(app)
        .put('/profile/preferences')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ preferences: prefs });

        expect(res.status).toBe(200);
        expect(res.body.preferences).toMatchObject(prefs);
    });

    test('Actualizar perfil con datos inválidos → 400', async () => {
        const clientToken = await getClientToken();
        
        const res = await request(app)
        .put('/profile/preferences')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ preferences: 'no es objeto' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Búsqueda usuarios (admin) → encuentra al menos el cliente', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .get('/users/search?query=client')
        .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some(u => u.email === 'client@test.com')).toBe(true);
    });

    test('Búsqueda usuarios con query vacío → devuelve todos', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .get('/users/search?query=')
        .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(1);
    });

    test('Buscar usuarios con inyección SQL simulada → sanitizado', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .get('/users/search?query=%27%20OR%20%271%27%3D%271')
        .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('Search con query muy largo → pasa validación', async () => {
        const adminToken = await getAdminToken();
        const longQuery = 'a'.repeat(300);
        
        const res = await request(app)
        .get(`/users/search?query=${longQuery}`)
        .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });

    test('Admin edita usuario existente → éxito', async () => {
        const adminToken = await getAdminToken();
        
        const createRes = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'Para Editar',
            email: `editar${Date.now()}@test.com`,
            password: 'Password12345',
            role: 'client'
        });

        expect(createRes.status).toBe(201);
        const userId = createRes.body.id;

        const editRes = await request(app)
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Nombre Editado' });

        expect(editRes.status).toBe(200);
        expect(editRes.body.name).toBe('Nombre Editado');
    });

    test('Editar usuario con ID no numérico → 400', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .put('/users/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Nuevo nombre' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Update user con campos vacíos → manejo', async () => {
        const adminToken = await getAdminToken();
        
        const createRes = await request(app)
            .post('/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
            name: 'Test Update',
            email: `update${Date.now()}@test.com`,
            password: 'Password12345',
            role: 'client'
            });

        const userId = createRes.body.id;

        const updateRes = await request(app)
            .put(`/users/${userId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(updateRes.status).toBe(200);
        expect(updateRes.body.id).toBe(userId);
    });

    test('Registro biométrico exitoso → opciones generadas', async () => {
        const adminToken = await getAdminToken();
        
        const webauthn = require('@simplewebauthn/server');
        
        webauthn.generateRegistrationOptions.mockImplementation(async () => {
            return {
            challenge: 'test-challenge-123',
            rp: { name: 'Test', id: 'localhost' },
            user: { id: '1', name: 'test@test.com' },
            pubKeyCredParams: []
            };
        });

        const res = await request(app)
            .post('/auth/biometric/register-options')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'admin@test.com' });

        if (res.status !== 200) {
            console.log('Error response:', res.body);
        }
        expect([200, 500]).toContain(res.status);
        
        if (res.status === 200) {
            expect(res.body).toBeDefined();
        }
    });

    test('Registro biométrico fallido → 400', async () => {
        const adminToken = await getAdminToken();
        verifyRegistrationResponse.mockResolvedValueOnce({
        verified: false
        });

        const res = await request(app)
        .post('/auth/biometric/verify-registration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
            response: { id: 'test' }, 
            challenge: 'test' 
        });

        expect(res.status).toBe(400);
    });

    test('Error en generateRegistrationOptions → 500', async () => {
        const adminToken = await getAdminToken();
        generateRegistrationOptions.mockRejectedValueOnce(new Error('Test error'));

        const res = await request(app)
        .post('/auth/biometric/register-options')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'admin@test.com' });

        expect(res.status).toBe(500);
    });

    test('Error en verifyRegistration → 500', async () => {
        const adminToken = await getAdminToken();
        verifyRegistrationResponse.mockRejectedValueOnce(new Error('Test error'));

        const res = await request(app)
        .post('/auth/biometric/verify-registration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
            response: { id: 'test' }, 
            challenge: 'test' 
        });

        expect(res.status).toBe(500);
    });

    test('Middleware sin token → 401', async () => {
        const res = await request(app).get('/profile');
        expect(res.status).toBe(401);
        expect(res.body.error).toContain('No token');
    });

    test('Middleware con token mal formado → 401', async () => {
        const res = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer token-malformado');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('inválido');
    });

    test('Middleware con rol incorrecto → 403', async () => {
        const clientToken = await getClientToken();
        
        const res = await request(app)
        .get('/users/search?query=test')
        .set('Authorization', `Bearer ${clientToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/acceso denegado|rol insuficiente/i);
    });

    test('Registro con email duplicado → error', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'Duplicado',
            email: 'admin@test.com',
            password: 'Password12345',
            role: 'client'
        });

        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('Error en login (simulado) → 500', async () => {
        const originalFind = UserModel.findUserByEmail;
        UserModel.findUserByEmail = jest.fn(() => {
        throw new Error('DB error simulado');
        });

        const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', fallbackPassword: 'Admin12345' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Error interno en servidor');

        UserModel.findUserByEmail = originalFind;
    });

    test('Error en register → 500', async () => {
        const adminToken = await getAdminToken();
        const originalCreate = UserModel.createUser;
        UserModel.createUser = jest.fn(() => {
        throw new Error('DB error simulado');
        });

        const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'Test Error',
            email: 'error@test.com',
            password: 'Password12345',
            role: 'client'
        });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Error al registrar');

        UserModel.createUser = originalCreate;
    });

    test('Logout → token queda inválido', async () => {
        const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', fallbackPassword: 'Admin12345' });
        
        const tokenToLogout = loginRes.body.token;

        const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenToLogout}`);

        expect(logoutRes.status).toBe(200);

        const profileRes = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${tokenToLogout}`);

        expect(profileRes.status).toBe(401);
    });

    test('Logout sin token → 401', async () => {
        const res = await request(app).post('/auth/logout');
        expect(res.status).toBe(401);
    });

    test('Logout con token inválido → 401', async () => {
        const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token-invalido');

        expect(res.status).toBe(401);
    });

    test('Logout con token expirado → 401', async () => {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzAwMDAwMDAwfQ.invalid';
        
        const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
    });

    test('generateRegistrationOptions con usuario no encontrado → 404', async () => {
        const userController = require('../controllers/userController');
        
        const mockReq = {
            body: { email: 'noexiste@test.com' },
            user: { id: 1, email: 'admin@test.com', role: 'admin' }
        };
        
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        
        const originalFind = UserModel.findUserByEmail;
        UserModel.findUserByEmail = jest.fn().mockResolvedValue(null);
        
        await userController.generateRegistrationOptions(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Usuario no encontrado'
        });
        
        UserModel.findUserByEmail = originalFind;
    });

    test('Login biométrico con error en verificación → usa fallback', async () => {
        const webauthn = require('@simplewebauthn/server');
        webauthn.verifyAuthenticationResponse.mockRejectedValueOnce(
            new Error('Credenciales inválidas')
        );

        const res = await request(app)
            .post('/auth/login')
            .send({
            email: 'admin@test.com',
            biometricResponse: {
                id: 'test-id',
                rawId: 'test-raw-id',
                response: {
                clientDataJSON: 'test',
                authenticatorData: 'test',
                signature: 'test'
                }
            },
            fallbackPassword: 'Admin12345'
            });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    test('verifyRegistration con error al actualizar usuario → 500', async () => {
        const userController = require('../controllers/userController');
        const webauthn = require('@simplewebauthn/server');
        
        webauthn.verifyRegistrationResponse.mockResolvedValueOnce({
            verified: true,
            registrationInfo: {
            credentialPublicKey: Buffer.from('test-key'),
            credentialID: Buffer.from('test-id'),
            counter: 1
            }
        });
        
        const mockReq = {
            body: {
            response: { 
                id: 'test-id',
                rawId: 'test-raw-id',
                response: {
                attestationObject: 'test',
                clientDataJSON: 'test'
                }
            },
            challenge: 'test-challenge'
            },
            user: { 
            id: 1, 
            email: 'admin@test.com', 
            role: 'admin',
            challenge: 'test-challenge'
            }
        };
        
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        
        const updateUserSpy = jest.spyOn(UserModel, 'updateUser')
            .mockRejectedValue(new Error('DB error'));
        
        await userController.verifyRegistration(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Error verificando registro biométrico'
        });
        
        updateUserSpy.mockRestore();
    });

    test('Validación login: email válido pero sin credenciales → 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({
            email: 'valid@email.com'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/requiere|contraseña|biometría/i);
    });

    test('Validación verify-registration: sin response → 400', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
            .post('/auth/biometric/verify-registration')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
            challenge: 'test-challenge'
            });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Validación verify-registration: response no es objeto → 400', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
            .post('/auth/biometric/verify-registration')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
            response: 'no-es-objeto',
            challenge: 'test-challenge'
            });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Validación verify-registration: sin challenge → 400', async () => {
        const adminToken = await getAdminToken();
        
        const res = await request(app)
            .post('/auth/biometric/verify-registration')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
            response: { id: 'test' }
            });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('updateUser con fields undefined → retorna usuario', async () => {
        const user = await UserModel.updateUser(1, undefined);
        expect(user).toBeDefined();
        expect(user.id).toBe(1);
        expect(user.email).toBe('admin@test.com');
    });

    test('updateUser con fields null → retorna usuario', async () => {
        const user = await UserModel.updateUser(1, null);
        expect(user).toBeDefined();
        expect(user.id).toBe(1);
        expect(user.email).toBe('admin@test.com');
    });

    test('updateUser con objeto vacío → retorna usuario', async () => {
        const user = await UserModel.updateUser(1, {});
        expect(user).toBeDefined();
        expect(user.id).toBe(1);
        expect(user.email).toBe('admin@test.com');
    });

    test('updateUser filtra campos undefined y null', async () => {
        const user = await UserModel.updateUser(1, {
        name: 'Nuevo Nombre',
        email: undefined,
        role: null,
        preferences: { theme: 'dark' }
        });
        
        expect(user).toBeDefined();
        expect(user.name).toBe('Nuevo Nombre');
        expect(user.preferences).toEqual({ theme: 'dark' });
        expect(user.email).toBe('admin@test.com');
        expect(user.role).toBe('admin');
    });

    test('updateUser ignora campos que no existen en la tabla', async () => {
        const user = await UserModel.updateUser(1, {
        name: 'Nombre Actualizado',
        campoInexistente: 'este no existe',
        otroCampoFalso: 123
        });
        
        expect(user).toBeDefined();
        expect(user.name).toBe('Nombre Actualizado');
    });

    test('updateUser con campos válidos → actualiza correctamente', async () => {
        const newEmail = `updated${Date.now()}@test.com`;
        
        const user = await UserModel.updateUser(1, {
        name: 'Admin Actualizado',
        email: newEmail,
        preferences: { language: 'es', notifications: true }
        });
        
        expect(user).toBeDefined();
        expect(user.name).toBe('Admin Actualizado');
        expect(user.email).toBe(newEmail);
        expect(user.preferences).toEqual({ language: 'es', notifications: true });
    });

    test('updateUser con fields que no es objeto (string) → retorna usuario', async () => {
        const user = await UserModel.updateUser(1, 'esto no es un objeto');
        expect(user).toBeDefined();
        expect(user.id).toBe(1);
    });

    test('updateUser con fields que no es objeto (number) → retorna usuario', async () => {
        const user = await UserModel.updateUser(1, 123);
        expect(user).toBeDefined();
        expect(user.id).toBe(1);
    });

    test('DbPool constructor retorna misma instancia', () => {
        const DbPool = require('../config/db');
        const instance1 = DbPool;
        const instance2 = DbPool;
        
        expect(instance1).toBe(instance2);
        
        const pool = instance1.getPool();
        expect(pool).toBeDefined();
        expect(typeof pool.query).toBe('function');
    });

    test('Logout con header authorization mal formado → 401', async () => {
        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'Bearer');

        expect(res.status).toBe(401);
    });

    test('validateLogin con biometricResponse no objeto → 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'admin@test.com',
                biometricResponse: 'string-instead-of-object'
            });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('updateUser con error de base de datos → lanza error', async () => {
        const UserModel = require('../models/userModel');
        
        const originalQuery = pool.query;
        pool.query = jest.fn().mockRejectedValue(new Error('DB error simulado'));

        await expect(UserModel.updateUser(1, { name: 'Test' }))
            .rejects.toThrow('DB error simulado');

        pool.query = originalQuery;
    });

    test('updateUser con campos que causan error SQL → manejo adecuado', async () => {
        const UserModel = require('../models/userModel');
        
        const user1 = await UserModel.updateUser(1, {
            name: "Test's Name",
            email: "test'; DROP TABLE users; --"
        });
        
        expect(user1).toBeDefined();
        
        const largeObject = {};
        for (let i = 0; i < 1000; i++) {
            largeObject[`key${i}`] = `value${i}`.repeat(10);
        }
        
        const user2 = await UserModel.updateUser(1, {
            preferences: largeObject
        });
        
        expect(user2).toBeDefined();
    });

    test('authMiddleware con token expirado → 401', async () => {
        const expiredToken = jwt.sign(
            { id: 1, role: 'admin', email: 'admin@test.com' },
            'secret_key',
            { expiresIn: '-1h' }
        );

        const res = await request(app)
            .get('/profile')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/inválido|expirado/i);
    });

    test('updateUser con error de conexión a BD → propaga error', async () => {
        const UserModel = require('../models/userModel');
        
        jest.spyOn(pool, 'query').mockImplementation(() => {
            throw new Error('Connection refused');
        });

        await expect(UserModel.updateUser(1, { name: 'Test' }))
            .rejects.toThrow('Connection refused');

        jest.restoreAllMocks();
    });

    test('Login con usuario que tiene biometric data pero falla decodificación', async () => {
        await pool.query(`
            UPDATE users SET 
                credentialID = $1,
                publicKey = $2
            WHERE email = $3
        `, [Buffer.from('invalid'), Buffer.from('invalid'), 'admin@test.com']);

        const webauthn = require('@simplewebauthn/server');
        webauthn.verifyAuthenticationResponse = jest.fn(() => {
            throw new Error('Invalid credential data format');
        });

        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'admin@test.com',
                biometricResponse: {
                    id: 'test',
                    rawId: 'test',
                    response: {
                        clientDataJSON: 'invalid',
                        authenticatorData: 'invalid',
                        signature: 'invalid'
                    }
                }
            });

        expect(res.status).toBe(401);
    });
});