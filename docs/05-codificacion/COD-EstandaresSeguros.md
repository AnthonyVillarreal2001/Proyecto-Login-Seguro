# ESTÁNDARES DE CODIFICACIÓN SEGURA
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Versión:** 1.0

## 1. REGLAS GENERALES

### 1.1 Para todo el equipo
- ✅ Usar ESLint con reglas de seguridad
- ✅ Siempre validar inputs del usuario
- ✅ Nunca loggear datos sensibles
- ✅ Usar parámetros preparados para SQL
- ✅ Manejar TODOS los errores (try/catch)

## 2. BACKEND - NODE.JS (Carlos)

### 2.1 Autenticación y Tokens

```javascript
// ❌ PROHIBIDO
jwt.sign(payload, 'secret_key', { expiresIn: '24h' });

// ✅ OBLIGATORIO
jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' });
```

### 2.2 Contraseñas y Hashing

```javascript
// ❌ PROHIBIDO
const hash = await bcrypt.hash(password, 5);

// ✅ OBLIGATORIO
const hash = await bcrypt.hash(password, 10); // mínimo costo 10
```

### 2.3 Base de Datos PostgreSQL

```javascript
// ❌ PROHIBIDO
pool.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ OBLIGATORIO
pool.query('SELECT * FROM users WHERE email = $1', [email]);
```

### 2.4 Encriptación

```javascript
// ❌ PROHIBIDO
const ENCRYPTION_KEY = 'mi_clave_facil';

// ✅ OBLIGATORIO
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
```
## 3. FRONTEND - REACT (Juan)

### 3.1 Almacenamiento de Tokens

```javascript
// ⚠️ ACEPTABLE (con limitaciones)
localStorage.setItem('token', token);

// ✅ MEJOR PRÁCTICA
// Usar HttpOnly cookies cuando sea posible
```

### 3.2 Biometría y Cámara

```javascript
// ✅ OBLIGATORIO
// Siempre detener cámara después de uso
useEffect(() => {
  return () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };
}, []);
```

### 3.3 Gestión de Estado Segura

```javascript
// ❌ PROHIBIDO
setUser({ ...user, password: e.target.value });

// ✅ OBLIGATORIO
// No almacenar contraseñas en estado del componente
```
## 4. MIDDLEWARE Y VALIDACIÓN (Anthony)

### 4.1 Validación de Inputs

```javascript
// ✅ OBLIGATORIO usar express-validator
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('fallbackPassword').isLength({ min: 8 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];
```

### 4.2 Rate Limiting

```javascript
// ✅ CONFIGURACIÓN MÍNIMA
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 intentos
  message: 'Demasiadas solicitudes'
});
```
## 5. PATRONES PROHIBIDOS

### 5.1 Nunca usar:

```javascript
eval() // ❌
Function() // ❌
setTimeout(codeString) // ❌
exec() o spawn() sin sanitizar // ❌
console.log(password) // ❌
```

### 5.2 Nunca hacer:

- Hardcodear credenciales
- Deshabilitar SSL/TLS
- Usar algoritmos de encriptación débiles (MD5, SHA1)
- Exponer detalles de error al cliente

## 6. CHECKLIST DE CODE REVIEW

### Checklist para Carlos Campoverde (Backend):

- JWT secret viene de variable entorno
- bcrypt con costo mínimo 10
- Parámetros preparados en todas las queries
- Embeddings encriptados con AES-256
- No `console.log` de datos sensibles
- Manejo de errores con try/catch

### Checklist para Juan Pasquel (Frontend):

- Cámara se detiene correctamente
- No almacenar passwords en estado
- Validación de inputs antes de enviar
- Timeout de sesión configurado
- CSP headers adecuados

### Checklist para Anthony Villarreal (Middleware):

- Validación de todos los inputs
- Rate limiting en endpoints críticos
- Headers de seguridad (Helmet)
- Sanitización de datos
- Logging de eventos de seguridad

## 7. HERRAMIENTAS OBLIGATORIAS

### 7.1 Para todos:

- **ESLint** con plugin de seguridad
- **Pre-commit hooks** que ejecuten tests
- **Editor** configurado con formato automático

### 7.2 Comandos requeridos:

```bash
# Antes de cada commit
npm run lint
npm test

# Semanalmente
npm audit
```
## 8. EJEMPLOS DE CÓDIGO SEGURO

### 8.1 Ejemplo completo - Login seguro:

```javascript
// userController.js - Carlos
async login(req, res) {
  try {
    const { email, fallbackPassword } = req.body;
    
    // Validación ya hecha por middleware de Anthony
    const user = await UserModel.findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    const match = await bcrypt.compare(fallbackPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    // Token seguro
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    
    res.json({ token, message: 'Login exitoso' });
  } catch (err) {
    // Loggear error sin datos sensibles
    logger.error('Login error', { timestamp: new Date(), error: err.message });
    res.status(500).json({ error: 'Error interno' });
  }
}
```
## 9. SANCIONES POR INCUMPLIMIENTO

### Nivel 1 (Primera vez):
- Revisión de estándares con Security Lead
- Corregir código en 24 horas

### Nivel 2 (Reincidente):
- No puede hacer merge por 1 semana
- Capacitación obligatoria

### Nivel 3 (Vulnerabilidad crítica):
- Suspensión de permisos de commit
- Revisión completa de su código

---

### Aprobado por:

- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________

**Fecha:** 20/01/2026