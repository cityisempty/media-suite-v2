import { LocalStore } from '../../db/local-store'
import type { Content } from '../../../../packages/shared/src/types'
import { join } from 'node:path'
import { getDataDir } from '../../utils/paths'
import { log } from '../../utils/logger'

/**
 * 内容服务
 * 管理服务器推送的物料包
 */
export class ContentService {
  private store: LocalStore<Content[]>

  constructor() {
    const dataPath = join(getDataDir(), 'contents.json')
    this.store = new LocalStore<Content[]>(dataPath)
  }

  /**
   * 获取所有内容
   */
  async listContents(filters?: {
    status?: Content['status']
    platform?: string
    startDate?: number
    endDate?: number
  }): Promise<Content[]> {
    let contents = this.store.read() || []

    if (filters) {
      if (filters.status) {
        contents = contents.filter(c => c.status === filters.status)
      }
      if (filters.platform) {
        contents = contents.filter(c => c.platform === filters.platform)
      }
      if (filters.startDate) {
        contents = contents.filter(c => c.scheduledAt >= filters.startDate!)
      }
      if (filters.endDate) {
        contents = contents.filter(c => c.scheduledAt <= filters.endDate!)
      }
    }

    // 按计划发布时间倒序排列
    return contents.sort((a, b) => b.scheduledAt - a.scheduledAt)
  }

  /**
   * 获取单个内容
   */
  async getContent(id: string): Promise<Content | null> {
    const contents = this.store.read() || []
    return contents.find(c => c.id === id) || null
  }

  /**
   * 接收服务器推送的内容
   */
  async receiveContent(data: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>): Promise<Content> {
    const content: Content = {
      id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const contents = this.store.read() || []
    contents.push(content)
    this.store.write(contents)

    return content
  }

  /**
   * 更新内容
   */
  async updateContent(id: string, data: Partial<Omit<Content, 'id' | 'createdAt'>>): Promise<Content> {
    const contents = this.store.read() || []
    const index = contents.findIndex(c => c.id === id)

    if (index === -1) {
      throw new Error('内容不存在')
    }

    contents[index] = {
      ...contents[index],
      ...data,
      updatedAt: Date.now()
    }

    this.store.write(contents)
    return contents[index]
  }

  /**
   * 删除内容
   */
  async deleteContent(id: string): Promise<void> {
    const contents = this.store.read() || []
    const filtered = contents.filter(c => c.id !== id)

    if (filtered.length === contents.length) {
      throw new Error('内容不存在')
    }

    this.store.write(filtered)
  }

  /**
   * 发布内容（同步版本，设置状态并等待完成）
   */
  async publishContent(id: string): Promise<Content> {
    log.info('[ContentService] 开始发布内容:', id)
    const content = await this.getContent(id)
    if (!content) {
      throw new Error('内容不存在')
    }

    if (content.status === 'published') {
      throw new Error('内容已发布')
    }

    // 更新状态为发布中
    await this.updateContent(id, { status: 'publishing' })

    return this.executePublish(id, content)
  }

  /**
   * 执行发布（核心逻辑，可被同步和异步流程复用）
   */
  async executePublish(id: string, content: Content): Promise<Content> {
    try {
      // 调用 MCP 发布服务
      log.info('[ContentService] 导入 MCP 桥接模块')
      const { runXhsMcpTask } = await import('../mcp/mcp-bridge')

      // 从 images 提取本地文件路径
      const localImages = (content.images || [])
        .map(img => {
          if (typeof img === 'string') {
            if (img.startsWith('local-file://')) {
              let p = decodeURIComponent(img.replace('local-file://', ''))
              // Windows: /C:/path -> C:/path
              if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1)
              return p
            }
            return img
          }
          return img.localPath || img.url || ''
        })
        .filter(p => p.startsWith('/') || p.startsWith('file://') || /^[A-Za-z]:/.test(p))

      if (localImages.length === 0) {
        if ((content.images || []).length > 0) {
          throw new Error('小红书发布需要本地图片，当前内容只有外部 URL 图片。请在内容编辑中上传本地图片。')
        } else {
          throw new Error('小红书发布需要至少一张图片，请在内容编辑中上传图片。')
        }
      }

      log.info('[ContentService] 调用 MCP 发布任务，图片路径:', localImages)
      const result = await runXhsMcpTask({
        taskId: id,
        input: {
          title: content.title,
          body: content.body,
          tags: content.tags || [],
          images: localImages,
          visibility: '公开可见'
        },
        logger: (level, event, data) => {
          log.info(`[${level}] ${event}:`, data)
        }
      })

      log.info('[ContentService] MCP 发布任务完成:', result)

      if (result.status === 'completed') {
        log.info('[ContentService] 发布成功，更新状态')
        return await this.updateContent(id, {
          status: 'published',
          publishedAt: Date.now()
        })
      } else {
        log.info('[ContentService] 发布失败:', result.errorMessage)
        return await this.updateContent(id, {
          status: 'failed',
          error: result.errorMessage || '发布失败'
        })
      }
    } catch (error) {
      log.error('[ContentService] 发布异常:', error)
      return await this.updateContent(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : '发布失败'
      })
    }
  }

  /**
   * 获取按日期分组的内容
   */
  async getContentsByDate(): Promise<Map<string, Content[]>> {
    const contents = await this.listContents()
    const grouped = new Map<string, Content[]>()

    contents.forEach(content => {
      const date = new Date(content.scheduledAt).toLocaleDateString('zh-CN')
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(content)
    })

    return grouped
  }

  /**
   * 获取最近N天的内容
   */
  async getRecentContents(days: number = 7): Promise<Content[]> {
    const now = Date.now()
    const startDate = now - days * 24 * 60 * 60 * 1000

    return await this.listContents({
      startDate,
      endDate: now + 7 * 24 * 60 * 60 * 1000 // 包含未来7天
    })
  }
}

// 单例
export const contentService = new ContentService()
