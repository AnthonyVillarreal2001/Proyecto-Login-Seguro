# 🔐 Proyecto Login Seguro — Documentación Técnica

## Índice

1. [Descripción General](#1-descripción-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Autenticación Multifactor (MFA)](#4-autenticación-multifactor-mfa)
5. [Liveness Detection — Anti-Spoofing](#5-liveness-detection--anti-spoofing)
6. [Sistema Anti-Deepfake](#6-sistema-anti-deepfake)
7. [Seguridad del Backend](#7-seguridad-del-backend)
8. [Encriptación de Datos Biométricos](#8-encriptación-de-datos-biométricos)
9. [Patrones de Diseño y SOLID](#9-patrones-de-diseño-y-solid)
10. [Pipeline de Seguridad (CI/CD)](#10-pipeline-de-seguridad-cicd)
11. [Testing](#11-testing)
12. [Documentación BSIMM](#12-documentación-bsimm)
13. [Justificación de Decisiones Técnicas](#13-justificación-de-decisiones-técnicas)

---

## 1. Descripción General

**Proyecto Login Seguro** es un sistema de autenticación web que implementa **verificación de identidad en dos factores**: contraseña + reconocimiento facial biométrico obligatorio. El sistema está diseñado para resistir ataques de suplantación de identidad incluyendo:

- Presentación de fotografías frente a la cámara
- Reproducción de videos del usuario
- Deepfakes generados con IA
- Ataques de replay con grabaciones

El proyecto sigue el marco **BSIMM (Building Security In Maturity Model)** para asegurar que la seguridad está integrada en todo el ciclo de desarrollo, no solo en la implementación.

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│              React 19 + face-api.js + TensorFlow.js         │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Login    │  │  Register    │  │  Liveness Detection │    │
│  │  (MFA)   │  │  (Biometric) │  │  (Anti-Spoofing)    │    │
│  └──────────┘  └──────────────┘  └────────────────────┘    │
│                        │ proxy :5000                        │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    BACKEND (Express 5)                       │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │ Helmet   │  │ Rate Limiter │  │ JWT + Blacklist   │      │
│  │ (Headers)│  │ (Brute Force)│  │ (Session Mgmt)    │      │
│  └──────────┘  └──────────────┘  └──────────────────┘      │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │Validator │  │ AES-256-CBC  │  │ bcrypt (10 salt)  │      │
│  │(Sanitize)│  │ (Encryption) │  │ (Password Hash)   │      │
│  └──────────┘  └──────────────┘  └──────────────────┘      │
│                        │                                    │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                  PostgreSQL 15 (Docker)                      │
│                                                             │
│  users: id | name | email | password_hash | role | prefs    │
│         prefs.faceEmbedding → AES-256-CBC encrypted         │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Autenticación

```
Usuario → Email + Contraseña → Backend verifica hash bcrypt
                                         │
                                    ¿Correcto?
                                    │        │
                                   Sí       No → 401
                                    │
                          Activar cámara + Liveness Detection
                                    │
                          3 acciones aleatorias + 6 checks anti-spoofing
                                    │
                              ¿Liveness OK?
                              │          │
                             Sí         No → Error spoofing
                              │
                    Capturar face embedding (128D)
                              │
                    Enviar al backend → Comparar con embedding almacenado
                              │
                    Distancia euclidiana < 0.6 → ✅ Acceso concedido + JWT
```

---

## 3. Stack Tecnológico

### Frontend

| Tecnología | Versión | Propósito | Justificación |
|-----------|---------|-----------|---------------|
| **React** | 19.2 | UI Framework | Componentes reactivos, virtual DOM, ecosistema maduro |
| **face-api.js** | 0.22.2 | Detección/reconocimiento facial | Basado en TensorFlow.js, corre 100% en el navegador (sin enviar video al servidor) |
| **TensorFlow.js** | 4.22 | Backend de ML | WebGL acceleration para inferencia facial en tiempo real |
| **Bootstrap 5** | 5.3 | UI Components | Diseño responsive, accesibilidad, componentes pre-construidos |
| **React Router** | 7.12 | Routing | Navegación SPA con protección de rutas por rol |
| **Axios** | 1.13 | HTTP Client | Interceptores, manejo de errores, proxy automático |
| **Yup** | 1.7 | Validación | Schemas declarativos para validación de formularios |

### Backend

| Tecnología | Versión | Propósito | Justificación |
|-----------|---------|-----------|---------------|
| **Express** | 5.2 | Framework HTTP | Minimalista, middleware pipeline, estándar de la industria |
| **PostgreSQL** | 15 | Base de datos | ACID compliance, JSONB para datos flexibles, tipado fuerte |
| **bcrypt** | 6.0 | Hash de contraseñas | Salt automático (10 rounds), resistente a rainbow tables y ataques de fuerza bruta |
| **jsonwebtoken** | 9.0 | Autenticación | Tokens stateless, expiración configurable, firma HMAC |
| **Helmet** | 8.1 | Headers HTTP seguros | CSP, HSTS, X-Frame-Options, previene clickjacking/XSS |
| **express-rate-limit** | 8.2 | Anti brute-force | Limita 10 intentos/5min en login, previene ataques automatizados |
| **express-validator** | 7.3 | Sanitización de input | Previene XSS, SQL injection, valida formatos de email |
| **Winston** | 3.19 | Logging estructurado | Registro de todas las peticiones para auditoría |
| **crypto (AES-256-CBC)** | nativo | Encriptación biométrica | Encrypta embeddings faciales en reposo en la BD |

### Infraestructura

| Tecnología | Propósito |
|-----------|-----------|
| **Docker** | Contenedor PostgreSQL aislado |
| **GitHub Actions** | CI/CD pipeline con análisis de seguridad |
| **Python + ML** | Scanner de vulnerabilidades con modelo entrenado |
| **Telegram Bot** | Notificaciones de alertas de seguridad |

---

## 4. Autenticación Multifactor (MFA)

El sistema implementa **autenticación de dos factores obligatoria**:

### Factor 1: Contraseña

- Hash con **bcrypt** (10 rounds de salt)
- Validación de longitud mínima (8 caracteres) vía `express-validator`
- Sanitización y escape de input contra XSS
- Rate limiting: máximo 10 intentos cada 5 minutos por IP

### Factor 2: Reconocimiento Facial Biométrico

- **Procesamiento 100% en el navegador** — el video NUNCA se envía al servidor
- Solo se envía el **embedding facial** (vector de 128 números) encriptado
- Modelo: **SSD MobileNet v1** + **Face Landmark 68** + **Face Recognition** + **Face Expressions**
- Verificación por **distancia euclidiana** entre embedding almacenado y captura en vivo
- Umbral de verificación: **< 0.6** (60% de similitud mínima)
- Umbral de duplicados en registro: **< 0.5** (un rostro = una cuenta)

### ¿Por qué reconocimiento facial y no OTP/SMS?

| Criterio | Facial Biométrico | OTP/SMS |
|----------|-------------------|---------|
| **Suplantable** | Requiere presencia física del usuario | SIM cloning, SS7 attacks |
| **Fricción** | Solo mirar la cámara | Cambiar de app, escribir código |
| **Privacidad** | Procesamiento local, sin nube | Requiere número telefónico |
| **Costo** | $0 (face-api.js es open source) | APIs de SMS cuestan por mensaje |
| **Anti-deepfake** | 7 capas de verificación implementadas | No aplica |

---

## 5. Liveness Detection — Anti-Spoofing

### ¿Por qué es necesario?

Sin liveness detection, un atacante podría:
- Mostrar una **foto** del usuario frente a la cámara
- Reproducir un **video** del usuario
- Usar un **deepfake en tiempo real**

### Cómo funciona

El sistema selecciona **3 acciones aleatorias** de un pool de 6, obligando al usuario a realizarlas en secuencia. La aleatoriedad impide que un atacante prepare un video con las acciones correctas de antemano.

#### Pool de Acciones (6 disponibles, 3 aleatorias por sesión)

| Acción | Detección | Landmarks utilizados |
|--------|-----------|---------------------|
| **Girar cabeza derecha** | Desplazamiento horizontal nariz > 6% del ancho facial + movimiento acumulado | `nose[3]`, `detection.box` |
| **Girar cabeza izquierda** | Ídem, dirección opuesta | `nose[3]`, `detection.box` |
| **Sonreír** | Score combinado: expresión `happy` + ratio ancho/alto de boca > 2.2 | `mouth[0-6]`, `expressions.happy` |
| **Asentir (sí)** | Movimiento vertical de nariz: baja > 4% + sube + acumulado > 8% | `nose[3].y`, `detection.box.height` |
| **Abrir boca** | Ratio alto/ancho de boca > 0.55 | `mouth[3,9]` (alto), `mouth[0,6]` (ancho) |
| **Levantar cejas** | Expresión `surprised` > 0.55 AND apertura ocular > 4% altura facial | `expressions.surprised`, `leftEye`, `rightEye` |

#### ¿Por qué estas acciones y no otras?

- **Giros de cabeza**: Imposibles de replicar con una foto 2D. Un deepfake tendría que generar vistas laterales en tiempo real.
- **Sonrisa**: Combina landmarks geométricos + red neuronal de expresiones, difícil de falsear con ambos simultáneamente.
- **Asentimiento**: Movimiento 3D imposible en una foto, el tracking de nariz es muy preciso en face-api.js.
- **Abrir boca / cejas**: Requieren deformación facial real, no solo overlay.

### Configuración Anti-Predictibilidad

```javascript
ACTIONS_COUNT: 3,        // Solo 3 de 6 posibles
TIMEOUT_MS: 35000,       // 35 segundos máximo
POLL_INTERVAL_MS: 140,   // ~7 FPS de análisis
MIN_STEP_FRAMES: 3,      // Mínimo 3 frames sostenidos
```

Con 6 acciones y 3 seleccionadas, hay **120 combinaciones posibles** (P(6,3) = 6×5×4), más el orden aleatorio. Un atacante necesitaría preparar 120 videos diferentes.

---

## 6. Sistema Anti-Deepfake

### Sistema de Scoring Combinado

En lugar de bloquear por un solo check fallido (generaría falsos positivos), el sistema usa un **scoring acumulativo**. Cada check fallido suma puntos de riesgo. Si el total alcanza el umbral, se bloquea.

| Check | Peso | Umbral de bloqueo | Técnica |
|-------|------|-------------------|---------|
| **Análisis de textura** | 5 pts | Bloqueo inmediato | Varianza de luminancia en bloques 4×4 |
| **Artefactos deepfake** | 2 pts | Combinado ≥ 4 | Transiciones en bordes faciales (Sobel) |
| **Micro-movimientos** | 1 pt | Solo si falla 3+ veces | Micro-temblores involuntarios de nariz |
| **Pulso rPPG** | 2 pts | Combinado ≥ 4 | Variación temporal canal verde (flujo sanguíneo) |
| **Reflejos oculares** | 2 pts | Combinado ≥ 4 | Consistencia de puntos brillantes bilateral |
| **Detección de dispositivo** | 4 pts | Bloqueo inmediato | Bisel oscuro + dedos + proporción + uniformidad + bordes rectos |

**Umbral total: 4 puntos** → Ejemplos:
- Pantalla detectada (textura=5): **bloqueo inmediato**
- Video que pasa textura pero falla rPPG(2) + reflejos(2) = 4: **bloqueado**  
- Persona real con mala luz que falla un check (1-2 pts): **pasa**

### 6.1 Análisis de Textura Anti-Pantalla

```
¿Cómo funciona?
→ Captura región central del video (30% del frame)
→ Divide en bloques de 4×4 píxeles
→ Calcula varianza de luminancia por bloque
→ Piel real: varianza alta + distribución irregular
→ Pantalla: varianza baja (moiré) + distribución regular
```

**¿Por qué funciona?** Las pantallas LCD/OLED tienen patrones de subpíxeles regulares (efecto moiré) que reducen la varianza de alto frecuencia cuando se capturan con una cámara. La piel real tiene textura irregular a nivel micro (poros, vellos, imperfecciones).

### 6.2 Detección de Pulso (rPPG Temporal)

```
¿Cómo funciona?
→ Captura promedio RGB de la región de mejilla cada frame
→ Acumula datos durante TODA la sesión (no se resetea)
→ Analiza variación temporal del canal verde
→ Calcula cruces por la media (indicador de ritmo cardíaco)
→ Personas reales: 0.5-8 cruces/segundo (30-240 BPM)
→ Videos/fotos: sin variación o ruido uniforme
```

**¿Por qué el canal verde?** La hemoglobina absorbe luz verde selectivamente. Cuando el corazón bombea, la concentración de sangre en la piel varía cíclicamente, alterando la reflectancia del canal verde. Esta es la base de la técnica **rPPG (remote Photoplethysmography)** usada en investigación médica.

### 6.3 Detección de Artefactos en Bordes

```
¿Cómo funciona?
→ Analiza la transición de píxeles en el BORDE del bounding box facial
→ Compara píxeles interiores vs exteriores (margen de 3px)
→ Deepfakes: transiciones uniformemente bruscas (std bajo, mean alto)
→ Rostros reales: transiciones graduales y variadas (std alto)
```

**¿Por qué funciona?** Los deepfakes generan la cara como un "parche" que se superpone al video original. En los bordes de este parche hay discontinuidades de color/iluminación que no existen en un rostro real filmado directamente.

### 6.4 Micro-Movimientos Naturales

```
¿Cómo funciona?
→ Registra posición de nariz cada frame (8 frames por ventana)
→ Calcula desplazamiento total entre frames consecutivos
→ Personas reales: micro-temblores involuntarios > 0.5 px
→ Fotos: 0 movimiento (o ruido digital uniforme)
→ Videos: movimiento demasiado suave/predecible
```

**¿Por qué funciona?** El sistema nervioso humano produce micro-sacadas y temblor fisiológico involuntario. Una persona no puede mantener la cabeza perfectamente quieta. Una foto tiene 0 movimiento, y un video reproduce movimiento pregrabado sin la variabilidad natural.

### 6.5 Reflejos Oculares

```
¿Cómo funciona?
→ Extrae región de píxeles de cada ojo (usando landmarks)
→ Calcula brillo máximo y proporción de píxeles brillantes (>200 luminancia)
→ Compara consistencia entre ojo izquierdo y derecho
→ Ojos reales: reflejos similares (misma fuente de luz)
→ Deepfakes: reflejos inconsistentes entre ojos
```

**¿Por qué funciona?** En la realidad, ambos ojos reflejan la misma fuente de luz con puntos especulares similares. Los GANs y modelos de deepfake generan cada ojo de forma independiente, produciendo reflejos con posición, tamaño y brillo diferentes. Este detalle es documentado en papers como *"Eyes Tell All" (2020)*.

### 6.6 Detección de Dispositivo/Teléfono

```
¿Cómo funciona?
→ CHECK 1: Bisel oscuro — analiza píxeles alrededor del bounding box facial
   Busca franjas oscuras (luminancia < 50) que indican el marco de un teléfono
   Si > 40% de los píxeles del borde son oscuros: +30 puntos

→ CHECK 2: Dedos/piel en bordes — escanea los 30px exteriores del frame
   Detecta color piel (R>60, G>40, B>20, R>G>B) en bordes izq/der/inferior
   Si > 12% de los píxeles del borde tienen color piel: +25 puntos

→ CHECK 3: Proporción cara/frame — calcula el área facial vs área total
   Un teléfono mostrado a la cámara hace que la cara se vea más pequeña
   Si la cara ocupa < 5% del frame: +20 puntos

→ CHECK 4: Uniformidad del fondo — mide desviación estándar de luminancia
   Las pantallas de dispositivos tienen fondos más uniformes que escenarios reales
   Si la desviación estándar del fondo < 10: +20 puntos

→ CHECK 5: Bordes rectangulares — detecta líneas rectas fuertes alrededor de la cara
   Los teléfonos tienen bordes rectos que crean gradientes de Sobel abruptos
   Si se detectan ≥2 bordes verticales + ≥2 horizontales: +30 puntos

→ VEREDICTO: score ≥ 45/100 = dispositivo detectado (peso: 4 pts anti-spoofing)
```

**¿Por qué funciona?** Un ataque de presentación con teléfono (mostrar una foto/video en otra pantalla) introduce artefactos físicos detectables: el bisel del dispositivo crea bordes oscuros rectangulares, los dedos que sostienen el teléfono aparecen como regiones de color piel en los bordes del frame, y la cara vista a través de una pantalla secundaria ocupa una proporción menor del campo visual de la cámara. Combinados, estos 5 indicadores con un score acumulativo de 45/100 minimizan falsos positivos.

---

## 7. Seguridad del Backend

### 7.1 Headers HTTP (Helmet)

```javascript
app.use(helmet());
```

Helmet configura automáticamente:
- **Content-Security-Policy**: Previene XSS con inline scripts
- **X-Content-Type-Options**: nosniff — previene MIME sniffing
- **X-Frame-Options**: DENY — previene clickjacking
- **Strict-Transport-Security**: Forza HTTPS
- **X-XSS-Protection**: Filtro XSS del navegador

### 7.2 Rate Limiting

```javascript
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // Ventana de 5 minutos
  max: 10,                   // Máximo 10 intentos
});
app.use('/auth/login', limiter);
app.use('/auth/biometric/login', limiter);
```

**¿Por qué?** Sin rate limiting, un atacante podría hacer miles de intentos por segundo con diccionarios de contraseñas. Con este límite, un ataque de fuerza bruta contra una contraseña de 8 caracteres tomaría **siglos** en vez de horas.

### 7.3 Validación y Sanitización de Input

```javascript
body('name').trim().notEmpty().escape(),    // XSS prevention
body('email').isEmail().normalizeEmail(),   // Format validation
body('password').isLength({ min: 8 }),      // Minimum strength
```

Cada campo de entrada es:
1. **Trimmed**: Elimina espacios extras
2. **Escaped**: Convierte `<script>` a `&lt;script&gt;` (anti-XSS)
3. **Validated**: Formato correcto (email, longitud, etc.)
4. **Parameterized**: Queries con `$1, $2` (anti-SQL injection)

### 7.4 CORS Restrictivo

```javascript
app.use(cors({ origin: 'http://localhost:3000' }));
```

Solo acepta peticiones desde el frontend autorizado. Cualquier otro origen es rechazado por el navegador.

### 7.5 Gestión de Sesiones

- **JWT** con expiración de 5 minutos
- **Blacklist de tokens** con limpieza automática de expirados
- **Session timeout**: Tokens revocados por inactividad (5 min)
- **Renovación automática**: Token renovado si el usuario está activo y quedan menos de 2.5 min

```javascript
// Token se renueva automáticamente si está en la mitad del tiempo
if (tokenAge > (SESSION_TIMEOUT / 2)) {
  const newToken = jwt.sign(decoded, 'secret_key', { expiresIn: '5m' });
  res.setHeader('X-Renewed-Token', newToken);
}
```

### 7.6 Logout Seguro con Blacklist

```javascript
// Al hacer logout, el token se agrega a la blacklist
blacklist.add(token, expiresAt);

// Cada petición verifica que el token no esté en la blacklist
if (blacklist.has(token)) return res.status(401);
```

A diferencia de solo borrar el token del localStorage (el usuario aún podría usarlo si lo copió), la blacklist asegura que el token es **irrevocablemente inválido** del lado del servidor.

---

## 8. Encriptación de Datos Biométricos

### Problema

Los embeddings faciales son datos biométricos sensibles. Si la base de datos es comprometida, un atacante no debe poder reconstruir los vectores faciales.

### Solución: AES-256-CBC

```javascript
// Encriptar embedding antes de guardar
const encrypted = encryptFaceEmbedding(embedding);
// → "a1b2c3...:d4e5f6..." (IV:ciphertext en hex)

// Desencriptar para comparar
const decrypted = decryptFaceEmbedding(encrypted);
// → [0.123, -0.456, ...] (128 floats)
```

- **Algoritmo**: AES-256-CBC (estándar NIST, usado por gobiernos)
- **Clave**: 32 bytes (256 bits)
- **IV**: 16 bytes aleatorios por cada encriptación (previene ataques de patrones)
- **Almacenamiento**: El embedding se guarda en `users.preferences.faceEmbedding` como string encriptado

### ¿Por qué AES-256-CBC y no hashing?

Los embeddings necesitan ser **desencriptados** para calcular la distancia euclidiana en la verificación. Un hash (como SHA-256) es irreversible — no permitiría comparar embeddings. AES-256-CBC es encriptación simétrica reversible con clave, que es el enfoque correcto para datos que necesitan ser leídos pero protegidos en reposo.

---

## 9. Patrones de Diseño y SOLID

### Patrones Implementados

| Patrón | Dónde | Implementación |
|--------|-------|----------------|
| **Singleton** | `config/db.js` | Una única instancia de Pool de PostgreSQL compartida |
| **MVC** | Backend completo | Models (`userModel.js`), Controllers (`userController.js`), Views (React frontend) |
| **Middleware Pipeline** | Express | `helmet → cors → rateLimit → validator → auth → controller` |
| **Observer** | Frontend | Estado reactivo de React, eventos de storage para sincronizar sesiones |
| **Strategy** | Liveness | Pool de acciones intercambiables con interfaz común `detectAction()` |

### Principios SOLID

| Principio | Implementación |
|-----------|---------------|
| **S** — Single Responsibility | `UserModel` solo maneja DB. `userController` solo lógica de negocio. `authMiddleware` solo autenticación. |
| **O** — Open/Closed | Nuevas acciones de liveness se agregan al `ACTION_POOL` sin modificar `detectAction()`. Nuevos middlewares se agregan al pipeline sin modificar los existentes. |
| **L** — Liskov Substitution | Cualquier acción del pool puede sustituir a otra — todas cumplen la misma interfaz `(actionKey, detection, state) → boolean`. |
| **I** — Interface Segregation | Middleware con interfaces mínimas: `(req, res, next)`. Callbacks de liveness segregados: `onStepChange`, `onLog`, `onStatusChange`. |
| **D** — Dependency Inversion | Controllers dependen de abstracciones (`UserModel` interface), no de implementación directa de PostgreSQL. Inyección via `require()`. |

---

## 10. Pipeline de Seguridad (CI/CD)

### Scanner de Código con Machine Learning

El proyecto incluye un **scanner de vulnerabilidades** entrenado con ML que analiza el código fuente en cada push:

```
scripts/security_check.py  → Analiza archivos con modelo ML
ml/model.joblib             → Modelo entrenado (clasificación de vulnerabilidades)
ml/vectorizer.joblib        → TF-IDF vectorizer para código fuente
scripts/telegram_notify.py  → Notificación de alertas vía Telegram
```

#### ¿Cómo funciona?

1. **Extracción de features**: Analiza el código buscando patrones peligrosos (ej: `eval()`, `exec()`, consultas SQL sin parametrizar, `innerHTML`)
2. **Vectorización TF-IDF**: Convierte el código en vectores numéricos
3. **Clasificación ML**: El modelo predice si el archivo contiene vulnerabilidades
4. **Notificación**: Si se detectan problemas, envía alerta por Telegram

#### Patrones que detecta

| Lenguaje | Patrones peligrosos |
|----------|-------------------|
| **JavaScript** | `eval()`, `innerHTML`, `document.write`, `exec()`, template strings sin sanitizar |
| **Python** | `os.system()`, `subprocess`, `pickle.loads`, `exec()`, `eval()` |
| **Java** | `Runtime.exec()`, `Statement` (SQL), `XMLDecoder`, `ObjectInputStream` |
| **C#** | `Process.Start`, `SqlCommand`, `BinaryFormatter.Deserialize` |

---

## 11. Testing

### Cobertura de Tests

```
backend/tests/
├── authMiddleware.test.js      → Verificación de JWT, roles, blacklist
├── blacklist.test.js           → Expiración de tokens, limpieza automática
├── db.test.js                  → Conexión PostgreSQL, pool singleton
├── index.test.js               → Rutas HTTP, integración express
├── schema.test.js              → Creación de tablas, tipos ENUM
├── sessionTimeout.test.js      → Timeout de sesión, renovación de tokens
├── userController.test.js      → Registro, login, verificación facial
├── userModel.test.js           → CRUD de usuarios, findByEmail, search
├── userModel.coverage.test.js  → Casos edge del modelo
├── userModel.error.test.js     → Manejo de errores DB
├── validateMiddleware.test.js  → Sanitización, validación de input
```

**Framework**: Jest 30 con Supertest para tests HTTP de integración.

---

## 12. Documentación BSIMM

El proyecto sigue el marco **BSIMM (Building Security In Maturity Model)** con documentación completa en `/docs/`:

| Dominio | Documentos |
|---------|-----------|
| **Estrategia** | Política de seguridad, Métricas y KPIs |
| **Configuración** | Entornos seguros, Inventario de activos |
| **Vulnerabilidades** | Proceso de gestión, Registro de conocidas |
| **Arquitectura** | Modelo de amenazas, Requisitos de seguridad |
| **Codificación** | Estándares seguros, Procedimiento de code review |
| **Pruebas** | Plan de pruebas, Resultados de pentest |
| **Operaciones** | Monitoreo/Logging, Respuesta a incidentes |
| **Gobernanza** | Mapa BSIMM, Plan de mejora continua |

---

## 13. Justificación de Decisiones Técnicas

### ¿Por qué face-api.js y no AWS Rekognition / Azure Face?

| Criterio | face-api.js (elegido) | Servicios en la nube |
|----------|----------------------|---------------------|
| **Privacidad** | El video NUNCA sale del navegador | Video enviado a servidores de terceros |
| **Costo** | Gratis, open source | $0.001-$0.01 por llamada API |
| **Latencia** | ~140ms local | 200-500ms red + procesamiento |
| **Compliance** | GDPR friendly (datos locales) | Requiere DPA con proveedor |
| **Offline** | Funciona sin internet (modelos cacheados) | Requiere conexión |
| **Control** | 100% control del pipeline | Caja negra del proveedor |

### ¿Por qué PostgreSQL y no MongoDB?

- **ACID transactions**: Datos de autenticación requieren consistencia estricta
- **JSONB**: Ofrece flexibilidad de documento (para preferences) sin sacrificar integridad relacional
- **Tipos ENUM**: `user_role` es un tipo nativo, no un string arbitrario
- **Prepared statements**: Protección nativa contra SQL injection con `$1, $2` parameterizado

### ¿Por qué Express 5 y no Fastify/NestJS?

- **Madurez**: 15+ años de ecosistema, documentación exhaustiva
- **Middleware pipeline**: Composición natural de capas de seguridad (Helmet → CORS → Rate Limit → Validator → Auth → Controller)
- **Simplicidad**: Para el scope del proyecto, Express es directo y sin overhead de decoradores/DI frameworks

### ¿Por qué bcrypt y no Argon2?

- **Compatibilidad**: bcrypt funciona en todas las plataformas sin compilación nativa
- **Probado**: 25+ años de uso en producción, auditado extensivamente
- **10 salt rounds**: Balance entre seguridad (~100ms por hash) y UX. 15 rounds tomaría ~3 segundos

### ¿Por qué JWT y no sesiones server-side?

- **Stateless**: El servidor no mantiene estado de sesión — escala horizontalmente
- **Blacklist**: Implementada para revocar tokens (resuelve la debilidad principal de JWT)
- **Información embebida**: Role, email, id van en el token — evita queries extra a la BD
- **Renovación automática**: El servidor renueva el token si el usuario está activo

---

## Resumen de Capas de Seguridad

```
Capa 1: HTTPS + Helmet Headers           → Protección de transporte
Capa 2: CORS restrictivo                  → Solo frontend autorizado
Capa 3: Rate Limiting                     → Anti brute-force
Capa 4: Input Validation + Sanitización   → Anti XSS/SQLi
Capa 5: bcrypt (10 rounds)                → Contraseñas irrompibles
Capa 6: JWT + Blacklist + Timeout         → Sesiones seguras
Capa 7: Liveness Detection (3 acciones)   → Anti-foto/video
Capa 8: Anti-Spoofing Scoring (6 checks)  → Anti-deepfake
Capa 9: AES-256-CBC                       → Biometría encriptada en reposo
Capa 10: Face Uniqueness Check            → Un rostro = una cuenta
Capa 11: ML Security Scanner             → Vulnerabilidades en CI/CD
Capa 12: BSIMM Framework                 → Seguridad en el proceso
```
