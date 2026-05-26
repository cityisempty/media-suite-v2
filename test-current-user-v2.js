/**
 * 测试获取当前登录用户信息 - 方法2：尝试访问"我的"页面
 */

let sessionId = null

async function testCurrentUser() {
  try {
    // 0. 初始化会话
    console.log('\n=== 0. 初始化 MCP 会话 ===')
    const initResponse = await fetch('http://127.0.0.1:18060/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-script', version: '1.0.0' }
        }
      })
    })
    sessionId = initResponse.headers.get('mcp-session-id')
    console.log('Session ID:', sessionId)

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
    })

    // 1. 尝试获取"我的"页面的 feeds（可能包含当前用户发布的内容）
    console.log('\n=== 1. 获取首页 Feed（寻找当前用户标记）===')
    const feedsResponse = await fetch('http://127.0.0.1:18060/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'list_feeds',
          arguments: {}
        }
      })
    })
    const feedsResult = await feedsResponse.json()

    // 解析 feeds 数据，查找可能的当前用户标记
    if (feedsResult.result?.content) {
      const textContent = feedsResult.result.content.find(c => c.type === 'text')
      if (textContent) {
        const feedsData = JSON.parse(textContent.text)
        console.log('Feeds 数量:', feedsData.feeds?.length || 0)

        // 查看是否有任何字段标记当前用户
        if (feedsData.feeds && feedsData.feeds.length > 0) {
          const firstFeed = feedsData.feeds[0]
          console.log('\n第一个 Feed 的完整 noteCard.user 对象:')
          console.log(JSON.stringify(firstFeed.noteCard?.user, null, 2))
        }
      }
    }

    // 2. 尝试使用空的 user_id 调用 user_profile（可能返回当前用户）
    console.log('\n=== 2. 尝试用空 user_id 调用 user_profile ===')
    const emptyProfileResponse = await fetch('http://127.0.0.1:18060/mcp', {
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
          name: 'user_profile',
          arguments: {}
        }
      })
    })
    const emptyProfileResult = await emptyProfileResponse.json()
    console.log('结果:', JSON.stringify(emptyProfileResult, null, 2))

  } catch (error) {
    console.error('错误:', error)
  }
}

testCurrentUser()
