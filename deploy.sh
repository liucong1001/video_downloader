#!/bin/bash
# VideoDownloader 阿里云部署脚本
# 使用方法: 上传到服务器后执行 bash deploy.sh

set -e

echo "📦 VideoDownloader 部署开始..."

# 1. 安装 Node.js（如果没有）
if ! command -v node &> /dev/null; then
  echo "🔧 安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# 2. 安装 pm2（进程守护）
if ! command -v pm2 &> /dev/null; then
  echo "🔧 安装 pm2..."
  sudo npm install -g pm2
fi

# 3. 安装依赖
echo "📥 安装前端依赖..."
npm install --production=false

echo "📥 安装后端依赖..."
cd server && npm install --production=false && cd ..

# 4. 构建
echo "🔨 构建前端..."
npm run build

echo "🔨 构建后端..."
npm run build:server

# 5. 启动服务
echo "🚀 启动服务..."
pm2 delete video-downloader 2>/dev/null || true
PORT=3001 pm2 start server/dist/index.js --name video-downloader
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "✅ 部署完成！"
echo "   服务运行在: http://localhost:3001"
echo ""
echo "📌 后续操作:"
echo "   1. 配置阿里云安全组，开放端口（如 80 或 3001）"
echo "   2. 如需 Nginx 反向代理 + HTTPS，参考下方配置"
echo ""
echo "🔧 Nginx 配置示例 (/etc/nginx/sites-available/default):"
echo "   server {"
echo "       listen 80;"
echo "       server_name your-domain.com;"
echo "       location / {"
echo "           proxy_pass http://127.0.0.1:3001;"
echo "           proxy_set_header Host \$host;"
echo "           proxy_set_header X-Real-IP \$remote_addr;"
echo "       }"
echo "   }"
