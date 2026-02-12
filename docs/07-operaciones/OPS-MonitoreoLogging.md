# MONITOREO Y LOGGING DE SEGURIDAD
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Versión:** 1.0

## 1. CONFIGURACIÓN DE LOGGING

### 1.1 Backend - Winston (Anthony)
```javascript
// index.js - Configuración actual
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Configuración MEJORADA
const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/security.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ]
});
```

### 1.2 Eventos que SE DEBEN loggear:
```javascript
// userController.js - Carlos implementa
async login(req, res) {
  try {
    // Login exitoso
    logger.info('Login exitoso', { 
      user: user.id, 
      ip: req.ip,
      method: 'password/biometric' 
    });
    
    // Login fallido
    if (!match) {
      securityLogger.warn('Login fallido', {
        email: req.body.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  } catch (err) {
    securityLogger.error('Error en login', {
      error: err.message,
      stack: err.stack
    });
  }
}
```

### 1.3 Eventos que NO DEBEN loggear:
```javascript
// ❌ PROHIBIDO
console.log('Password:', password);
console.log('Token:', token);
console.log('Embedding:', embedding);

// ✅ ACEPTABLE
console.log('Login attempt for user:', userId);
console.log('Biometric registration successful');
```
## 2. MONITOREO EN TIEMPO REAL

### 2.1 Métricas a monitorear:

| Métrica | Umbral Alerta | Responsable | Acción |
|---------|---------------|-------------|--------|
| Login fallidos/minuto | > 10 | Anthony | Bloquear IP |
| Uso CPU backend | > 80% por 5 min | Carlos | Escalar/optimizar |
| Tiempo respuesta API | > 1000ms | Anthony | Investigar |
| Embeddings guardados/hora | > 100 | Juan | Verificar autenticidad |
| Tokens blacklisted | > 50 en 1 hora | Carlos | Investigar ataque |

### 2.2 Dashboard de monitoreo:
```
URL: http://localhost:3001/grafana (si se implementa)
Usuario: admin / Contraseña: [definida por Carlos]
```
## 3. ALERTAS CONFIGURADAS

### 3.1 Alertas por WhatsApp (urgentes):
```javascript
// Script de alerta - Anthony mantiene
const sendAlert = (message, level) => {
  if (level === 'CRITICAL') {
    // Enviar a grupo WhatsApp
    whatsapp.send('+593958789219,+593997017861,+593983874232', 
      `🚨 ALERTA SEGURIDAD: ${message}`);
  }
};

// Ejemplo de uso en código
if (failedLogins > 20) {
  sendAlert('Posible ataque fuerza bruta detectado', 'CRITICAL');
}
```

### 3.2 Alertas por Email (diarias):
```javascript
// Reporte diario - Carlos configura cron job
const dailyReport = {
  to: ['cdcampoverde@espe.edu.ec', 'jdpasquel1@espe.edu.ec', 'anvillarreal@espe.edu.ec'],
  subject: 'Reporte Seguridad Diario',
  body: `Logins fallidos: ${failedCount}\nNuevos usuarios: ${newUsers}\nAlertas: ${alerts}`
};
```
## 4. RETENCIÓN Y ROTACIÓN

### 4.1 Política de retención:

| Tipo de log | Retención | Ubicación | Responsable |
|-------------|-----------|-----------|-------------|
| security.log | 90 días | logs/security.log | Anthony |
| error.log | 30 días | logs/error.log | Carlos |
| access.log | 7 días | logs/access.log | Anthony |
| audit DB | 180 días | PostgreSQL audit_log | Carlos |

### 4.2 Script de rotación:
```bash
#!/bin/bash
# rotate-logs.sh - Carlos ejecuta semanalmente
find logs/ -name "*.log" -mtime +30 -delete
find logs/ -name "*.log" -size +5M -exec gzip {} \;
```
## 5. AUDITORÍA DE LOGS

### 5.1 Revisión semanal (Lunes 9AM):
**Participantes:** Carlos Campoverde, Juan Pasquel, Anthony Villarreal  
**Duración:** 30 minutos

**Agenda:**
- Revisar eventos críticos de la semana
- Identificar patrones sospechosos
- Actualizar reglas de alerta
- Asignar acciones

### 5.2 Checklist de auditoría:
```markdown
## AUDITORÍA DE LOGS - Semana [XX]
**Fecha:** 30/01/2026
**Revisado por:** [Nombres]

### Eventos críticos encontrados:
1. [Evento 1] - Acción tomada: [Acción]
2. [Evento 2] - Acción tomada: [Acción]

### Patrones identificados:
- [Patrón 1]
- [Patrón 2]

### Acciones acordadas:
- [ ] [Acción] - Responsable: [Nombre] - Fecha: 02/02/2026

### Firmas:
- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________
```
## 6. HERRAMIENTAS UTILIZADAS

### 6.1 Actualmente implementadas:
- **Winston:** Logging backend (Anthony)
- **console.log:** Logging frontend (Juan) - mejorar
- **PostgreSQL:** Logs de auditoría en DB (Carlos)

### 6.2 Por implementar (Prioridad):
- **Sentry:** Para errores frontend (Juan - semana 1)
- **Grafana/Loki:** Para visualización logs (Anthony - semana 2)
- **ELK Stack:** Para búsqueda avanzada (Carlos - mes 1)

## 7. RESPONSABILIDADES

### 7.1 Carlos Campoverde:
- Configuración logging PostgreSQL
- Backup y retención de logs DB
- Monitoreo performance backend
- Alertas de uso recursos

### 7.2 Juan Pasquel:
- Logging eventos frontend críticos
- Monitoreo uso de modelos IA
- Alertas de comportamiento anómalo UI
- Comunicación errores a usuarios

### 7.3 Anthony Villarreal:
- Configuración Winston logger
- Alertas de seguridad en tiempo real
- Auditoría semanal de logs
- Mantenimiento herramientas monitoreo

## 8. EJEMPLOS DE LOGS CORRECTOS

### 8.1 Login exitoso:
```json
{
  "timestamp": "2026-01-30T10:30:00Z",
  "level": "info",
  "message": "Login exitoso",
  "userId": 123,
  "ip": "192.168.1.100",
  "method": "biometric",
  "duration": 1200
}
```

### 8.2 Intento sospechoso:
```json
{
  "timestamp": "2026-01-30T10:35:00Z",
  "level": "warn",
  "message": "Multiple failed logins",
  "email": "attacker@example.com",
  "ip": "45.33.22.11",
  "attempts": 15,
  "action": "IP blocked temporarily"
}
```

### 8.3 Error crítico:
```json
{
  "timestamp": "2026-01-30T10:40:00Z",
  "level": "error",
  "message": "Encryption failed",
  "component": "encryption.js",
  "error": "Invalid key length",
  "stack": "..."
}
```
## 9. PLAN DE MEJORA

### 9.1 Fase 1 (1 semana):
- Implementar Sentry para frontend (Juan)
- Configurar alertas WhatsApp (Anthony)
- Establecer revisión semanal (Todos)

### 9.2 Fase 2 (2 semanas):
- Implementar Grafana dashboard (Anthony)
- Añadir logging biométrico detallado (Juan)
- Configurar auditoría DB (Carlos)

### 9.3 Fase 3 (1 mes):
- ELK Stack completo (Carlos)
- Machine learning para detección anomalías (Anthony)
- Logging compliance GDPR (Juan)

---

## Aprobado por:

- **Carlos Campoverde:** __________
- **Juan Pasquel:** __________
- **Anthony Villarreal:** __________
- **Fecha:** 30/01/2026
- **Próxima revisión:** 05/02/2026