# REGISTRO DE VULNERABILIDADES CONOCIDAS
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde, Juan Pasquel, Anthony Villarreal  
**Fecha:** 30/01/2026

## 1. VULNERABILIDADES ACTIVAS

### VULN-001: Clave encriptación hardcodeada
- **Estado:** EN DESARROLLO
- **Severidad:** Alta
- **Reporte:** 25/01/2026
- **SLA:** 72 horas

**Ubicación:** `backend/utils/encryption.js`

**Código vulnerable:**
```javascript
const ENCRYPTION_KEY = 'supersecretkey32bytessupersecretkey'; // ❌
```

**Impacto:** Exposición embeddings faciales si código es accedido.

**Solución:** Usar variable de entorno.

**Responsable:** Carlos Campoverde  
**Fecha estimada fix:** 28/01/2026

### VULN-002: JWT secret débil
- **Estado:** PENDIENTE
- **Severidad:** Media
- **Reporte:** 26/01/2026
- **SLA:** 7 días

**Ubicación:** `controllers/userController.js`

**Código vulnerable:**
```javascript
jwt.sign({...}, 'secret_key', { expiresIn: '5m' }); // ❌
```

**Impacto:** Posible falsificación de tokens.

**Solución:** Variable de entorno con mínimo 32 caracteres.

**Responsable:** Carlos Campoverde  
**Fecha estimada fix:** 31/01/2026

### VULN-003: No liveness detection
- **Estado:** PENDIENTE
- **Severidad:** Media
- **Reporte:** 20/01/2026
- **SLA:** 14 días

**Componente:** `components/Login.js`

**Impacto:** Spoofing con foto/video posible.

**Solución:** Implementar detección de parpadeo/movimiento.

**Responsable:** Juan Pasquel  
**Fecha estimada fix:** 05/02/2026

## 2. VULNERABILIDADES REMEDIADAS

### VULN-004: Password en logs
- **Fecha cierre:** 22/01/2026
- **Severidad:** Media
- **Remediado en:** 2 días

**Solución:** Removido `console.log(password)` de `userController.js`

### VULN-005: CORS muy abierto
- **Fecha cierre:** 19/01/2026
- **Severidad:** Baja
- **Remediado en:** 1 día

**Solución:** Limitado a `origin: 'http://localhost:3000'`

---

## 3. DEPENDENCIAS VULNERABLES

**npm audit** (ejecutado hoy):

```bash
found 0 vulnerabilities
```

**Dependencias críticas monitoreadas:**

| Paquete      | Versión | Estado               |
| ------------ | ------- | -------------------- |
| express      | 5.2.1   | ✅ Seguro             |
| pg           | 8.17.1  | ✅ Seguro             |
| bcrypt       | 6.0.0   | ✅ Seguro             |
| jsonwebtoken | 9.0.3   | ✅ Seguro             |
| face-api.js  | 0.22.2  | ⚠️ Verificar checksum |

---

## 4. TENDENCIAS

### Vulnerabilidades por mes

| Período                | Total | Crítica | Alta | Media | Baja |
| ---------------------- | ----- | ------- | ---- | ----- | ---- |
| Enero 2026             | 3     | 0       | 1    | 2     | 0    |
| Febrero 2026 (parcial) | 2     | 0       | 1    | 1     | 0    |

### Tiempo promedio remediación

| Mes                    | Promedio |
| ---------------------- | -------- |
| Enero 2026             | 2.3 días |
| Febrero 2026 (parcial) | 2.8 días |

---

## 5. COMPONENTES MÁS VULNERABLES

### Análisis por componente

- **userController.js** - 2 vulnerabilidades
- **encryption.js** - 1 vulnerabilidad  
- **Login.js** - 1 vulnerabilidad

**Acción:** Revisión enfocada en estos componentes.

---

## 6. PLAN DE PREVENCIÓN

### Próximas revisiones

- **03/02/2026:** Revisión middleware validación (Anthony)
- **05/02/2026:** Pentesting endpoints auth (Juan)
- **04/02/2026:** Rotación claves encriptación (Carlos)

### Mejoras proceso

- [ ] Añadir escaneo SAST en CI/CD
- [ ] Implementar secret scanning para commits
- [ ] Capacitación OWASP Top 10

---

## 7. CONTACTOS

### Urgencias (24/7)

| Nombre             | Teléfono         | Especialidad          |
| ------------------ | ---------------- | --------------------- |
| Carlos Campoverde  | +593 95 878 9219 | Backend, DB           |
| Juan Pasquel       | +593 99 701 7861 | Frontend, Biometría   |
| Anthony Villarreal | +593 98 387 4232 | Seguridad, Middleware |

### Procedimiento urgente

1. Llamar a Security Lead (Anthony)
2. Si no contesta, llamar a Carlos
3. Activar protocolo de incidente

---

**Última actualización:** 30/01/2026  
**Próxima revisión:** 05/02/2026