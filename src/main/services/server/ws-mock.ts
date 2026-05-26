import { WSClient } from './ws-client'
import { serverConfig } from './server-config'
import type { Content } from '../../../shared/types'

/**
 * Mock WebSocket 客户端 - 模拟服务器推送
 */
export class MockWSClient extends WSClient {
  private mockTimer: NodeJS.Timeout | null = null

  constructor() {
    // Mock 模式下不需要真实连接
    super({
      url: serverConfig.wsUrl,
      token: 'mock-token'
    })
  }

  /**
   * 模拟连接
   */
  connect(): void {
    console.log('[MockWSClient] Mock connection established')

    // 延迟触发连接事件
    setTimeout(() => {
      this.emit('connected')
      this.startMockPush()
    }, 500)
  }

  /**
   * 模拟断开
   */
  disconnect(): void {
    console.log('[MockWSClient] Mock connection closed')

    if (this.mockTimer) {
      clearInterval(this.mockTimer)
      this.mockTimer = null
    }

    this.emit('disconnected')
  }

  /**
   * 模拟发送消息
   */
  send(message: any): void {
    console.log('[MockWSClient] Mock send:', message)
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.mockTimer !== null
  }

  /**
   * 启动模拟推送
   */
  private startMockPush(): void {
    // 每30秒模拟推送一次内容
    this.mockTimer = setInterval(() => {
      this.mockContentPush()
    }, 30000)

    // 立即推送一次
    setTimeout(() => {
      this.mockContentPush()
    }, 3000)
  }

  /**
   * 模拟内容推送
   */
  private mockContentPush(): void {
    const mockContent: Content = {
      id: `content_${Date.now()}`,
      userId: 'mock-user',
      personaId: 'mock-persona',
      title: '服务器自动生成的内容标题',
      body: '这是服务器根据您的 IP 人设自动生成的内容正文。\n\n包含多段落文本，符合您设定的语言风格和创作领域。',
      images: [],
      tags: ['自动生成', 'AI创作', '测试标签'],
      platforms: ['xiaohongshu', 'douyin'],
      status: 'pending',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1小时后
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    console.log('[MockWSClient] Pushing mock content:', mockContent.id)
    this.emit('content_push', mockContent)

    // 模拟系统通知
    setTimeout(() => {
      this.emit('system_notification', {
        type: 'info',
        title: '新内容已推送',
        message: '服务器已为您生成一篇新内容，请查看并确认发布'
      })
    }, 1000)
  }
}

/**
 * WebSocket 客户端工厂
 */
export function createWSClient(): WSClient {
  if (serverConfig.useMock) {
    return new MockWSClient()
  }

  // TODO: 服务器开发完成后使用真实 WebSocket
  return new WSClient({
    url: serverConfig.wsUrl,
    token: '' // 需要从登录后获取
  })
}
