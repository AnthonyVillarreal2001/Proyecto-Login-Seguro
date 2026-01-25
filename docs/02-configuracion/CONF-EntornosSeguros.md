# CONFIGURACIÓN SEGURA DE ENTORNOS
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos (Backend), Juan (Frontend), Anthony (Middleware)  
**Versión:** 1.0

## 1. CONFIGURACIÓN BACKEND

### 1.1 Base de Datos (Carlos)
```javascript
// db.js - CORREGIR
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'secure_app_db',
  password: process.env.DB_PASSWORD, // ⚠️ NO hardcodear '1234'
  port: process.env.DB_PORT || 5432
};
```

### 1.2 Encriptación (Carlos)
```javascript
// encryption.js - CORREGIR
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // ✅ Variables entorno
```

### 1.3 JWT (Carlos)
```javascript
// userController.js - CORREGIR  
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' });
```

## 2. CONFIGURACIÓN FRONTEND

### 2.1 API Client (Juan)
```javascript
// auth.js - Configuración
axios.defaults.baseURL = process.env.REACT_APP_API_URL;
axios.defaults.timeout = 10000; // 10 segundos
```

### 2.2 Session Manager (Juan)
```javascript
// sessionManager.js
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const WARNING_TIME = 4 * 60 * 1000; // 4 minutos para advertencia
```

## 3. CONFIGURACIÓN MIDDLEWARE

### 3.1 Rate Limiting (Anthony)
```javascript
// index.js
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 intentos máximo
  message: 'Demasiadas solicitudes'
});
```

### 3.2 Helmet.js (Anthony)
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}));
```

## 4. VARIABLES DE ENTORNO

### 4.1 Desarrollo (.env.development)
```bash
DB_PASSWORD=dev_password_123
JWT_SECRET=dev_jwt_secret_32_chars
ENCRYPTION_KEY=dev_encryption_key_32_bytes
NODE_ENV=development
```

### 4.2 Producción (.env.production)
```bash
DB_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -base64 32)
NODE_ENV=production
```

## 5. CHECKLIST POR ROL

### Checklist Carlos (Backend):
- DB password en variable entorno
- JWT secret en variable entorno
- Clave encriptación en variable entorno
- bcrypt con costo 10 mínimo
- Parámetros preparados en todas las queries

### Checklist Juan (Frontend):
- API URL en variable entorno
- Timeout sesión 5 minutos
- Cámara se detiene después de uso
- No almacenar passwords en estado

### Checklist Anthony (Middleware):
- Rate limiting configurado
- Headers de seguridad (Helmet)
- CORS restringido a localhost:3000
- Validación de todos los inputs

## 6. HERRAMIENTAS

### 6.1 Verificación:
```bash
# Verificar vulnerabilidades
npm audit

# Verificar cobertura
npm test -- --coverage

# Verificar linting
npm run lint
```

### 6.2 Scripts útiles:
```bash
# Generar claves seguras
openssl rand -base64 32  # Para ENCRYPTION_KEY
openssl rand -base64 48  # Para JWT_SECRET
```

## 7. RESPONSABILIDADES

| Configuración | Responsable | Frecuencia Verificación |
|---------------|-------------|------------------------|
| Base de datos | Carlos | Semanal |
| Encriptación | Carlos | Mensual |
| Frontend | Juan | Por release |
| Middleware | Anthony | Por despliegue |

---

## Aprobado por:

- **Carlos Campoverde:** __________
- **Juan Pasquel:** __________
- **Anthony Villarreal:** __________

**Fecha:** [FECHA]