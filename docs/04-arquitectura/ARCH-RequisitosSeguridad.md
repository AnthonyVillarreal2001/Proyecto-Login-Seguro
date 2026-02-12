# REQUISITOS DE SEGURIDAD
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Versión:** 1.0

## 1. REQUISITOS FUNCIONALES DE SEGURIDAD

### 1.1 Autenticación (REQ-AUTH)

| ID | Requisito | Componente | Responsable | Estado |
|----|-----------|------------|-------------|--------|
| **AUTH-001** | Login con contraseña (fallback) | userController.js | Carlos | ✅ Implementado |
| **AUTH-002** | Login biométrico facial | Login.js + userController.js | Juan | ✅ Implementado |
| **AUTH-003** | Rate limiting (10 intentos/5min) | index.js | Anthony | ✅ Implementado |
| **AUTH-004** | Timeout sesión 5 minutos inactividad | sessionManager.js | Juan | ✅ Implementado |
| **AUTH-005** | Logout con blacklisting de tokens | blacklist.js | Carlos | ✅ Implementado |
| **AUTH-006** | Renovación automática de tokens | auth.js | Anthony | ✅ Implementado |

### 1.2 Autorización (REQ-AUTHZ)

| ID | Requisito | Componente | Responsable | Estado |
|----|-----------|------------|-------------|--------|
| **AUTHZ-001** | Roles: admin y client | PostgreSQL ENUM | Carlos | ✅ Implementado |
| **AUTHZ-002** | Middleware validación roles | authMiddleware.js | Anthony | ✅ Implementado |
| **AUTHZ-003** | Admin: CRUD usuarios | AdminDashboard.js | Juan | ✅ Implementado |
| **AUTHZ-004** | Client: Solo su perfil | ClientDashboard.js | Juan | ✅ Implementado |
| **AUTHZ-005** | Validación tokens JWT | authMiddleware.js | Anthony | ✅ Implementado |

### 1.3 Protección de Datos (REQ-DATA)

| ID | Requisito | Componente | Responsable | Estado |
|----|-----------|------------|-------------|--------|
| **DATA-001** | Embeddings encriptados AES-256 | encryption.js | Carlos | ✅ Implementado |
| **DATA-002** | Contraseñas hasheadas bcrypt | userController.js | Carlos | ✅ Implementado |
| **DATA-003** | Sanitización de inputs | validateMiddleware.js | Anthony | ✅ Implementado |
| **DATA-004** | No logging de datos sensibles | userController.js | Carlos | ✅ Implementado |
| **DATA-005** | Tokens JWT firmados | userController.js | Carlos | ⚠️ Mejorar secreto |

### 1.4 Gestión de Sesiones (REQ-SESS)

| ID | Requisito | Componente | Responsable | Estado |
|----|-----------|------------|-------------|--------|
| **SESS-001** | Single session por usuario | auth.js | Anthony | ✅ Implementado |
| **SESS-002** | Detección inactividad | sessionManager.js | Juan | ✅ Implementado |
| **SESS-003** | Cierre multi-ventana | auth.js | Anthony | ✅ Implementado |
| **SESS-004** | Notificación timeout | SessionStatus.js | Juan | ✅ Implementado |

## 2. REQUISITOS NO FUNCIONALES DE SEGURIDAD

### 2.1 Rendimiento (REQ-PERF)

| ID | Requisito | Métrica Actual | Objetivo | Responsable |
|----|-----------|----------------|----------|-------------|
| **PERF-001** | Tiempo login biométrico | ~2 segundos | < 3 segundos | Juan |
| **PERF-002** | Tiempo respuesta API | ~200ms | < 500ms | Carlos |
| **PERF-003** | Uso memoria modelos IA | ~35MB | < 50MB | Juan |
| **PERF-004** | Carga inicial frontend | ~5 segundos | < 8 segundos | Juan |

### 2.2 Disponibilidad (REQ-AVAIL)

| ID | Requisito | Implementación | Responsable |
|----|-----------|----------------|-------------|
| **AVAIL-001** | Rate limiting DoS protection | express-rate-limit | Anthony |
| **AVAIL-002** | Pool conexiones DB | pg.Pool con límite | Carlos |
| **AVAIL-003** | Timeout requests | axios 10 segundos | Juan |
| **AVAIL-004** | Fallback a password | Login tradicional | Carlos |

### 2.3 Auditabilidad (REQ-AUDIT)

| ID | Requisito | Implementación | Responsable |
|----|-----------|----------------|-------------|
| **AUDIT-001** | Logging eventos seguridad | Winston logger | Carlos |
| **AUDIT-002** | Timestamp registros | registration_date DEFAULT NOW() | Carlos |
| **AUDIT-003** | Track login fallidos | Rate limiting counter | Anthony |
| **AUDIT-004** | Blacklist tokens usado | blacklist.has() | Carlos |

## 3. REQUISITOS DE CUMPLIMIENTO

### 3.1 Privacidad (GDPR-like)

