import { EventEmitter } from 'node:events'
import { PublishQueue, type PublishResult } from './publish-queue'
import { contentService } from '../content/content-service'
import { platformService } from '../platform/platform-service'
import { runXhsMcpTask } from '../mcp/mcp-bridge'
import { loginGuard } from '../auth/login-guard'
import type { Content, PlatformType } from '../../../../packages/shared/src/types'
import { join } from 'node:path'
import { getDataDir } from '../../utils/paths'
import { log } from '../../utils/logger'

export interface AutoPublishConfig {
  enabled: boolean
  autoApprove: boolean // 自动审批服务器推送的内容
  platforms: PlatformType[] // 启用自动发布的平台
}

/**
 * 自动发布服务
 * 监听服务器推送，自动调度和执行发布任务
 */
export class AutoPublishService extends EventEmitter {
  private queue: PublishQueue
  private config: AutoPublishConfig
  private configPath: string

  constructor() {
    super()
    this.configPath = join(getDataDir(), 'auto-publish-config.json')
    this.config = this.loadConfig()
    this.queue = new PublishQueue()
    this.setupQueueListeners()
  }

  /**
   * 加载配置
   */
  private loadConfig(): AutoPublishConfig {
    try {
      const fs = require('node:fs')
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
      }
    } catch (error) {
      log.error('Failed to load auto-publish config:', error)
    }

