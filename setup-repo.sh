#!/bin/bash
# setup-repo.sh

echo "🚀 Configurando repositorio para CI/CD..."

# 1. Inicializar repo si no existe
if [ ! -d ".git" ]; then
    echo "📦 Inicializando repositorio Git..."
    git init
    git add .
    git commit -m "Initial commit: Secure App with ML Security"
fi

# 2. Crear las 3 ramas obligatorias
echo "🌿 Creando ramas obligatorias..."

# Rama main (ya existe si hay commit inicial)
git branch -M main

# Rama dev desde main
git checkout -b dev
echo "✅ Rama 'dev' creada desde 'main'"

# Rama test desde main
git checkout main
git checkout -b test
echo "✅ Rama 'test' creada desde 'main'"

# Volver a dev para trabajar
git checkout dev

# 3. Crear estructura de archivos necesarios
echo "📁 Creando estructura de archivos..."

# Crear directorios
mkdir -p .github/workflows
mkdir -p scripts
mkdir -p ml

# Copiar workflows (asumiendo que tienes el archivo)
echo "⚙️ Configurando workflows CI/CD..."
cat > .github/workflows/ci-cd-pipeline.yml << 'EOF'
# [Pega aquí el contenido del workflow anterior]
EOF

# Crear Dockerfiles si no existen
if [ ! -f "backend/Dockerfile" ]; then
    echo "🐳 Creando Dockerfile para backend..."
    cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
EOF
fi

if [ ! -f "frontend/Dockerfile" ]; then
    echo "🐳 Creando Dockerfile para frontend..."
    cat > frontend/Dockerfile << 'EOF'
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
fi

# Crear nginx.conf para frontend
if [ ! -f "frontend/nginx.conf" ]; then
    cat > frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
fi

# 4. Hacer commit inicial
echo "💾 Haciendo commit de configuración..."
git add .
git commit -m "🚀 Configuración inicial CI/CD

- Pipeline de 3 etapas con ML security
- Estructura de ramas dev/test/main
- Dockerfiles para frontend/backend
- Workflow GitHub Actions completo"

# 5. Si hay remote, push
if git remote get-url origin &> /dev/null; then
    echo "📤 Subiendo a GitHub..."
    git push -u origin main
    git push -u origin dev
    git push -u origin test
else
    echo "⚠️ No hay remote configurado."
    echo "Para conectar con GitHub:"
    echo "  git remote add origin https://github.com/USUARIO/REPO.git"
    echo "  git push -u origin main"
    echo "  git push -u origin dev"
    echo "  git push -u origin test"
fi

echo "✅ Configuración completada!"
echo ""
echo "📋 PASOS SIGUIENTES:"
echo "1. Configurar secrets en GitHub:"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TELEGRAM_CHAT_ID"
echo "   - DOCKER_USERNAME"
echo "   - DOCKER_PASSWORD"
echo "   - RENDER_API_KEY"
echo "   - VERCEL_TOKEN"
echo ""
echo "2. Proteger ramas en Settings → Branches"
echo "3. Crear PR de dev → test para probar"