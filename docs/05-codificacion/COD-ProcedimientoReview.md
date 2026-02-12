# PROCEDIMIENTO DE CODE REVIEW DE SEGURIDAD
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Versión:** 1.0

## 1. FLUJO DE CODE REVIEW

```
Desarrollador → Crea PR → Asigna Reviewer → Review → Aprobación → Merge
↓ ↓ ↓ ↓ ↓ ↓
Carlos GitHub Juan Checklist Anthony Main
(backend) (frontend) (middleware)
```

## 2. ASIGNACIÓN DE REVIEWERS

### Matriz de responsabilidades:
| Autor del Código         | Reviewer Principal       | Reviewer Secundario      |
| ------------------------ | ------------------------ | ------------------------ |
| **Carlos** (Backend)     | **Anthony** (Middleware) | **Juan** (Frontend)      |
| **Juan** (Frontend)      | **Carlos** (Backend)     | **Anthony** (Middleware) |
| **Anthony** (Middleware) | **Carlos** (Backend)     | **Juan** (Frontend)      |

**Regla:** Nunca reviewear tu propio código.

## 3. CHECKLIST DE REVIEW POR TIPO DE CÓDIGO

### 3.1 Autenticación (Login/Register)

```javascript
// Checklist obligatorio:
[ ] Rate limiting aplicado
[ ] Validación de inputs con express-validator
[ ] bcrypt con costo mínimo 10
[ ] Tokens JWT con expiración 5 minutos
[ ] No logging de contraseñas
[ ] Manejo de errores apropiado
```

### 3.2 Base de Datos (Queries)

```javascript
// Checklist obligatorio:
[ ] Parámetros preparados (NO concatenación)
[ ] No SELECT * (solo columnas necesarias)
[ ] Validación de IDs (isInt en middleware)
[ ] Transacciones para operaciones críticas
```

### 3.3 Biometría (face-api.js)

```javascript
// Checklist obligatorio:
[ ] Cámara se detiene después de uso
[ ] Threshold configurado (0.6)
[ ] Embeddings encriptados antes de guardar
[ ] Password requerida para registrar/eliminar
[ ] Modelos cargados correctamente
```
4. PLANTILLA DE PULL REQUEST
Título del PR:
text
[TIPO] [COMPONENTE]: Descripción breve
Ejemplo: [SECURITY] userController: Fix hardcoded encryption key

Descripción del PR:
markdown
## Cambios realizados
- [Descripción breve de cambios]

## Checklist de seguridad
- [ ] Validación de inputs implementada
- [ ] No datos sensibles en logs
- [ ] Tests actualizados/pasando
- [ ] Documentación actualizada si aplica

## Archivos modificados
- `backend/controllers/userController.js`
- `backend/utils/encryption.js`

## Reviewer asignado
@Anthony (para cambios de Carlos)
@Carlos (para cambios de Juan)
@Juan (para cambios de Anthony)

## Evidencia de pruebas

```bash
npm test -- userController.test.js
# ✅ Todos los tests pasando
```

## 5. CRITERIOS DE APROBACIÓN

### 5.1 Para aprobar un PR:
1. ✅ Todos los checks de GitHub pasan
2. ✅ Review de al menos 1 persona
3. ✅ Checklist de seguridad completo
4. ✅ Tests pasan (cobertura > 80%)
5. ✅ No vulnerabilidades de seguridad conocidas

### 5.2 Para rechazar un PR:
1. ❌ Hardcoded secrets encontrados
2. ❌ SQL injection posibles
3. ❌ Falta validación de inputs
4. ❌ Tests fallando
5. ❌ Cobertura de tests < 80%

## 6. HERRAMIENTAS DE REVIEW

### 6.1 Obligatorias:

- **GitHub PR Review:** Comentarios en línea
- **ESLint:** `npm run lint` debe pasar
- **Jest:** `npm test` debe pasar
- **npm audit:** Sin vulnerabilidades críticas

### 6.2 Recomendadas:

- `/security` para issues de seguridad
- **SonarQube** (si está disponible)
- **CodeQL** (GitHub Advanced Security)

## 7. EJEMPLO DE REVIEW REAL

