// tests/sessionTimeout.test.js
const sessionTimeout = require('../middlewares/sessionTimeout');
const jwt = require('jsonwebtoken');
const blacklist = require('../blacklist');

// Mock de las dependencias
jest.mock('jsonwebtoken');
jest.mock('../blacklist');

describe('sessionTimeout middleware', () => {
    let req, res, next;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        req = {
        headers: {}
        };
        
        res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn()
        };
        
        next = jest.fn();
    });
    
    describe('Sin token de autorización', () => {
        test('debería llamar a next() si no hay authorization header', () => {
        req.headers.authorization = undefined;
        
        sessionTimeout(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(jwt.verify).not.toHaveBeenCalled();
        });
        
        test('debería llamar a next() si el authorization header está vacío', () => {
        req.headers.authorization = '';
        
        sessionTimeout(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(jwt.verify).not.toHaveBeenCalled();
        });
    });
    
    describe('Con token de autorización', () => {
        beforeEach(() => {
        req.headers.authorization = 'Bearer valid_token';
        });
        
        test('debería manejar error en jwt.verify y llamar a next()', () => {
        jwt.verify.mockImplementation(() => {
            throw new Error('Token inválido');
        });
        
        sessionTimeout(req, res, next);
        
        expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'secret_key');
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        });
        
        describe('Token expirado por inactividad', () => {
        test('debería agregar token a blacklist y retornar 401 si el token es muy viejo', () => {
            const currentTime = Date.now();
            const veryOldIat = Math.floor((currentTime - (6 * 60 * 1000)) / 1000); // 6 minutos atrás (más de 5 minutos)
            
            jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: veryOldIat
            });
            
            // Mock Date.now para controlar el tiempo actual
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => currentTime);
            
            sessionTimeout(req, res, next);
            
            expect(blacklist.add).toHaveBeenCalledWith('valid_token', currentTime);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
            error: 'Sesión expirada por inactividad. Por favor, inicie sesión nuevamente.'
            });
            expect(next).not.toHaveBeenCalled();
            
            // Restaurar Date.now
            Date.now = originalDateNow;
        });
        
        test('debería expirar exactamente después de SESSION_TIMEOUT', () => {
            const currentTime = Date.now();
            const exactlyTimeoutIat = Math.floor((currentTime - (5 * 60 * 1000) - 1000) / 1000); // 5 minutos y 1 segundo atrás
            
            jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: exactlyTimeoutIat
            });
            
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => currentTime);
            
            sessionTimeout(req, res, next);
            
            expect(blacklist.add).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
            
            Date.now = originalDateNow;
        });
        });
        
        describe('Token dentro del tiempo permitido', () => {
        test('debería llamar a next() si el token es reciente', () => {
            const currentTime = Date.now();
            const recentIat = Math.floor((currentTime - (2 * 60 * 1000)) / 1000); // 2 minutos atrás (menos de 5 minutos)
            
            jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: recentIat
            });
            
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => currentTime);
            
            sessionTimeout(req, res, next);
            
            expect(blacklist.add).not.toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalled();
            
            Date.now = originalDateNow;
        });
        
        test('debería renovar token si está en la mitad del tiempo (líneas 30-35)', () => {
            const currentTime = Date.now();
            const halfTimeoutIat = Math.floor((currentTime - (3 * 60 * 1000)) / 1000); // 3 minutos atrás (más de 2.5 minutos)
            
            jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: halfTimeoutIat
            });
            
            const newToken = 'renewed_token';
            jwt.sign.mockReturnValue(newToken);
            
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => currentTime);
            
            sessionTimeout(req, res, next);
            
            expect(jwt.sign).toHaveBeenCalledWith(
            { id: 1, role: 'client', email: 'test@test.com' },
            'secret_key',
            { expiresIn: '5m' }
            );
            expect(res.setHeader).toHaveBeenCalledWith('X-Renewed-Token', newToken);
            expect(next).toHaveBeenCalled();
            
            Date.now = originalDateNow;
        });
        
        test('no debería renovar token si está en la primera mitad del tiempo', () => {
            const currentTime = Date.now();
            const firstHalfIat = Math.floor((currentTime - (1 * 60 * 1000)) / 1000); // 1 minuto atrás (menos de 2.5 minutos)
            
            jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: firstHalfIat
            });
            
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => currentTime);
            
            sessionTimeout(req, res, next);
            
            expect(jwt.sign).not.toHaveBeenCalled();
            expect(res.setHeader).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalled();
            
            Date.now = originalDateNow;
        });
        
        test('debería manejar exactamente en la mitad del tiempo (edge case línea 30)', () => {
            const currentTime = Date.now();
            const exactlyHalfIat = Math.floor((currentTime - (2.5 * 60 * 1000)) / 1000); // Exactamente 2.5 minutos atrás
            
            jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: exactlyHalfIat
            });
            
            const newToken = 'renewed_token';
            jwt.sign.mockReturnValue(newToken);
            
            const originalDateNow = Date.now;
            Date.now = jest.fn(() => currentTime);
            
            sessionTimeout(req, res, next);
            
            expect(jwt.sign).toHaveBeenCalled(); // > (SESSION_TIMEOUT / 2) = > 2.5 minutos
            expect(res.setHeader).toHaveBeenCalledWith('X-Renewed-Token', newToken);
            expect(next).toHaveBeenCalled();
            
            Date.now = originalDateNow;
        });
        });
        
        describe('Edge cases', () => {
            test('debería manejar token recién creado (iat = ahora)', () => {
                const currentTime = Date.now();
                const nowIat = Math.floor(currentTime / 1000);
                
                jwt.verify.mockReturnValue({
                id: 1,
                role: 'client',
                email: 'test@test.com',
                iat: nowIat
                });
                
                const originalDateNow = Date.now;
                Date.now = jest.fn(() => currentTime);
                
                sessionTimeout(req, res, next);
                
                expect(blacklist.add).not.toHaveBeenCalled();
                expect(jwt.sign).not.toHaveBeenCalled();
                expect(next).toHaveBeenCalled();
                
                Date.now = originalDateNow;
            });
            
            test('debería manejar malformed authorization header', () => {
                req.headers.authorization = 'InvalidFormat';
                
                // Cuando el header es 'InvalidFormat', split(' ') devuelve ['InvalidFormat']
                // token = undefined, y jwt.verify(undefined, ...) lanza error
                jwt.verify.mockImplementation(() => {
                    throw new Error('jwt must be provided');
                });
                
                sessionTimeout(req, res, next);
                
                expect(next).toHaveBeenCalled();
                // jwt.verify SÍ será llamado con undefined
                // Cambiamos la expectativa:
                expect(jwt.verify).toHaveBeenCalled();
            });
            
            test('debería manejar Bearer sin token', () => {
                req.headers.authorization = 'Bearer ';
                
                // split(' ') devuelve ['Bearer', ''], token = ''
                // jwt.verify('', ...) lanza error
                jwt.verify.mockImplementation(() => {
                    throw new Error('jwt must be a string');
                });
                
                sessionTimeout(req, res, next);
                
                expect(next).toHaveBeenCalled();
                // jwt.verify SÍ será llamado con string vacío
                expect(jwt.verify).toHaveBeenCalled();
            });
        });
    });
    
    describe('Cobertura de líneas específicas', () => {
        test('línea 20-21: error en jwt.verify', () => {
        req.headers.authorization = 'Bearer invalid_token';
        
        jwt.verify.mockImplementation(() => {
            throw new Error('JWT malformed');
        });
        
        sessionTimeout(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        });
        
        test('línea 30-35: renovación de token (tokenAge > SESSION_TIMEOUT / 2)', () => {
        req.headers.authorization = 'Bearer valid_token';
        const currentTime = Date.now();
        const halfPlusIat = Math.floor((currentTime - (2.6 * 60 * 1000)) / 1000); // 2.6 minutos atrás
        
        jwt.verify.mockReturnValue({
            id: 1,
            role: 'client',
            email: 'test@test.com',
            iat: halfPlusIat
        });
        
        jwt.sign.mockReturnValue('new_token');
        
        const originalDateNow = Date.now;
        Date.now = jest.fn(() => currentTime);
        
        sessionTimeout(req, res, next);
        
        expect(jwt.sign).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('X-Renewed-Token', 'new_token');
        expect(next).toHaveBeenCalled();
        
        Date.now = originalDateNow;
        });
        
        test('línea 40: catch block - error general', () => {
        req.headers.authorization = 'Bearer token';
        
        // Simular cualquier error durante el proceso
        jwt.verify.mockImplementation(() => {
            throw new TypeError('Unexpected error');
        });
        
        sessionTimeout(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        });
    });
});