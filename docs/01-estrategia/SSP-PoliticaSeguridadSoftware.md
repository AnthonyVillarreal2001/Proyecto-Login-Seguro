# POLÍTICA DE SEGURIDAD DE SOFTWARE
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos (Backend), Juan (Frontend), Anthony (Middleware)  
**Versión:** 1.0

## 1. PROPÓSITO
Establecer reglas mínimas de seguridad para desarrollo y operación del sistema de autenticación con biometría facial.

## 2. ALCANCE
Aplica a todo el código en repositorio GitHub, incluyendo:
- Backend Node.js (Carlos)
- Frontend React (Juan)  
- Middleware y validación (Anthony)

## 3. REQUISITOS MÍNIMOS

### 3.1 Autenticación
- **Tokens JWT:** Expiración 5 minutos
- **bcrypt:** Costo 10 mínimo para contraseñas
- **Rate limiting:** 10 intentos/5min en login
- **Timeout sesión:** 5 minutos inactividad

### 3.2 Protección de Datos
- **Embeddings faciales:** Encriptados AES-256
- **Datos sensibles:** No loggear
- **Inputs usuario:** Sanitizar todos
- **Queries SQL:** Usar parámetros preparados

### 3.3 Gestión de Sesiones
- **Blacklisting:** Tokens revocados
- **Sesiones:** Single session por usuario
- **Renovación:** Automática con actividad

## 4. RESPONSABILIDADES

### Carlos Campoverde (Backend):
- Implementar encriptación embeddings
- Configurar bcrypt y JWT
- Asegurar queries SQL seguras
- Gestionar base de datos PostgreSQL

### Juan Pasquel (Frontend):
- Gestión segura de tokens en `localStorage`
- Detener cámara después de uso
- Timeout de sesión cliente-side
- Validación inputs antes de enviar

### Anthony Villarreal (Middleware):
- Validación y sanitización de inputs
- Rate limiting y headers de seguridad
- Logging de eventos de seguridad
- Monitoreo de intentos sospechosos

## 5. CICLO DE VIDA SEGURO

### 5.1 Desarrollo:
- Code review obligatorio entre miembros
- Tests de seguridad en cada PR
- ESLint con reglas de seguridad

### 5.2 Pruebas:
- Cobertura mínima 80% pruebas unitarias
- Pentesting básico mensual
- Validación de biometría por sprint

### 5.3 Producción:
- Variables de entorno para secrets
- Logging de eventos críticos
- Monitoreo en tiempo real

## 6. SANCIONES

- **1ra vez:** Capacitación y corrección en 24h
- **2da vez:** Bloqueo de commits por 1 semana
- **3ra vez:** Revisión completa de código

## 7. REVISIÓN

Revisar esta política cada 3 meses o cuando:
- Se agregue nueva funcionalidad crítica
- Se encuentre vulnerabilidad grave
- Cambien requisitos legales

---

## Aprobado por:

- **Carlos Campoverde:** __________
- **Juan Pasquel:** __________
- **Anthony Villarreal:** __________

**Fecha:** [FECHA]  
**Próxima revisión:** [FECHA + 3 MESES]