| ID | Requisito | Implementación | Responsable |
|----|-----------|----------------|-------------|
| **PRIV-001** | Derecho al olvido | DELETE user endpoint | Carlos |
| **PRIV-002** | Eliminar biometría | removeFaceEmbedding() | Juan |
| **PRIV-003** | Minimización datos | Solo embeddings necesarios | Carlos |
| **PRIV-004** | Consentimiento biometría | Password required para registro | Juan |

### 3.2 Configuración Segura

| ID | Requisito | Estado Actual | Acción Requerida | Responsable |
|----|-----------|---------------|------------------|-------------|
| **CONF-001** | Claves en variables entorno | ❌ Hardcodeadas | Mover a .env | Carlos |
| **CONF-002** | SSL/TLS en producción | ❌ No implementado | Configurar nginx | Anthony |
| **CONF-003** | CORS restringido | ✅ Solo localhost | Mantener | Juan |
| **CONF-004** | Headers seguridad | ✅ Helmet.js | Mantener | Anthony |

## 4. MATRIZ DE TRAZABILIDAD

### Backend - Carlos Campoverde

- `userController.js` → AUTH-001, AUTH-002, AUTH-005, DATA-002, DATA-004, DATA-005
- `encryption.js` → DATA-001
- `db.js` → CONF-001 (pendiente)
- `blacklist.js` → AUTH-005

### Frontend - Juan Pasquel

- `Login.js` → AUTH-002, PERF-001
- `AdminDashboard.js` → AUTHZ-003
- `ClientDashboard.js` → AUTHZ-004
- `sessionManager.js` → AUTH-004, SESS-002
- `ProfileSettings.js` → PRIV-002, PRIV-004

### Middleware - Anthony Villarreal

- `authMiddleware.js` → AUTHZ-002, AUTHZ-005
- `validateMiddleware.js` → DATA-003
- `index.js` → AUTH-003, AVAIL-001
- `auth.js` → AUTH-006, SESS-001, SESS-003

## 5. PRIORIDADES DE IMPLEMENTACIÓN

### Prioridad Alta (Semana 1)

1. **CONF-001:** Mover claves a variables de entorno (Carlos)
2. **DATA-005:** Fortalecer secreto JWT (Carlos)
3. **AUTH-003:** Revisar rate limiting thresholds (Anthony)

### Prioridad Media (Semana 2)

4. **CONF-002:** Configurar SSL para producción (Anthony)
5. **PERF-001:** Optimizar carga modelos IA (Juan)
6. **AUDIT-001:** Mejorar logging de seguridad (Carlos)

### Prioridad Baja (Semana 3+)

7. Liveness detection para biometría
8. 2FA opcional
9. Auditoría de seguridad externa

## 6. CRITERIOS DE ACEPTACIÓN

### Para cada requisito:

1. ✅ Código implementado y en repositorio
2. ✅ Pruebas unitarias pasando
3. ✅ Code review por otro miembro del equipo
4. ✅ Documentación actualizada
5. ✅ No regresiones en funcionalidad existente

### Ejemplo para AUTH-001:

```javascript
// Criterio 1: Implementado
async login(req, res) {
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Contraseña inválida' });
}

// Criterio 2: Prueba unitaria
test('login fails with wrong password', async () => {
  const res = await request(app).post('/auth/login').send({
    email: 'test@example.com',
    fallbackPassword: 'wrong'
  });
  expect(res.status).toBe(401);
});
```

## 7. VERIFICACIÓN Y VALIDACIÓN

### Responsabilidades por Rol:

| Actividad | Carlos | Juan | Anthony |
|-----------|--------|------|---------|
| Desarrollo requisitos | Backend | Frontend | Middleware |
| Pruebas unitarias | Jest tests | React tests | Jest tests |
| Code review | Revisa Anthony | Revisa Carlos | Revisa Juan |
| Pentesting básico | API endpoints | Client-side | Middleware |

### Frecuencia de verificación:

- **Diario:** Pruebas automatizadas (GitHub Actions)
- **Semanal:** Revisión de requisitos cumplidos
- **Por release:** Validación completa con checklist

## 8. ACTUALIZACIÓN DE REQUISITOS

### Proceso para nuevos requisitos:

1. Crear issue en GitHub con label `security-requirement`
2. Discutir en reunión semanal de seguridad (lunes 10AM)
3. Asignar responsable y fecha estimada
4. Implementar con pruebas
5. Actualizar este documento

### Plantilla para nuevos requisitos:

```markdown
## [ID-REQUISITO]: [Descripción breve]

**Justificación:** [Por qué es necesario]
**Componentes afectados:** [Archivos .js]
**Responsable:** [Carlos/Juan/Anthony]
**Fecha estimada:** 24/01/2026

**Criterios aceptación:**
1. [Criterio 1]
2. [Criterio 2]

**Estado:** [Pendiente/En desarrollo/Completado]
```

---

### Aprobado por:

- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________

**Fecha aprobación:** 18/01/2026  
**Próxima revisión:** 05/02/2026