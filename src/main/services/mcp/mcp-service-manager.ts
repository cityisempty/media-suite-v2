import { McpClient } from './mcp-client'
import { app } from 'electron'
import { log } from '../../utils/logger'

/**
 * MCP 服务管理器
 * 管理 MCP 服务的生命周期，确保服务在应用启动时启动，并在整个应用中复用
 */
class McpServiceManager {
  private client: McpClient | null = null
  private isInitialized = false
  private initPromise: Promise<void> | null = null

  /**
   * 初始化 MCP 服务
   */
  async initialize(): Promise<void> {
    // 如果正在初始化，等待完成
    if (this.initPromise) {
      return this.initPromise
    }

    // 如果已经初始化，直接返回
    if (this.isInitialized && this.client) {
      return
    }

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  private async _doInitialize(): Promise<void> {
    try {
      log.info('[McpServiceManager] 正在初始化 MCP 服务...')

      this.client = new McpClient('http://127.0.0.1:18060', (msg) => {
        log.info(`[MCP] ${msg}`)
      })

      await this.client.start()
      this.isInitialized = true

      log.info('[McpServiceManager] MCP 服务初始化完成')
    } catch (error) {
      log.error('[McpServiceManager] MCP 服务初始化失败:', error)
      this.client = null
      this.isInitialized = false
      throw error
    } finally {
      this.initPromise = null
    }
  }

  /**
   * 获取 MCP 客户端实例
   */
  async getClient(): Promise<McpClient> {
    // 如果未初始化，先初始化
    if (!this.isInitialized || !this.client) {
      await this.initialize()
    }

    // 检查服务健康状态，如果不健康则重新初始化
    if (this.client) {
      const isHealthy = await this.client.healthCheck()
      if (!isHealthy) {
        log.info('[McpServiceManager] MCP 服务不健康，正在重新初始化...')
        this.client = null
        this.isInitialized = false
        await this.initialize()
      }
    }

    if (!this.client) {
      throw new Error('MCP 服务未初始化')
    }

    return this.client
  }

  /**
   * 检查服务是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null
  }

  /**
   * 停止 MCP 服务
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      log.info('[McpServiceManager] 正在停止 MCP 服务...')
      await this.client.stop()
      this.client = null
      this.isInitialized = false
      log.info('[McpServiceManager] MCP 服务已停止')
    }
  }
}

// 单例
export const mcpServiceManager = new McpServiceManager()

// 应用退出时自动清理
app.on('before-quit', async () => {
  await mcpServiceManager.shutdown()
})
