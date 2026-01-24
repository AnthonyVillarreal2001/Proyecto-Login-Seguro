# Backend - Proyecto Login Seguro

Este es el backend del proyecto de autenticación segura con soporte para biometría facial.  
Está construido con **Node.js + Express**, utiliza **PostgreSQL** como base de datos y **JWT** para sesiones.

## Tecnologías principales

- Node.js + Express
- PostgreSQL (con pg-pool)
- JWT (jsonwebtoken)
- Bcrypt para hashing de contraseñas
- express-rate-limit (protección contra brute force)
- express-validator (validación de entradas)
- Helmet (seguridad HTTP headers)
- Winston (logging)

## Estructura de carpetas

```
backend/
├── config/             → Configuración de base de datos (singleton)
├── controllers/        → Lógica de negocio (userController.js)
├── database/           → Creación y migraciones de tablas
├── middlewares/        → Autenticación, validaciones
├── models/             → Interacción con la DB (UserModel)
├── routes/             → (en index.js por simplicidad)
├── blacklist.js        → Blacklist de tokens para logout
└── index.js            → Archivo principal (servidor Express)
```

## Requisitos

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 12
- **Base de datos creada**: `secure_app_db`
  - Usuario: `postgres`
  - Contraseña: `1234` (cámbiala en producción)

## Instalación

### 1. Entra a la carpeta backend

```bash
cd backend
```

### 2. Instala dependencias

```bash
npm install
```

### 3. Inicia el servidor

```bash
node index.js
```

Deberías ver: `Backend en http://localhost:5000`

## Comandos útiles

- **Desarrollo**: `node index.js`
- **Tests**: `npm test` (si agregas Jest)
- **Reiniciar DB** (borra y recrea tablas): elimina la DB y vuelve a ejecutar `node index.js`

## Endpoints principales

- **POST** `/auth/public-register` → Registro público (solo cliente)
- **POST** `/auth/login` → Login con contraseña
- **POST** `/auth/biometric/login` → Login con biometría facial
- **GET** `/profile` → Obtener datos del usuario autenticado
- **PUT** `/profile/preferences` → Actualizar preferencias (tema, notificaciones)
- **POST** `/profile/save-face-embedding` → Guardar embedding facial
- **DELETE** `/profile/biometric` → Eliminar biometría
- **(Admin)** `GET /users/search`, `PUT/DELETE /users/:id`, etc.

## Seguridad implementada

- **JWT** con expiración (30 min)
- **Blacklist de tokens** al logout
- **Rate limiting** en login (10 intentos / 5 min)
- **Validación estricta** de entradas
- **Hashing de contraseñas** (bcrypt)
- **Helmet** para headers seguros
- **Preferencias guardadas en JSONB** (tema, faceEmbedding)

---

¡Listo para producción con HTTPS y variables de entorno!