import { EventEmitter } from 'node:events'
import type { Content } from '../../../../packages/shared/src/types'

export interface QueueItem {
  content: Content
  retryCount: number
  scheduledTime: number
}

export interface PublishResult {
  success: boolean
  contentId: string
  publishedUrl?: string
  error?: string
}

/**
 * 发布队列管理器
 * 管理待发布内容的队列和调度
 */
export class PublishQueue extends EventEmitter {
  private queue: QueueItem[] = []
  private processing = false
  private timer: NodeJS.Timeout | null = null

  constructor() {
    super()
  }

  /**
   * 添加内容到队列
   */
  add(content: Content): void {
    const existing = this.queue.find(item => item.content.id === content.id)
    if (existing) {
      // 更新已存在的项
      existing.content = content
      existing.scheduledTime = content.scheduledAt ? new Date(content.scheduledAt).getTime() : Date.now()
    } else {
      // 添加新项
      this.queue.push({
        content,
        retryCount: 0,
        scheduledTime: content.scheduledAt ? new Date(content.scheduledAt).getTime() : Date.now()
      })
    }

    // 按计划时间排序
    this.queue.sort((a, b) => a.scheduledTime - b.scheduledTime)

    this.emit('queue-updated', this.getQueueStatus())
    this.scheduleNext()
  }

  /**
   * 从队列中移除内容
   */
  remove(contentId: string): void {
    const index = this.queue.findIndex(item => item.content.id === contentId)
    if (index !== -1) {
      this.queue.splice(index, 1)
      this.emit('queue-updated', this.getQueueStatus())
    }
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = []
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.emit('queue-updated', this.getQueueStatus())
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(item => item.content.status === 'pending').length,
      processing: this.processing,
      nextScheduledTime: this.queue[0]?.scheduledTime
    }
  }

  /**
   * 获取队列中的所有内容
   */
  getQueue(): QueueItem[] {
    return [...this.queue]
  }

  /**
   * 调度下一个任务
   */
  private scheduleNext(): void {
    if (this.processing || this.queue.length === 0) {
      return
    }

    const next = this.queue[0]
    const now = Date.now()
    const delay = Math.max(0, next.scheduledTime - now)

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      this.processNext()
    }, delay)
  }

  /**
   * 处理下一个任务
   */
  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    const item = this.queue.shift()!

    try {
      this.emit('publish-start', item.content)

      // 发出发布请求事件，由外部处理实际发布逻辑
      const result = await new Promise<PublishResult>((resolve) => {
        this.emit('publish-request', item.content, resolve)
      })

      if (result.success) {
        this.emit('publish-success', item.content, result)
      } else {
        // 发布失败，根据重试次数决定是否重试
        if (item.retryCount < 3) {
          item.retryCount++
          item.scheduledTime = Date.now() + 5 * 60 * 1000 // 5分钟后重试
          this.queue.push(item)
          this.queue.sort((a, b) => a.scheduledTime - b.scheduledTime)
          this.emit('publish-retry', item.content, item.retryCount)
        } else {
          this.emit('publish-failed', item.content, result.error)
        }
      }
    } catch (error: any) {
      this.emit('publish-error', item.content, error.message)
    } finally {
      this.processing = false
      this.emit('queue-updated', this.getQueueStatus())
      this.scheduleNext()
    }
  }

  /**
   * 启动队列处理
   */
  start(): void {
    this.scheduleNext()
  }

  /**
   * 停止队列处理
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.processing = false
  }
}
