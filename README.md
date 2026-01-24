# Proyecto-Login-Seguro

## Descripción del Proyecto

Este es un proyecto full-stack para un sistema de autenticación seguro con soporte para login biométrico facial usando face-api.js. Incluye roles de administrador y cliente, dashboards personalizados, gestión de usuarios (CRUD para admin), preferencias de tema (claro/oscuro), y manejo de sesiones seguras.

### Características principales

- **Backend**: Node.js con Express, PostgreSQL, JWT para autenticación, bcrypt para hashing, rate limiting para seguridad.
- **Frontend**: React con Bootstrap para UI responsiva y elegante, face-api.js para biometría.
- **Seguridad**: Validaciones estrictas, encriptación end-to-end, logging seguro, expiración de sesiones, blacklist de tokens, y manejo de multi-ventanas (logout automático si se inicia sesión en otra pestaña).

### Funcionalidades clave

- Registro público como cliente
- Login con contraseña o biometría facial (con fallback)
- Dashboards: Admin (CRUD usuarios, preferencias), Cliente (perfil editable, preferencias, biometría)
- Temas claro/oscuro aplicados globalmente
- Modales para éxito/error, vista previa de cámara en modales para biometría

El proyecto sigue principios SOLID, patrones MVC/Singleton/Observer, y metodología OWASP para seguridad.

## Requerimientos

- **Node.js**: v18 o superior
- **PostgreSQL**: v12 o superior (crea una DB llamada `secure_app_db` con usuario `postgres` y contraseña `1234` – cámbialos en producción)
- **Navegador**: Chrome/Firefox (para WebRTC/cámara)
- **Dependencias**: Ver `package.json` en backend y frontend
- **Modelos face-api.js**: Descarga los modelos de [face-api.js GitHub](https://github.com/justadudewhohacks/face-api.js) y colócalos en `frontend/public/models/`

## Instalación

### 1. Clona el repositorio

```bash
git clone https://github.com/AnthonyVillarreal2001/Proyecto-Login-Seguro.git
cd Proyecto-Login-Seguro
```

### 2. Instala dependencias del backend

```bash
cd backend
npm install
```

### 3. Instala dependencias del frontend

```bash
cd ../frontend
npm install
```

### 4. Configura la base de datos

- Inicia PostgreSQL
- Crea la DB: `createdb secure_app_db` (o usa pgAdmin)
- En `config/db.js`, ajusta `user`, `host`, `database`, `password`, `port` si es necesario

## Configuración

### Backend

- **JWT secret**: En `controllers/userController.js` es `'secret_key'` – cámbialo a algo seguro en producción
- **Rate limiting**: Ya configurado para 10 intentos/5min en login

### Frontend

- Asegúrate de que `public/models/` tenga los archivos de pesos (`ssd_mobilenetv1`, `face_landmark_68`, `face_recognition`)
- En `package.json`, agrega si no está:

```json
"browser": {
  "fs": false,
  "path": false,
  "os": false
}
```

### Seguridad adicional

- Cambia la contraseña de DB en producción
- Usa HTTPS en deploy (con Helmet ya incluido)

## Ejecución

### Inicia el backend

```bash
cd backend
node index.js
```

Verás "Backend en http://localhost:5000". Crea tablas automáticamente al inicio.

### Inicia el frontend

```bash
cd ../frontend
npm start
```

Abre en http://localhost:3000.

### Pruebas iniciales

- Ve a http://localhost:3000/register → crea un usuario cliente
- Login en `/login` (usa biometría si registras rostro en perfil)
- Para admin: Crea uno manualmente en DB o desde dashboard admin (inicia como admin primero)

## Uso

- **Registro**: `/register` → Crea cliente
- **Login**: `/login` → Contraseña o biometría (modal con cámara)
- **Cliente Dashboard**: Edita perfil (con contraseña), preferencias (tema, notificaciones), biometría (registro con modal de cámara)
- **Admin Dashboard**: CRUD usuarios, edita preferencias (incluyendo tema), biometría
- **Tema**: Cambia a claro/oscuro → se aplica en toda la app
- **Logout**: Cierra sesión y blacklist token

## Pruebas

- **Unitarias**: Usa Jest en backend (`npm test`)
- **Seguridad**: Rate limiting en login, validaciones anti-inyección
- **Biometría**: Prueba con cámara real (no emuladores)
- **Multi-ventana**: Abre dos pestañas → login en una fuerza logout en la otra

## Contribuciones

1. Forkea el repo
2. Crea branch: `git checkout -b feature/nueva-funcion`
3. Commit: `git commit -m "Agrega X"`
4. Push: `git push origin feature/nueva-funcion`
5. Abre PR en GitHub

## Licencia

MIT – Usa libremente.
Créditos

Desarrollado por:
- *Campoverde Carlos*
- *Pasquel Juan*
- *Anthony Villarreal.*

Librerías: Express, React, face-api.js, Bootstrap.

Si tienes issues, abre un ticket en GitHub. ¡Disfruta del proyecto! 🚀