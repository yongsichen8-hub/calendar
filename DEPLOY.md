# Calendar App 部署指南

## 前置条件
- Ubuntu 服务器 (2核2G)
- 有 sudo 权限的用户

## 步骤一：创建 GitHub 仓库

在本地 `calendar/` 目录下执行：

```bash
cd calendar
git init
git add .
git commit -m "初始提交"
```

然后去 GitHub 创建新仓库（不要勾选 README），按提示推送：

```bash
git remote add origin https://github.com/你的用户名/calendar-app.git
git branch -M main
git push -u origin main
```

## 步骤二：服务器部署

SSH 登录服务器后执行：

```bash
# 下载部署脚本（或手动上传）
curl -O https://raw.githubusercontent.com/你的用户名/calendar-app/main/deploy.sh
chmod +x deploy.sh
./deploy.sh https://github.com/你的用户名/calendar-app.git
```

## 步骤三：配置环境变量

编辑服务器上的 `.env` 文件：

```bash
nano /opt/calendar/server/.env
```

必填项：
- `JWT_SECRET` — 部署脚本已自动生成
- `DEEPSEEK_API_KEY` — AI 摘要功能需要（可选）

## 后续更新

```bash
cd /opt/calendar
git pull
cd server && npm ci --production=false && npm run build
cd ../client && npm ci && npm run build
pm2 restart calendar-server
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pm2 status` | 查看进程状态 |
| `pm2 logs calendar-server` | 查看日志 |
| `pm2 restart calendar-server` | 重启后端 |
| `sudo systemctl reload nginx` | 重载 Nginx |
| `sudo nginx -t` | 测试 Nginx 配置 |
