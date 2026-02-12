# MAPA DE MADUREZ BSIMM
**Proyecto:** Sistema de Autenticación Segura  
**Equipo:** Carlos Campoverde (Backend), Juan Pasquel (Frontend), Anthony Villarreal (Middleware)  
**Fecha:** 02/02/2026

## 1. RESUMEN DE MADUREZ

### Nivel Actual: BSIMM Nivel 1 (Inicial)
**Puntuación:** 24/120 actividades (20%)

**Fortalezas:**
- SSDLC básico implementado
- Pruebas de seguridad automatizadas
- Gestión de vulnerabilidades inicial

**Áreas de mejora:**
- Falta programa formal de capacitación
- Auditoría externa no realizada
- Monitoreo en producción limitado

## 2. ACTIVIDADES BSIMM IMPLEMENTADAS

### 2.1 Estrategia y Métricas (SM) - 4/12
| Actividad                    | Estado | Responsable | Evidencia                                             |
| ---------------------------- | ------ | ----------- | ----------------------------------------------------- |
| SM1.2: Publicar métricas     | ✅      | Anthony     | `docs/01-estrategia/MET-MetricasKPIs.md`              |
| SM2.1: Identificar políticas | ✅      | Carlos      | `docs/01-estrategia/SSP-PoliticaSeguridadSoftware.md` |
| SM2.3: Usar métricas         | ⚠️      | Anthony     | Métricas básicas implementadas                        |
| SM3.2: Entrenamiento         | ❌      | Todos       | Pendiente programa formal                             |

### 2.2 Gestión de la Configuración (CM) - 3/9
| Actividad                            | Estado | Responsable | Evidencia                                        |
| ------------------------------------ | ------ | ----------- | ------------------------------------------------ |
| CM1.3: Proceso gestión configuración | ✅      | Anthony     | `docs/02-configuracion/CONF-EntornosSeguros.md`  |
| CM2.4: Gestionar activos             | ✅      | Carlos      | `docs/02-configuracion/INV-InventarioActivos.md` |
| CM3.2: Auditoría configuración       | ❌      | Carlos      | Pendiente scripts automatizados                  |

### 2.3 Gestión de Vulnerabilidades (VM) - 5/12
| Actividad                         | Estado | Responsable | Evidencia                                         |
| --------------------------------- | ------ | ----------- | ------------------------------------------------- |
| VM1.1: Usar herramientas          | ✅      | Anthony     | Jest, npm audit implementados                     |
| VM1.2: Responder vulnerabilidades | ✅      | Carlos      | `docs/03-vulnerabilidades/VULN-ProcesoGestion.md` |
| VM2.1: Flujo vulnerabilidades     | ✅      | Anthony     | GitHub Issues con label security                  |
| VM2.2: Medir tiempos remediación  | ⚠️      | Anthony     | Métricas básicas implementadas                    |
| VM3.1: Pentesting                 | ⚠️      | Juan        | Pentesting básico realizado                       |

### 2.4 Arquitectura y Diseño (AA) - 4/9
| Actividad                    | Estado | Responsable | Evidencia                                          |
| ---------------------------- | ------ | ----------- | -------------------------------------------------- |
| AA1.1: Entender atacantes    | ✅      | Todos       | Discusiones equipo                                 |
| AA2.1: Modelo amenazas       | ✅      | Anthony     | `docs/04-arquitectura/ARCH-ModeloAmenazas.md`      |
| AA2.2: Requisitos seguridad  | ✅      | Carlos      | `docs/04-arquitectura/ARCH-RequisitosSeguridad.md` |
| AA3.1: Revisión arquitectura | ⚠️      | Carlos      | Revisión informal realizada                        |

### 2.5 Garantía del Código (CA) - 3/9
| Actividad                       | Estado | Responsable | Evidencia                                         |
| ------------------------------- | ------ | ----------- | ------------------------------------------------- |
| CA1.1: Estándares código seguro | ✅      | Anthony     | `docs/05-codificacion/COD-EstandaresSeguros.md`   |
| CA2.3: Code reviews             | ✅      | Juan        | `docs/05-codificacion/COD-ProcedimientoReview.md` |
| CA3.1: Análisis estático        | ⚠️      | Carlos      | ESLint básico implementado                        |

### 2.6 Pruebas de Seguridad (ST) - 3/9
| Actividad                  | Estado | Responsable | Evidencia                                   |
| -------------------------- | ------ | ----------- | ------------------------------------------- |
| ST1.1: Pruebas seguridad   | ✅      | Carlos      | `docs/06-pruebas/TEST-PlanPruebas.md`       |
| ST2.2: Pruebas penetración | ⚠️      | Anthony     | `docs/06-pruebas/TEST-ResultadosPentest.md` |
| ST3.1: Pentesting externo  | ❌      | Todos       | Pendiente contratar externo                 |

### 2.7 Operaciones (OP) - 2/9
| Actividad                   | Estado | Responsable | Evidencia                                        |
| --------------------------- | ------ | ----------- | ------------------------------------------------ |
| OP1.1: Monitoreo            | ⚠️      | Anthony     | `docs/07-operaciones/OPS-MonitoreoLogging.md`    |
| OP2.1: Respuesta incidentes | ✅      | Carlos      | `docs/07-operaciones/OPS-RespuestaIncidentes.md` |

