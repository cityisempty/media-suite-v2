#!/bin/bash

# 启用详细日志的开发模式
# 使用方法: npm run dev:logs 或 bash scripts/dev-with-logs.sh

echo "🚀 启动应用（详细日志模式）..."
echo "================================================"

# 设置环境变量以启用详细日志
export DEBUG=*
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_LOG_FILE=electron.log

# 启动应用
npm run dev 2>&1 | tee dev.log

echo "================================================"
echo "日志已保存到 dev.log 文件"
