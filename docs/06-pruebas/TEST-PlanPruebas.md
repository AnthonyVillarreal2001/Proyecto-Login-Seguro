# PLAN DE PRUEBAS DE SEGURIDAD
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Versión:** 1.0

## 1. TIPOS DE PRUEBAS

### 1.1 Pruebas Automatizadas
| Tipo | Frecuencia | Herramienta | Responsable |
|------|------------|-------------|-------------|
| Unitarias | Por commit | Jest | Carlos |
| Integración | Diaria | Jest + Supertest | Anthony |
| Seguridad API | Semanal | OWASP ZAP CLI | Anthony |

### 1.2 Pruebas Manuales
| Tipo | Frecuencia | Responsable |
|------|------------|-------------|
| Pentesting básico | Mensual | Juan |
| Revisión biometría | Por release | Juan + Carlos |
| Validación UX seguridad | Por sprint | Juan |

## 2. CASOS DE PRUEBA CRÍTICOS

### 2.1 Autenticación (Carlos)
```javascript
// userController.test.js - Casos obligatorios
describe('Autenticación', () => {
  test('Login falla con password incorrecta', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'test@test.com',
      fallbackPassword: 'wrong'
    });
    expect(res.status).toBe(401);
  });

  test('Rate limiting bloquea después de 10 intentos', async () => {
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post('/auth/login').send({
        email: 'test@test.com',
        fallbackPassword: 'wrong'
      });
      if (i >= 10) expect(res.status).toBe(429);
    }
  });
});
### 2.2 Biometría (Juan)

```javascript
// Frontend tests - Casos obligatorios
describe('Biometría', () => {
  test('Cámara se detiene al cerrar modal', () => {
    // Simular uso y cierre de cámara
    const stopCamera = jest.fn();
    // Verificar que stopCamera fue llamado
    expect(stopCamera).toHaveBeenCalled();
  });

  test('Embedding se envía encriptado', () => {
    // Verificar que axios.post recibe embedding encriptado
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        embedding: expect.any(String) // Debe ser string encriptado
      })
    );
  });
});
```

### 2.3 Validación (Anthony)

```javascript
// validateMiddleware.test.js - Casos obligatorios
describe('Validación de inputs', () => {
  test('Rechaza email inválido', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'no-es-email',
      password: '12345678'
    });
    expect(res.status).toBe(400);
  });

  test('Previene inyección SQL en búsqueda', async () => {
    const res = await request(app).get('/users/search?query=test%27;DROP%20TABLE%20users;--');
    // No debe ejecutar el DROP, solo buscar el string
    expect(res.status).toBe(200);
  });
});
```
## 3. COBERTURA MÍNIMA REQUERIDA

### 3.1 Backend (Carlos)

- `controllers/userController.js` → 85% mínimo
- `models/userModel.js` → 90% mínimo  
- `utils/encryption.js` → 95% mínimo
- `middlewares/authMiddleware.js` → 80% mínimo

### 3.2 Frontend (Juan)

- `components/Login.js` → 75% mínimo
- `components/ProfileSettings.js` → 70% mínimo
- `utils/sessionManager.js` → 85% mínimo
- `utils/auth.js` → 90% mínimo

### 3.3 Middleware (Anthony)

- `middlewares/validateMiddleware.js` → 90% mínimo
- `middlewares/sessionTimeout.js` → 80% mínimo
- `index.js` (config seguridad) → 70% mínimo
## 4. HERRAMIENTAS DE PRUEBA

### 4.1 Automatización

```json
// package.json scripts
{
  "scripts": {
    "test": "jest --coverage",
    "test:security": "jest tests/*security*.test.js",
    "test:api": "jest tests/*api*.test.js --testTimeout=10000",
    "test:watch": "jest --watch"
  }
}
```

### 4.2 Pentesting Básico

```bash
# OWASP ZAP - Comandos básicos
zap-cli quick-scan --self-contained http://localhost:5000
zap-cli active-scan http://localhost:5000
```
## 5. ENTORNOS DE PRUEBA

### 5.1 Desarrollo

- **Base de datos:** secure_app_db_test
- **Usuario:** test_user / test_pass
- **Cobertura:** Mínima aceptable

### 5.2 Staging

- Réplica exacta de producción
- Datos anonimizados
- Pentesting completo permitido

### 5.3 Producción

- Solo pruebas no invasivas
- Monitoreo en tiempo real
- Alertas automáticas

## 6. CHECKLIST PRE-DEPLOY

### Checklist Carlos Campoverde (Backend):

- Tests unitarios pasando (>85% cobertura)
- `npm audit` sin vulnerabilidades críticas
- No claves hardcodeadas
- Rate limiting configurado
- Logging de seguridad activado

### Checklist Juan Pasquel (Frontend):

- Tests de componentes pasando
- Cámara se detiene correctamente
- Timeout de sesión funciona
- No passwords en estado
- CSP headers configurados

### Checklist Anthony Villarreal (Middleware):

- Validación de inputs completa
- Headers de seguridad (Helmet)
- CORS configurado correctamente
- Manejo de errores adecuado

## 7. RESPONSABILIDADES

| Actividad | Responsable | Frecuencia |
|-----------|-------------|-----------|
| Ejecutar tests unitarios | Carlos | Por commit |
| Tests de integración | Anthony | Diaria |
| Validación biometría | Juan | Por sprint |
| Pentesting básico | Anthony | Mensual |
| Revisión cobertura | Carlos | Semanal |
## 8. REPORTE DE PRUEBAS

### Plantilla semanal:

```markdown
# REPORTE PRUEBAS - Semana [XX]
**Fecha:** 24/01/2026

## Resumen
- Tests ejecutados: [X]
- Cobertura promedio: [Y]%
- Fallos críticos: [Z]

## Problemas encontrados
1. [Descripción breve] - Severidad: [Alta/Media/Baja] - Asignado: [Nombre]

## Próximas pruebas
- [ ] Pentesting endpoints auth - Anthony
- [ ] Validación timeout sesión - Juan
- [ ] Prueba de carga login - Carlos

## Firmas
- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________
```

---

### Aprobado por:

- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________

**Fecha:** 15/01/2026