## 3. MATRIZ DE RESPONSABILIDADES BSIMM

| Dominio BSIMM             | Carlos     | Juan       | Anthony   |
| ------------------------- | ---------- | ---------- | --------- |
| **SM - Estrategia**       | Líder      | Participa  | Coordina  |
| **CM - Configuración**    | Implementa | Sigue      | Diseña    |
| **VM - Vulnerabilidades** | Líder      | Reporta    | Analiza   |
| **AA - Arquitectura**     | Diseña     | Contribuye | Modela    |
| **CA - Código**           | Sigue      | Líder      | Establece |
| **ST - Pruebas**          | Ejecuta    | Testea     | Planifica |
| **OP - Operaciones**      | Opera      | Monitorea  | Responde  |

## 4. HITO DE IMPLEMENTACIÓN POR SPRINT

### Sprint 1 (Completado):
- [x] Política de seguridad (Carlos)
- [x] Modelo de amenazas (Anthony)
- [x] Estándares de código (Anthony)

### Sprint 2 (Actual):
- [x] Gestión de vulnerabilidades (Carlos)
- [x] Pruebas de seguridad (Carlos)
- [ ] Monitoreo y logging (Anthony)

### Sprint 3 (31/01/2026 - 05/02/2026):
- [ ] Capacitación OWASP Top 10 (Todos)
- [ ] Pentesting externo básico (Anthony coordina)
- [ ] Dashboard métricas (Juan)

### Sprint 4 (Cierre de periodo):
- [ ] Auditoría de código externa
- [ ] Programa formal de capacitación
- [ ] Mejora respuesta a incidentes

## 5. METAS DE MADUREZ

### Meta 1: Nivel 1 BSIMM (Logrado)
**Fecha objetivo:** 02/02/2026  
**Actividades necesarias:** 15/120  
**Logrado:** ✅ 24/120

### Meta 2: Nivel 2 BSIMM
**Fecha objetivo:** 05/02/2026  
**Actividades necesarias:** 45/120  

**Actividades pendientes:**
1. SM3.2: Programa formal de capacitación
2. CM3.2: Auditoría automatizada de configuración
3. AA3.1: Revisión formal de arquitectura
4. CA3.1: Análisis estático avanzado
5. ST3.1: Pentesting externo

### Meta 3: Nivel 3 BSIMM (fase de preparacion)
**Fecha objetivo:** 05/02/2026  
**Actividades necesarias:** 75/120  

**Prerequisitos:**
- Presupuesto aprobado para herramientas
- Tercer miembro dedicado a seguridad
- Auditorías externas regulares

## 6. INDICADORES CLAVE (KPIs)

### KPI 1: Cobertura BSIMM
**Actual:** 20%  
**Meta Sprint 3:** 30%  
**Meta 3 meses:** 40%

### KPI 2: Tiempo remediación vulnerabilidades
**Actual:** 3.5 días  
**Meta:** 2 días

### KPI 3: Cobertura pruebas seguridad
**Actual:** 85%  
**Meta:** 90%

### KPI 4: Incidentes de seguridad
**Actual (último mes):** 0 críticos  
**Meta:** Mantener 0 críticos

## 7. PROXIMOS PASOS INMEDIATOS

### Para Carlos (semanas 1-2):
1. Implementar auditoría configuración automatizada
2. Establecer métricas formales de remediación
3. Preparar capacitación OWASP para equipo

### Para Juan (semanas 1-2):
1. Implementar dashboard de métricas básico
2. Mejorar logging frontend
3. Preparar casos de prueba biometría

### Para Anthony (semanas 1-2):
1. Configurar pentesting externo básico
2. Mejorar sistema de alertas
3. Documentar lecciones aprendidas

## 8. RECURSOS NECESARIOS

### Herramientas requeridas:
| Herramienta        | Costo estimado | Prioridad | Responsable |
| ------------------ | -------------- | --------- | ----------- |
| OWASP ZAP Pro      | $500/año       | Alta      | Anthony     |
| Sentry (team plan) | $300/año       | Media     | Juan        |
| SonarQube Cloud    | $400/año       | Baja      | Carlos      |

### Capacitación requerida:
| Curso                 | Duración | Costo | Participantes |
| --------------------- | -------- | ----- | ------------- |
| OWASP Top 10          | 8 horas  | $200  | Todos         |
| Secure Coding Node.js | 16 horas | $400  | Carlos        |
| React Security        | 12 horas | $300  | Juan          |

## 9. APROBACIONES

### Revisado y aceptado por:

**Carlos Campoverde**  
*Backend Lead*  
- **Fecha:** __________
- **Comentarios:** Comprometido con alcanzar nivel 2 en 3 meses.

**Juan Pasquel**  
*Frontend Lead*  
- **Fecha:** __________
- **Comentarios:** Enfocado en mejorar pruebas frontend y métricas.

**Anthony Villarreal**  
*Security/Middleware Lead*  
- **Fecha:** __________
- **Comentarios:** Coordinaré pentesting y monitoreo para nivel 2.

---

**Próxima revisión BSIMM:** 05/02/2026  
**Responsable próxima evaluación:** Anthony Villarreal