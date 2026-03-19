#!/bin/bash
# Calendar App 部署脚本
# 在 Ubuntu 服务器上运行此脚本完成部署
set -e

APP_DIR="/opt/calendar"
REPO_URL="$1"

if [ -z "$REPO_URL" ]; then
  echo "用法: ./deploy.sh <github-repo-url>"
  echo "示例: ./deploy.sh https://github.com/yourname/calendar-app.git"
  exit 1
fi

echo "=== 1. 安装系统依赖 ==="
sudo apt update
sudo apt install -y nginx curl git

# 安装 Node.js 20 LTS
if ! command -v node &> /dev/null; then
  echo "安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
echo "Node.js 版本: $(node -v)"

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
  echo "安装 PM2..."
  sudo npm install -g pm2
fi

echo "=== 2. 克隆代码 ==="
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

if [ -d "$APP_DIR/.git" ]; then
  echo "代码已存在，拉取最新..."
  cd $APP_DIR && git pull
else
  git clone $REPO_URL $APP_DIR
fi

echo "=== 3. 构建后端 ==="
cd $APP_DIR/server
npm ci --production=false
npm run build
mkdir -p data logs

echo "=== 4. 配置环境变量 ==="
if [ ! -f "$APP_DIR/server/.env" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  cat > $APP_DIR/server/.env << EOF
JWT_SECRET=$JWT_SECRET
PORT=3200
DATABASE_PATH=./data/calendar.db
DEEPSEEK_API_KEY=sk-d11aa3f278bd49988da176c87be717e5
EOF
  echo "已生成 .env 文件（含 DEEPSEEK_API_KEY）"
else
  echo ".env 已存在，跳过"
fi

echo "=== 5. 构建前端 ==="
cd $APP_DIR/client
npm ci
npm run build

echo "=== 6. 配置 Nginx ==="
sudo cp $APP_DIR/nginx.conf /etc/nginx/sites-available/calendar
sudo ln -sf /etc/nginx/sites-available/calendar /etc/nginx/sites-enabled/calendar
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== 7. 启动 PM2 ==="
cd $APP_DIR
mkdir -p logs
pm2 delete calendar-server 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "=== 部署完成 ==="
echo "应用地址: http://$(curl -s ifconfig.me)"
echo "PM2 状态: pm2 status"
echo "查看日志: pm2 logs calendar-server"
