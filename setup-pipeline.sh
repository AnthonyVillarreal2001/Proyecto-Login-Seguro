#!/bin/bash
# setup-pipeline.sh

echo "🚀 Configurando pipeline CI/CD completo..."

# 1. Crear estructura de ramas
echo "🌿 Creando ramas obligatorias..."
git checkout -b dev 2>/dev/null || git checkout dev
git checkout -b test 2>/dev/null || git checkout test
git checkout -b main 2>/dev/null || git checkout main

# 2. Crear directorios necesarios
echo "📁 Creando estructura de directorios..."
mkdir -p .github/workflows
mkdir -p .github/workflows/templates
mkdir -p scripts

# 3. Copiar archivos de workflow
echo "⚙️ Configurando workflows..."
cp ci-cd-pipeline.yml .github/workflows/
cp security-issue.md .github/workflows/templates/

# 4. Crear Dockerfiles si no existen
echo "🐳 Configurando Docker..."
if [ ! -f "backend/Dockerfile" ]; then
    cat > backend/Dockerfile << EOF
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
    cat > frontend/Dockerfile << EOF
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
    
    cat > frontend/nginx.conf << EOF
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
fi

# 5. Crear requirements.txt para ML si no existe
echo "🤖 Configurando dependencias ML..."
if [ ! -f "requirements.txt" ]; then
    cat > requirements.txt << EOF
joblib==1.3.2
scikit-learn==1.5.2
scipy==1.13.0
pandas==2.2.1
numpy==1.26.4
requests==2.31.0
jq==1.7.0
EOF
fi

# 6. Hacer commit inicial
echo "💾 Haciendo commit de configuración..."
git add .
git commit -m "🚀 Configuración inicial del pipeline CI/CD

- Pipeline completo con 3 etapas
- Revisión de seguridad con ML
- Tests automatizados
- Despliegue en producción
- Notificaciones por Telegram"

echo "✅ Configuración completada!"
echo "📋 Pasos restantes:"
echo "1. Configurar secrets en GitHub"
echo "2. Crear servicios en Render/Vercel"
echo "3. Subir imágenes a Docker Hub"
echo "4. Crear un PR de dev → test para probar"

# 7. Mostrar comandos para configurar secrets
echo ""
echo "🔐 Para configurar secrets en GitHub:"
echo "gh secret set TELEGRAM_BOT_TOKEN --body=\"TU_TOKEN\""
echo "gh secret set TELEGRAM_CHAT_ID --body=\"TU_CHAT_ID\""
echo "gh secret set DOCKER_USERNAME --body=\"TU_USUARIO\""
echo "gh secret set DOCKER_PASSWORD --body=\"TU_PASSWORD\""