    // 默认配置
    return {
      enabled: false,
      autoApprove: false,
      platforms: []
    }
  }

  /**
   * 保存配置
   */
  private saveConfig(): void {
    try {
      const fs = require('node:fs')
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (error) {
      log.error('Failed to save auto-publish config:', error)
    }
  }

  /**
   * 设置队列监听器
   */
  private setupQueueListeners(): void {
    // 处理发布请求
    this.queue.on('publish-request', async (content: Content, callback: (result: PublishResult) => void) => {
      try {
        const result = await this.executePublish(content)
        callback(result)
      } catch (error: any) {
        callback({
          success: false,
          contentId: content.id,
          error: error.message
        })
      }
    })

    // 转发队列事件
    this.queue.on('publish-start', (content) => {
      this.emit('publish-start', content)
    })

    this.queue.on('publish-success', (content, result) => {
      this.emit('publish-success', content, result)
    })

    this.queue.on('publish-failed', (content, error) => {
      this.emit('publish-failed', content, error)
    })

    this.queue.on('publish-retry', (content, retryCount) => {
      this.emit('publish-retry', content, retryCount)
    })

    this.queue.on('queue-updated', (status) => {
      this.emit('queue-updated', status)
    })
  }

  /**
   * 执行发布
   */
  private async executePublish(content: Content): Promise<PublishResult> {
    log.info(`[Publish] 开始发布: ${content.id} | 标题: ${content.title} | 平台: ${content.targetPlatform}`)

    // 更新内容状态为发布中
    await contentService.updateContent(content.id, {
      status: 'publishing'
    })

    try {
      // 检查平台是否已连接
      const activePlatform = await platformService.getActivePlatform()
      if (!activePlatform || activePlatform.platform !== content.targetPlatform) {
        const err = `平台 ${content.targetPlatform} 未连接或未激活`
        log.error(`[Publish] ❌ ${err} (content: ${content.id})`)
        throw new Error(err)
      }
      log.info(`[Publish] 平台已连接: ${activePlatform.platform}`)

      // 检查小红书 Cookie 是否过期
      if (content.targetPlatform === 'xiaohongshu') {
        const loggedIn = await loginGuard.ensureLoggedIn('publish')
        if (!loggedIn) {
          const err = '小红书登录已过期，请前往"平台管理"重新扫码登录'
          log.error(`[Publish] ❌ ${err} (content: ${content.id})`)
          throw new Error(err)
        }
        log.info(`[Publish] 小红书登录有效`)
      }

      // 根据平台类型调用对应的发布服务
      let result: PublishResult

      if (content.targetPlatform === 'xiaohongshu') {
        result = await this.publishToXiaohongshu(content)
      } else {
        throw new Error(`暂不支持平台: ${content.targetPlatform}`)
      }

      // 更新内容状态
      if (result.success) {
        log.info(`[Publish] ✅ 发布成功: ${content.id}`)
        await contentService.updateContent(content.id, {
          status: 'published',
          publishedAt: new Date().toISOString(),
          publishedUrl: result.publishedUrl
        })
      } else {
        log.error(`[Publish] ❌ 发布失败: ${content.id} | 原因: ${result.error}`)
        await contentService.updateContent(content.id, {
          status: 'failed',
          failureReason: result.error
        })
      }

      return result
    } catch (error: any) {
      log.error(`[Publish] ❌ 发布异常: ${content.id} | ${error.message}`)
      await contentService.updateContent(content.id, {
        status: 'failed',
        failureReason: error.message
      })

      return {
        success: false,
        contentId: content.id,
        error: error.message
      }
    }
  }

  /**
   * 发布到小红书
   */
  private async publishToXiaohongshu(content: Content): Promise<PublishResult> {
    const images = content.images.map(img => img.localPath || img.url || '')

    const result = await runXhsMcpTask({
      taskId: content.id,
      input: {
        title: content.title,
        body: content.body,
        tags: content.tags,
        images,
        visibility: content.visibility
      },
      logger: (level, event, data) => {
        this.emit('publish-log', { level, event, data, contentId: content.id })
      }
    })

    return {
      success: result.status === 'completed',
      contentId: content.id,
      error: result.errorMessage
    }
  }

  /**
   * 处理新内容推送
   */
  async handleNewContent(content: Content): Promise<void> {
    log.info(`[AutoPublish] 收到新内容: ${content.id} | 标题: ${content.title} | 平台: ${content.targetPlatform}`)

    if (!this.config.enabled) {
      log.info(`[AutoPublish] 自动发布未启用，跳过: ${content.id}`)
      return
    }

    // 检查平台是否启用自动发布
    if (!this.config.platforms.includes(content.targetPlatform)) {
      log.info(`[AutoPublish] 平台 ${content.targetPlatform} 未在启用列表中，跳过: ${content.id}`)
      return
    }

    // 如果启用自动审批，直接添加到队列
    if (this.config.autoApprove) {
      log.info(`[AutoPublish] 自动审批，加入发布队列: ${content.id}`)
      await contentService.updateContent(content.id, {
        status: 'approved'
      })
      this.queue.add(content)
    } else {
      log.info(`[AutoPublish] 未启用自动审批，等待手动审批: ${content.id}`)
    }
  }

  /**
   * 手动添加内容到发布队列
   */
  async addToQueue(contentId: string): Promise<void> {
    const content = await contentService.getContent(contentId)
    if (!content) {
      throw new Error('内容不存在')
    }

    if (content.status === 'published') {
      throw new Error('内容已发布')
    }

    // 更新状态为已审批
    await contentService.updateContent(contentId, {
      status: 'approved'
    })

    this.queue.add(content)
  }

  /**
   * 从队列中移除内容
   */
  removeFromQueue(contentId: string): void {
    this.queue.remove(contentId)
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return this.queue.getQueueStatus()
  }

  /**
   * 获取队列内容
   */
  getQueue() {
    return this.queue.getQueue()
  }

  /**
   * 获取配置
   */
  getConfig(): AutoPublishConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AutoPublishConfig>): AutoPublishConfig {
    this.config = {
      ...this.config,
      ...config
    }
    this.saveConfig()

    // 如果启用了自动发布，启动队列
    if (this.config.enabled) {
      this.queue.start()
    } else {
      this.queue.stop()
    }

    return this.config
  }

  /**
   * 扫描超时内容并加入发布队列
   * 在应用启动时调用，处理因应用未运行而错过发布时间的内容
   */
  async scanOverdueContent(): Promise<number> {
    if (!this.config.enabled) {
      return 0
    }

    try {
      const allContents = await contentService.listContents()
      const now = Date.now()
      let count = 0

      for (const content of allContents) {
        // 只处理 pending/approved 状态
        if (content.status !== 'pending' && content.status !== 'approved') {
          continue
        }

        // 检查平台是否在启用列表中
        if (this.config.platforms.length > 0 && !this.config.platforms.includes(content.targetPlatform)) {
          continue
        }

        // 检查 scheduledAt 是否已过期
        if (!content.scheduledAt) {
          continue
        }
        const scheduledTime = typeof content.scheduledAt === 'number'
          ? content.scheduledAt
          : new Date(content.scheduledAt).getTime()
        if (scheduledTime >= now) {
          continue
        }

        // 加入发布队列（queue.add 内部会去重）
        await this.addToQueue(content.id)
        count++
      }

      if (count > 0) {
        log.info(`[AutoPublish] 发现 ${count} 条超时内容，加入发布队列`)
      }

      return count
    } catch (error) {
      log.error('[AutoPublish] 扫描超时内容失败:', error)
      return 0
    }
  }

  /**
   * 启动服务
   */
  start(): void {
    if (this.config.enabled) {
      this.queue.start()
    }
  }

  /**
   * 停止服务
   */
  stop(): void {
    this.queue.stop()
  }
}

// 单例
export const autoPublishService = new AutoPublishService()
