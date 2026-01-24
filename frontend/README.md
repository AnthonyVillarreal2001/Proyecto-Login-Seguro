# Frontend - Proyecto Login Seguro

Interfaz de usuario del sistema de autenticación segura con biometría facial.  
Construido con **React**, **Bootstrap** y **face-api.js** para reconocimiento facial.

## Tecnologías principales

- React 18
- React Router v6
- Axios (peticiones HTTP)
- Bootstrap 5 (UI responsiva + temas claro/oscuro)
- face-api.js (biometría facial en navegador)
- UUID (para sessionID único)

## Estructura de carpetas

```
frontend/
├── public/
│   ├── models/               → Modelos de face-api.js (descargar de GitHub)
│   └── index.html
├── src/
│   ├── components/           → Login, Register, AdminDashboard, ClientDashboard, ProfileSettings
│   ├── utils/                → auth.js (JWT, logout, multi-ventana)
│   ├── App.js                → Rutas y tema global
│   └── index.js              → Entry point
└── package.json
```

## Requisitos

- **Node.js** ≥ 18
- **Backend** corriendo en `http://localhost:5000`
- **Modelos de face-api.js** en `public/models/` (descargar desde: https://github.com/justadudewhohacks/face-api.js/tree/master/weights)

## Instalación

### 1. Entra a la carpeta frontend

```bash
cd frontend
```

### 2. Instala dependencias

```bash
npm install
```

### 3. Inicia la aplicación

```bash
npm start
```

Abre en: http://localhost:3000

## Funcionalidades principales

- **Registro público** (`/register`)
- **Login** con contraseña o biometría facial (modal con cámara en vivo)
- **Dashboard Cliente**: perfil, edición con contraseña, preferencias (tema claro/oscuro), registro/eliminar biometría
- **Dashboard Admin**: CRUD usuarios, preferencias propias
- **Tema claro/oscuro** aplicado globalmente según preferencias guardadas
- **Cierre automático de sesión** si se inicia en otra pestaña (seguridad)

## Comandos útiles

- **Desarrollo**: `npm start`
- **Build para producción**: `npm run build`
- **Tests**: `npm test` (si agregas)

## Notas importantes

- La cámara se abre en modales dedicados → se cierra siempre al finalizar o cancelar
- Tema claro/oscuro se aplica con `data-bs-theme` en `<html>` → Bootstrap cambia automáticamente
- **Sesiones seguras**: no permite múltiples pestañas activas con la misma cuenta
- **Biometría**: embedding facial guardado en `preferences.faceEmbedding` (JSONB)

## Descarga de modelos face-api.js

Descarga los siguientes archivos y colócalos en `public/models/`:

- `ssd_mobilenetv1_model-*.json` + shards
- `face_landmark_68_model-*.json` + shards
- `face_recognition_model-*.json` + shards

---

¡Proyecto listo para pruebas y presentación! 🚀