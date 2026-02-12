# PROCESO DE GESTIÓN DE VULNERABILIDADES
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde, Juan Pasquel, Anthony Villarreal  
**Versión:** 1.0

## 1. FLUJO GENERAL

**Proceso:** Reporte → Clasificación → Asignación → Remediación → Verificación → Cierre

---

## 2. CLASIFICACIÓN

### 2.1 Severidad
| Nivel       | Tiempo Remediacón | Ejemplo                        |
| ----------- | ----------------- | ------------------------------ |
| **Crítica** | 24 horas          | Inyección SQL activa           |
| **Alta**    | 72 horas          | Clave encriptación hardcodeada |
| **Media**   | 7 días            | Rate limiting muy permisivo    |
| **Baja**    | 14 días           | Mensajes error muy detallados  |

### 2.2 Responsables por Tipo
| Tipo       | Reporta    | Clasifica | Remedía | Verifica |
| ---------- | ---------- | --------- | ------- | -------- |
| Backend    | Cualquiera | Carlos    | Carlos  | Anthony  |
| Frontend   | Cualquiera | Juan      | Juan    | Carlos   |
| Middleware | Cualquiera | Anthony   | Anthony | Juan     |

## 3. CANALES DE REPORTE

### 3.1 Interno

- **GitHub Issues** con label `security`
- **WhatsApp grupo** para urgentes
- **Reunión semanal** de seguridad

### 3.2 Externo

- **Email:** seguridad@tudominio.com
- **Formulario** en sitio web (si aplica)

## 4. PLANTILLA DE REPORTE

**[VULN-XXX]: Descripción breve**

**Reportado por:** [Nombre]  
**Fecha:** 12/01/2026  
**Componente:** [userController.js, Login.js, etc.]

### Descripción

[Qué hace la vulnerabilidad]

### Ubicación

**Archivo:** `ruta/al/archivo.js`  
**Línea:** XX

### Impacto

[Qué puede hacer un atacante]

### Severidad

**Nivel:** [Crítica/Alta/Media/Baja]

### Solución propuesta

[Ideas para arreglar]

### Estado

- [ ] Reportado
- [ ] Confirmado
- [ ] En desarrollo
- [ ] En testing
- [ ] Cerrado

**Responsable:** @Carlos / @Juan / @Anthony
---

## 5. HERRAMIENTAS

### 5.1 Automatización

```bash
# Verificar dependencias
npm audit --audit-level=high

# Ejecutar tests de seguridad
npm test -- tests/*security*.test.js

# Linting seguridad
npm run lint -- --rule 'security/*'
```

### 5.2 Monitoreo

```javascript
// Detección automática en index.js (Anthony)
app.use((req, res, next) => {
  const suspicious = ['SELECT.*FROM', 'script>', 'DROP TABLE'];
  const bodyStr = JSON.stringify(req.body).toUpperCase();
  
  if (suspicious.some(pattern => bodyStr.includes(pattern))) {
    logger.warn(`Possible attack from ${req.ip}`);
    return res.status(400).json({ error: 'Invalid request' });
  }
  next();
});
```
---

## 6. COMUNICACIÓN

### 6.1 Interna

| Severidad    | Acciones                          |
| ------------ | --------------------------------- |
| Crítica/Alta | WhatsApp inmediato a los 3        |
| Media        | GitHub Issue + mencionar en daily |
| Baja         | GitHub Issue solamente            |

### 6.2 Externa (si aplica)

- **Usuarios afectados:** Email en 72 horas
- **Autoridades:** Según legislación local (GDPR, etc.)

---

## 7. RESPONSABILIDADES

### Carlos Campoverde

- Clasificación vulnerabilidades backend
- Desarrollo de fixes backend
- Rotación de claves si necesario

### Juan Pasquel

- Clasificación vulnerabilidades frontend
- Desarrollo de fixes frontend
- Actualización modelos `face-api.js`

### Anthony Villarreal

- Coordinación del proceso
- Verificación de fixes
- Comunicación con stakeholders

---

## Aprobación

| Responsable        | Firma      | Fecha      |
| ------------------ | ---------- | ---------- |
| Carlos Campoverde  | __________ | 12/01/2026 |
| Juan Pasquel       | __________ | 12/01/2026 |
| Anthony Villarreal | __________ | 12/01/2026 |