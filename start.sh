#!/bin/bash

# 7702 Project Startup Script
# 同时启动前端和后端服务

echo "🚀 Starting 7702 Project..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 启动后端 Relayer 服务
echo -e "${BLUE}📡 Starting Relayer Server (Backend)...${NC}"
npx tsx server/server.ts &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端开发服务器
echo ""
echo -e "${GREEN}🌐 Starting Frontend Dev Server...${NC}"
pnpm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Both services started!${NC}"
echo ""
echo "📡 Relayer Server: http://localhost:3000"
echo "🌐 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# 捕获 Ctrl+C 信号并清理进程
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# 等待任一进程结束
wait
