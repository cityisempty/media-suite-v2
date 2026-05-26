import { EventEmitter } from 'events'
import type { Content } from '../../../shared/types'
import { log } from '../../utils/logger'

export interface WSMessage {
  type: 'content_push' | 'publish_status' | 'analytics_update' | 'system_notification'
  data: any
  timestamp: number
}

export interface WSClientOptions {
  url: string
  token: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

/**
 * WebSocket 客户端 - 接收服务器推送的内容和状态更新
 */
export class WSClient extends EventEmitter {
  private ws: WebSocket | null = null
  private options: Required<WSClientOptions>
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private isManualClose = false

  constructor(options: WSClientOptions) {
    super()
    this.options = {
      ...options,
      reconnectInterval: options.reconnectInterval || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10
    }
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      log.info('[WSClient] Already connected')
      return
    }

    this.isManualClose = false
    const wsUrl = `${this.options.url}?token=${this.options.token}`

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        log.info('[WSClient] Connected')
        this.reconnectAttempts = 0
        this.emit('connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          log.error('[WSClient] Failed to parse message:', error)
        }
      }

      this.ws.onerror = (error) => {
        log.error('[WSClient] Error:', error)
        this.emit('error', error)
      }

      this.ws.onclose = () => {
        log.info('[WSClient] Disconnected')
        this.emit('disconnected')

        if (!this.isManualClose) {
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      log.error('[WSClient] Failed to create WebSocket:', error)
      this.emit('error', error)
      this.scheduleReconnect()
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.isManualClose = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * 发送消息到服务器
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      log.warn('[WSClient] Cannot send message: not connected')
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WSMessage): void {
    log.info('[WSClient] Received message:', message.type)

    switch (message.type) {
      case 'content_push':
        // 服务器推送新内容待发布
        this.emit('content_push', message.data as Content)
        break

      case 'publish_status':
        // 发布状态更新
        this.emit('publish_status', message.data)
        break

      case 'analytics_update':
        // 数据分析更新
        this.emit('analytics_update', message.data)
        break

      case 'system_notification':
        // 系统通知
        this.emit('system_notification', message.data)
        break

      default:
        log.warn('[WSClient] Unknown message type:', message.type)
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      log.error('[WSClient] Max reconnect attempts reached')
      this.emit('max_reconnect_attempts')
      return
    }

    this.reconnectAttempts++
    log.info(`[WSClient] Reconnecting in ${this.options.reconnectInterval}ms (attempt ${this.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, this.options.reconnectInterval)
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
