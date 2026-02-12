# MODELO DE AMENAZAS (THREAT MODEL)
**Proyecto:** Sistema de Autenticación Segura con Biometría Facial  
**Equipo:** Carlos Campoverde, Juan Pasquel, Anthony Villarreal  
**Fecha:** 15/01/2026

## 1. DIAGRAMA DE FLUJO DE DATOS

```
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐
│ Cliente │────▶│ Frontend │────▶│ Backend │────▶│ PostgreSQL │
│ (React) │◀────│ (React) │◀────│ (Node.js) │◀────│ DB │
└─────────┘ └──────────┘ └────────────┘ └────────────┘
│ │ │ │
▼ ▼ ▼ ▼
Cámara localStorage blacklist embeddings
(biometría) (token JWT) (tokens malos) (encriptados)
```

## 2. ANÁLISIS STRIDE POR COMPONENTE

### 2.1 Frontend React

| Amenaza | Componente | Descripción | Mitigación |
|---------|------------|-------------|------------|
| **Spoofing** | Login.js | Rostro falso en cámara | Usar face-api.js con modelo entrenado |
| **Tampering** | localStorage | Modificar token JWT | Validación server-side, timeout corto |
| **Repudio** | SessionManager.js | Negar acciones realizadas | Logging de eventos críticos |
| **Info Disclosure** | auth.js | Exponer token en consola | No loggear tokens, usar HttpOnly cookies |
| **DoS** | face-api.js | Carga pesada de modelos | Lazy loading, modelos optimizados |
| **Elevation of Privilege** | AdminDashboard.js | Cliente acceder como admin | Validación de roles en backend |

### 2.2 Backend Node.js

| Amenaza | Componente | Descripción | Mitigación |
|---------|------------|-------------|------------|
| **Spoofing** | userController.js | Credenciales robadas | bcrypt hashing, rate limiting |
| **Tampering** | validateMiddleware.js | Input malicioso | Sanitización con express-validator |
| **Repudio** | blacklist.js | Negar logout | Logging de tokens revocados |
| **Info Disclosure** | encryption.js | Exponer clave AES | Variables de entorno, no hardcode |
| **DoS** | index.js | Many login attempts | Rate limiting (10/5min) |
| **Elevation of Privilege** | authMiddleware.js | Acceso no autorizado | Validación JWT + roles |

### 2.3 Base de Datos

| Amenaza | Componente | Descripción | Mitigación |
|---------|------------|-------------|------------|
| **Spoofing** | db.js | Credenciales DB débiles | Contraseña fuerte, no usar '1234' |
| **Tampering** | userModel.js | SQL injection | Parámetros preparados |
| **Repudio** | users table | Negar registro | Timestamp automático |
| **Info Disclosure** | preferences JSON | Embeddings faciales | Encriptación AES-256 |
| **DoS** | PostgreSQL | Many connections | Pool de conexiones limitado |
| **Elevation of Privilege** | user roles | Cliente accede como admin | Enums ('admin','client') |

## 3. ESCENARIOS DE ATAQUE

### 3.1 Ataque 1: Robo de Embeddings Faciales
**Objetivo:** Obtener embeddings encriptados de la DB  
**Vector:** Acceso a PostgreSQL con credenciales default  
**Mitigación:** Cambiar password '1234', habilitar SSL, encriptar embeddings

### 3.2 Ataque 2: Spoofing Biométrico
**Objetivo:** Acceder con foto/video del usuario  
**Vector:** Usar foto en cámara durante login biométrico  
**Mitigación:** face-api.js con detección de vivacidad (liveness detection)

### 3.3 Ataque 3: Token Hijacking
**Objetivo:** Robar token JWT y reusarlo  
**Vector:** XSS que acceda a localStorage  
**Mitigación:** HttpOnly cookies, timeout corto (5min), blacklisting

### 3.4 Ataque 4: Fuerza Bruta
**Objetivo:** Adivinar contraseña de admin  
**Vector:** Many login attempts  
**Mitigación:** Rate limiting (10 intentos/5min), bcrypt hashing lento

## 4. CONTROLES DE SEGURIDAD IMPLEMENTADOS

### ✅ Implementados

1. **Autenticación:**
   - JWT con expiración 5 minutos
   - bcrypt para contraseñas (costo 10)
   - face-api.js para biometría (threshold 0.6)

2. **Autorización:**
   - Middleware por roles (admin/client)
   - Validación en cada endpoint

3. **Protección de datos:**
   - AES-256 para embeddings faciales
   - Sanitización de inputs
   - Parámetros preparados para SQL

4. **Disponibilidad:**
   - Rate limiting en endpoints críticos
   - Pool de conexiones a DB
   - Timeout de sesión por inactividad

### ⚠️ Por Mejorar

1. **Claves hardcodeadas** en `encryption.js`
2. **No liveness detection** en biometría
3. **JWT secret débil** (`'secret_key'`)
4. **CORS configurado solo para desarrollo**

## 5. SUPOSICIONES DE SEGURIDAD

1. Los modelos face-api.js no están comprometidos
2. PostgreSQL corre en entorno seguro
3. Los usuarios no comparten credenciales
4. La cámara del cliente es confiable
5. El entorno Node.js está actualizado

## 6. RESPONSABILIDADES DEL EQUIPO

| Miembro | Responsabilidades de Seguridad |
|---------|--------------------------------|
| **Carlos Campoverde** | Arquitectura backend, encriptación, base de datos |
| **Juan Pasquel** | Frontend, biometría, gestión de sesiones cliente |
| **Anthony Villarreal** | Middleware, validación, pruebas de seguridad |

## 7. REVISIÓN DEL MODELO

**Próxima revisión:** 05/02/2026

### Cambios significativos requeridos:

- [ ] Implementar liveness detection
- [ ] Mover claves a variables de entorno
- [ ] Añadir 2FA opcional
- [ ] Mejorar logging de seguridad

### Aprobado por:

- [x] Carlos Campoverde
- [x] Juan Pasquel  
- [x] Anthony Villarreal