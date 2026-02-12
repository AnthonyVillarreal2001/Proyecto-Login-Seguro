# PROCEDIMIENTO DE RESPUESTA A INCIDENTES
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Versión:** 1.0

## 1. CONTACTOS DE EMERGENCIA

### 1.1 Equipo Principal
| Nombre                 | Rol                 | Teléfono         | Disponibilidad     |
| ---------------------- | ------------------- | ---------------- | ------------------ |
| **Carlos Campoverde**  | Backend Lead        | +593 95 878 9219 | 24/7 para críticos |
| **Juan Pasquel**       | Frontend Lead       | +593 99 701 7861 | 8AM-10PM           |
| **Anthony Villarreal** | Security/Middleware | +593 98 387 4232 | 24/7 para críticos |

### 1.2 Canales de Comunicación
- **Urgente:** WhatsApp grupo "Security-Alerts"
- **Prioridad alta:** Llamada telefónica
- **Normal:** Slack #incidentes

## 2. CLASIFICACIÓN DE INCIDENTES

### 2.1 Niveles de Severidad
| Nivel       | Criterios                                          | Tiempo Respuesta | Ejemplo                   |
| ----------- | -------------------------------------------------- | ---------------- | ------------------------- |
| **CRÍTICO** | Pérdida datos, sistema caído, acceso no autorizado | 15 minutos       | Fuga embeddings faciales  |
| **ALTO**    | Vulnerabilidad explotable, performance crítico     | 1 hora           | Rate limiting bypass      |
| **MEDIO**   | Funcionalidad afectada, sin pérdida datos          | 4 horas          | Login biométrico fallando |
| **BAJO**    | Issues menores, mejoras                            | 24 horas         | Logging incompleto        |

## 3. PROCEDIMIENTO PASO A PASO

### 3.1 Fase 1: Detección
```javascript
// En logging configurado por Anthony
logger.error('INCIDENTE DETECTADO', {
  tipo: 'seguridad',
  usuario: user?.id,
  ip: req.ip,
  timestamp: new Date()
});
```

### 3.2 Fase 2: Contención

**Para fuga de datos:**
```sql
-- Carlos ejecuta:
REVOKE CONNECT ON DATABASE secure_app_db FROM PUBLIC;
ALTER DATABASE secure_app_db SET allow_connections = off;
```

**Para ataque activo:**
```javascript
// Anthony bloquea IP
blacklist.addIP(attackerIP);
```

### 3.3 Fase 3: Erradicación

**Ejemplo: Token comprometido**
```javascript
// Carlos ejecuta en userController.js
async revokeAllTokens() {
  await pool.query('UPDATE users SET token_version = token_version + 1');
  blacklist.clear();
}
```

### 3.4 Fase 4: Recuperación
```bash
# Juan restaura frontend
git checkout main
npm run build

# Carlos restaura backend
pm2 restart secure-auth
```

### 3.5 Fase 5: Lecciones Aprendidas
- Reunión post-incidente en 48 horas
- Documentar en `docs/incidentes/`
- Actualizar procedimientos

## 4. ESCENARIOS ESPECÍFICOS

### 4.1 Escenario A: Fuga de Embeddings Faciales
**Síntoma:** Embeddings en texto plano en logs o respuesta API

**Acciones inmediatas:**
- **Carlos:** Detener servicio backend
- **Anthony:** Bloquear acceso a DB
- **Juan:** Notificar a usuarios afectados

**Pasos de remediación:**
- Rotar clave de encriptación
- Re-encriptar todos los embeddings
- Revisar logs para origen de fuga

### 4.2 Escenario B: Ataque de Fuerza Bruta
**Síntoma:** 100+ intentos de login fallidos/minuto

**Acciones inmediatas:**
- **Anthony:** Ajustar rate limiting a 3/5min
- **Carlos:** Añadir CAPTCHA temporal
- **Juan:** Mostrar alerta a usuarios

### 4.3 Escenario C: Spoofing Biométrico Exitoso
**Síntoma:** Login con foto/video reportado

**Acciones inmediatas:**
- **Juan:** Deshabilitar login biométrico temporalmente
- **Carlos:** Forzar re-registro de biometría
- **Anthony:** Implementar liveness detection