### PR: [SECURITY] Fix JWT secret

**Autor:** Carlos  
**Reviewer:** Anthony  
**Estado:** ✅ Aprobado

### Comentarios del review:

```javascript
// Archivo: userController.js - Línea 45
// ❌ COMENTARIO DE ANTHONY:
jwt.sign({...}, 'secret_key', { expiresIn: '5m' });
// Esto debe venir de variable de entorno

// ✅ RESPUESTA DE CARLOS:
jwt.sign({...}, process.env.JWT_SECRET, { expiresIn: '5m' });
// Corregido, usando variable de entorno
```

### Resumen del review:

- **Issues encontrados:** 1 (hardcoded secret)
- **Severidad:** Alta
- **Resuelto:** Sí
- **Tiempo total:** 15 minutos

## 8. MÉTRICAS DE REVIEW

### 8.1 Métricas por desarrollador:

| Desarrollador | PRs Revisados | Promedio Issues | Tiempo Promedio |
| ------------- | ------------- | --------------- | --------------- |
| Carlos        | 12            | 1.5             | 20 min          |
| Juan          | 10            | 2.0             | 25 min          |
| Anthony       | 15            | 1.2             | 18 min          |

### 8.2 Métricas de calidad:

- **Tasa de aprobación:** 95%
- **Issues críticos atrapados:** 8
- **Vulnerabilidades en producción:** 0
- **Tiempo promedio review:** 21 minutos

## 9. REUNIONES DE REVIEW

### 9.1 Daily Sync (5 minutos):

- Qué se va a desarrollar hoy
- Posibles riesgos de seguridad
- Dependencias entre tareas

### 9.2 Weekly Security Review (30 minutos - Lunes 10AM):

- Revisar PRs controversiales
- Discutir vulnerabilidades encontradas
- Actualizar estándares si necesario

### 9.3 Mensual (1 hora):

- Revisar métricas de review
- Identificar patrones de problemas
- Plan de mejora continua

## 10. ESCALAMIENTO DE PROBLEMAS

### Si hay desacuerdo en el review:

- **Nivel 1:** Discutir técnicamente en PR comments
- **Nivel 2:** Reunión rápida (15 min) entre desarrolladores
- **Nivel 3:** Involucrar a todo el equipo en daily sync
- **Nivel 4:** Decisión final de Carlos (tech lead)

### Casos de emergencia (vulnerabilidad crítica):

- Crear issue con label `security-critical`
- Notificar por WhatsApp al equipo completo
- Reunión inmediata (max 1 hora)
- Hotfix y deploy de emergencia

## 11. PLANTILLA DE ISSUES DE SEGURIDAD

```markdown
## [SECURITY] [COMPONENTE]: Descripción

**Reportado por:** [Carlos/Juan/Anthony]
**Fecha:** 20/01/2026
**Severidad:** [Crítica/Alta/Media/Baja]

### Descripción
[Qué está mal]

### Ubicación
`ruta/al/archivo.js` - Línea XX

### Impacto
[Qué puede pasar]

### Solución propuesta
[Cómo arreglarlo]

### Checklist
- [ ] Reproducir el issue
- [ ] Asignar a responsable
- [ ] Desarrollar fix
- [ ] Review de seguridad
- [ ] Testear
- [ ] Deploy

### Asignado a
@Carlos / @Juan / @Anthony

### Fecha estimada fix
27/01/2026
```
## 12. RESPONSABILIDADES FINALES

### Carlos Campoverde (Backend Lead):

- Aprobación final de PRs de backend
- Decisión en disputas técnicas
- Mantenimiento de estándares backend

### Juan Pasquel (Frontend Lead):

- Aprobación final de PRs de frontend
- Validación de componentes de biometría
- Performance y usabilidad

### Anthony Villarreal (Security Focus):

- Revisión de middleware y validación
- Verificación de compliance con estándares
- Training del equipo en seguridad

---

### Aprobado por el equipo:

- Carlos Campoverde: __________
- Juan Pasquel: __________
- Anthony Villarreal: __________

**Fecha implementación:** 20/01/2026  
**Próxima revisión:** 05/02/2026