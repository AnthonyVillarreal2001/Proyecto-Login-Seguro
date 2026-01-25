# INVENTARIO DE ACTIVOS
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos, Juan, Anthony  
**Versión:** 1.0

## 1. ACTIVOS CRÍTICOS

### 1.1 Datos Sensibles
| Activo | Ubicación | Sensibilidad | Dueño |
|--------|-----------|--------------|-------|
| Embeddings faciales | PostgreSQL users.preferences | Alta | Carlos |
| Hashes de contraseñas | PostgreSQL users.password_hash | Alta | Carlos |
| Tokens JWT activos | localStorage frontend | Media | Juan |
| Logs de autenticación | Winston logs | Media | Anthony |

### 1.2 Componentes de Software
| Componente | Responsable | Crítico |
|------------|-------------|---------|
| userController.js | Carlos | Sí |
| encryption.js | Carlos | Sí |
| Login.js | Juan | Sí |
| authMiddleware.js | Anthony | Sí |

## 2. DEPENDENCIAS

### 2.1 Backend (Carlos)
```
express: ^5.2.1
pg: ^8.17.1
bcrypt: ^6.0.0
jsonwebtoken: ^9.0.3
crypto: ^1.0.1
```

### 2.2 Frontend (Juan)
```
react: ^19.2.3
face-api.js: ^0.22.2
axios: ^1.13.2
uuid: ^13.0.0
```

### 2.3 Middleware (Anthony)
```
helmet: ^8.1.0
express-rate-limit: ^8.2.1
express-validator: ^7.3.1
winston: ^3.19.0
```

## 3. ENDPOINTS CRÍTICOS

| Endpoint | Método | Autenticación | Responsable |
|----------|--------|---------------|-------------|
| `/auth/login` | POST | No | Carlos |
| `/auth/biometric/login` | POST | No | Carlos |
| `/profile/save-face-embedding` | POST | Sí | Carlos |
| `/users` (admin) | GET | Admin | Carlos |

## 4. ARCHIVOS DE CONFIGURACIÓN

### 4.1 Sensibles (NO COMMIT):
- `.env` (variables entorno)
- `db.js` (credenciales DB)
- `encryption.js` (lógica encriptación)

### 4.2 Públicos (OK COMMIT):
- `package.json` (dependencias)
- `index.js` (configuración servidor)
- Componentes React

## 5. RESPONSABILIDADES

### Carlos (Backend):
- Base de datos PostgreSQL
- Encriptación embeddings
- Endpoints de autenticación
- Variables de entorno backend

### Juan (Frontend):
- Modelos face-api.js (35MB)
- Gestión de tokens frontend
- Timeout de sesión cliente
- Componentes de biometría

### Anthony (Middleware):
- Configuración seguridad servidor
- Logging y monitoreo
- Rate limiting
- Validación de inputs

## 6. BACKUP

### Backup diario (Carlos):
```bash
pg_dump -U postgres secure_app_db > backup/db-$(date +%Y%m%d).sql
```

### Backup logs (Anthony):
```bash
tar -czf backup/logs-$(date +%Y%m%d).tar.gz logs/
```

### Backup modelos (Juan):
```bash
cp -r public/models/ backup/models-$(date +%Y%m%d)/
```

## 7. ELIMINACIÓN SEGURA

### Para datos de usuario:
```javascript
// En deleteUser (Carlos)
async deleteUser(id) {
  // Anonimizar datos
  await pool.query(`
    UPDATE users SET 
      name = 'Usuario Eliminado',
      email = CONCAT('deleted_', id, '@example.com'),
      preferences = '{}'
    WHERE id = $1
  `, [id]);
}
```

---

**Última actualización:** [FECHA]  
**Responsable inventario:** Carlos Campoverde