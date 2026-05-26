/**
 * 测试获取当前登录用户信息
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

    // 1. 检查登录状态
    console.log('\n=== 1. 检查登录状态 ===')
    const loginResponse = await fetch('http://127.0.0.1:18060/mcp', {
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
          name: 'check_login_status',
          arguments: {}
        }
      })
    })
    const loginResult = await loginResponse.json()
    console.log('登录状态:', JSON.stringify(loginResult, null, 2))

    // 2. 尝试搜索"我"或空字符串，看能否获取当前用户信息
    console.log('\n=== 2. 搜索测试 ===')
    const searchResponse = await fetch('http://127.0.0.1:18060/mcp', {
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
          name: 'search_feeds',
          arguments: {
            keyword: '心理学'
          }
        }
      })
    })
    const searchResult = await searchResponse.json()
    console.log('搜索结果:', JSON.stringify(searchResult, null, 2))

    // 3. 获取首页 Feed
    console.log('\n=== 3. 获取首页 Feed ===')
    const feedsResponse = await fetch('http://127.0.0.1:18060/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_feeds',
          arguments: {}
        }
      })
    })
    const feedsResult = await feedsResponse.json()

    // 解析 feeds 数据
    if (feedsResult.result?.content) {
      const textContent = feedsResult.result.content.find(c => c.type === 'text')
      if (textContent) {
        const feedsData = JSON.parse(textContent.text)
        console.log('Feeds 数量:', feedsData.feeds?.length || 0)

        if (feedsData.feeds && feedsData.feeds.length > 0) {
          const firstFeed = feedsData.feeds[0]
          console.log('\n第一个 Feed 信息:')
          console.log('  - userId:', firstFeed.noteCard?.user?.userId)
          console.log('  - nickname:', firstFeed.noteCard?.user?.nickname)
          console.log('  - xsecToken:', firstFeed.xsecToken)

          // 4. 使用第一个 Feed 的用户信息获取用户主页
          console.log('\n=== 4. 获取用户主页（第一个 Feed 的用户）===')
          const profileResponse = await fetch('http://127.0.0.1:18060/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 4,
              method: 'tools/call',
              params: {
                name: 'user_profile',
                arguments: {
                  user_id: firstFeed.noteCard?.user?.userId,
                  xsec_token: firstFeed.xsecToken
                }
              }
            })
          })
          const profileResult = await profileResponse.json()

          if (profileResult.result?.content) {
            const profileText = profileResult.result.content.find(c => c.type === 'text')
            if (profileText) {
              const profileData = JSON.parse(profileText.text)
              console.log('用户主页信息:')
              console.log('  - 昵称:', profileData.userBasicInfo?.nickname)
              console.log('  - 用户ID:', profileData.userBasicInfo?.userId)
              console.log('  - 粉丝数:', profileData.interactions?.find(i => i.name === '粉丝')?.count)
              console.log('  - 获赞数:', profileData.interactions?.find(i => i.name === '获赞与收藏')?.count)
              console.log('  - 笔记数:', profileData.feeds?.length || 0)
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('测试失败:', error)
  }
}

testCurrentUser()
