const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 获取数据目录
const dataDir = path.join(process.env.HOME, 'Library', 'Application Support', 'media-automation-suite');
const cookiePath = path.join(dataDir, 'cookies.json');

console.log('数据目录:', dataDir);
console.log('Cookie 路径:', cookiePath);

// 检查 cookie 文件是否存在
if (!fs.existsSync(cookiePath)) {
  console.error('Cookie 文件不存在，请先登录小红书');
  process.exit(1);
}

// 启动 MCP 服务
const binaryPath = path.join(__dirname, 'tools', 'bin', 'xhs-mcp');
const mcpProcess = spawn(binaryPath, ['-headless=true'], {
  cwd: dataDir,
  env: {
    ...process.env,
    COOKIES_PATH: cookiePath,
    PROFILE_DIR: dataDir
  }
});

mcpProcess.stdout.on('data', (data) => {
  console.log('[MCP stdout]', data.toString().trim());
});

mcpProcess.stderr.on('data', (data) => {
  console.log('[MCP stderr]', data.toString().trim());
});

// 等待服务启动
setTimeout(async () => {
  try {
    // 初始化
    const initRes = await fetch('http://127.0.0.1:18060/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });

    const sessionId = initRes.headers.get('mcp-session-id');
    console.log('\nSession ID:', sessionId);

    // 发送 initialized 通知
    await fetch('http://127.0.0.1:18060/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      })
    });

    // 调用 list_feeds
    const feedsRes = await fetch('http://127.0.0.1:18060/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_feeds',
          arguments: {}
        }
      })
    });

    const feedsData = await feedsRes.json();
    console.log('\n=== list_feeds 返回数据 ===');
    console.log(JSON.stringify(feedsData, null, 2));

    // 尝试解析内容
    if (feedsData.result && feedsData.result.content) {
      const textContent = feedsData.result.content.find(c => c.type === 'text');
      if (textContent) {
        console.log('\n=== 解析后的 JSON ===');
        const parsed = JSON.parse(textContent.text);
        console.log(JSON.stringify(parsed, null, 2));

        console.log('\n=== 检查 currentUser 字段 ===');
        console.log('currentUser:', parsed.currentUser);
      }
    }

    mcpProcess.kill();
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    mcpProcess.kill();
    process.exit(1);
  }
}, 5000);
