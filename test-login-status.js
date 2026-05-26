import http from 'http'

let sessionId = null

function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    const payload = {
      jsonrpc: '2.0',
      method,
      params
    }

    // 通知请求不需要 id
    if (!method.startsWith('notifications/')) {
      payload.id = 1
    }

    const data = JSON.stringify(payload)

    const options = {
      hostname: 'localhost',
      port: 18060,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': data.length
      }
    }

    if (sessionId) {
      options.headers['Mcp-Session-Id'] = sessionId
    }

    const req = http.request(options, (res) => {
      // 捕获 session ID
      if (res.headers['mcp-session-id']) {
        sessionId = res.headers['mcp-session-id']
        console.log('获取到 Session ID:', sessionId)
      }

      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        if (!body || body.trim() === '') {
          resolve({ success: true })
          return
        }
        try {
          const result = JSON.parse(body)
          resolve(result)
        } catch (e) {
          console.log('响应内容:', body)
          reject(new Error('解析失败: ' + e.message))
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  try {
    // 1. Initialize
    console.log('1. 发送 initialize 请求...')
    const initResult = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    })
    console.log('Initialize 结果:', JSON.stringify(initResult, null, 2))

    // 2. Send initialized notification
    console.log('\n2. 发送 initialized 通知...')
    await sendRequest('notifications/initialized', {})

    // 3. Check login status
    console.log('\n3. 检查登录状态...')
    const statusResult = await sendRequest('tools/call', {
      name: 'check_login_status',
      arguments: {}
    })

    console.log('\n完整结果:', JSON.stringify(statusResult, null, 2))

    if (statusResult.result && statusResult.result.content) {
      const textContent = statusResult.result.content.find(c => c.type === 'text')
      if (textContent) {
        console.log('\n=== 登录状态文本 ===')
        console.log(textContent.text)
        console.log('===================')
      }
    }
  } catch (error) {
    console.error('错误:', error)
  }
}

main()