## 5. CHECKLIST DE RESPUESTA

### Checklist para Carlos Campoverde (Backend):
- Detener servicios comprometidos
- Hacer backup inmediato de DB
- Rotar claves y credenciales
- Revisar logs para IOC
- Actualizar dependencias vulnerables

### Checklist para Juan Pasquel (Frontend):
- Invalidar tokens en clientes
- Mostrar mensaje de mantenimiento
- Revisar código cliente-side
- Actualizar modelos face-api.js
- Comunicar a usuarios

### Checklist para Anthony Villarreal (Middleware):
- Bloquear IPs atacantes
- Ajustar reglas WAF/firewall
- Revisar configuraciones
- Documentar timeline
- Coordinar comunicación

## 6. PLANTILLA DE REPORTE
```markdown
# REPORTE DE INCIDENTE [ID-001]
**Fecha:** 02/02/2026 10:00
**Reportado por:** [Nombre]
**Nivel:** [Crítico/Alto/Medio/Bajo]

## Resumen
[Descripción breve del incidente]

## Timeline
- **HH:MM** - Detección
- **HH:MM** - Contención (Carlos/Juan/Anthony)
- **HH:MM** - Erradicación
- **HH:MM** - Recuperación
- **HH:MM** - Resuelto

## Impacto
- Usuarios afectados: [X]
- Tiempo de inactividad: [Y] minutos
- Datos comprometidos: [Sí/No - cuáles]

## Causa Raíz
[Qué causó el incidente]

## Acciones Correctivas
1. [Acción 1 - Responsable: Nombre]
2. [Acción 2 - Responsable: Nombre]
3. [Acción 3 - Responsable: Nombre]

## Lecciones Aprendidas
- [Lección 1]
- [Lección 2]

## Firmas
- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________
```

## 7. HERRAMIENTAS DE RESPUESTA

### 7.1 Scripts pre-configurados:
```bash
# emergency-backup.sh (Carlos)
pg_dump -U postgres secure_app_db > backup/emergency-$(date +%s).sql

# block-ip.sh (Anthony)
iptables -A INPUT -s $ATTACKER_IP -j DROP

# revoke-tokens.js (Carlos)
node scripts/revoke-all-tokens.js
```

### 7.2 Monitoreo:
- **Winston logs** con alertas (Anthony)
- **PM2 monitoring** para servicios (Carlos)
- **Google Analytics alerts** (Juan)

## 8. COMUNICACIÓN EXTERNA

### 8.1 Para usuarios:
```markdown
## NOTICIA IMPORTANTE - 02/02/2026

Estimados usuarios,

Estamos experimentando [descripción breve].
Hemos tomado estas medidas:
1. [Medida 1]
2. [Medida 2]

Sistema se recuperará en [tiempo estimado].

Disculpas por los inconvenientes.
Equipo de Seguridad
```

### 8.2 Para autoridades (si aplica):
- **Datos personales comprometidos:** Notificar Agencia de Protección de Datos en 72h
- **Acceso no autorizado:** Consultar con asesor legal

## 9. PRUEBAS DEL PROCEDIMIENTO

## 9. PRUEBAS DEL PROCEDIMIENTO

### 9.1 Simulacros programados:

| Fecha      | Escenario           | Responsable |
| ---------- | ------------------- | ----------- |
| 22/01/2026 | Fuga de embeddings  | Carlos      |
| 29/01/2026 | Ataque DDoS         | Anthony     |
| 03/02/2026 | Spoofing biométrico | Juan        |

### 9.2 Métricas de respuesta:
- **Tiempo promedio detección:** [Meta: < 5 min]
- **Tiempo promedio contención:** [Meta: < 15 min]
- **Tiempo promedio recuperación:** [Meta: < 2 horas]
- **Incidentes críticos en últimos 90 días:** [Meta: 0]

---

## Aprobado por:

- **Carlos Campoverde:** __________
- **Juan Pasquel:** __________
- **Anthony Villarreal:** __________
- **Fecha:** 02/02/2026
- **Próxima revisión:** 05/02/2026