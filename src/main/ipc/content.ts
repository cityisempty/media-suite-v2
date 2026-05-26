import { ipcMain } from 'electron'
import { contentService } from '../services/content/content-service'
import type { Content } from '../../../packages/shared/src/types'

// 正在发布中的内容 ID 集合，防止重复发布
const publishingSet = new Set<string>()

/**
 * 注册内容相关的 IPC Handler
 */
export function registerContentHandlers(): void {
  // 获取内容列表
  ipcMain.handle('content:list', async (_event, filters?: any) => {
    try {
      const contents = await contentService.listContents(filters)
      return { success: true, data: contents }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取单个内容
  ipcMain.handle('content:get', async (_event, id: string) => {
    try {
      const content = await contentService.getContent(id)
      return { success: true, data: content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 更新内容
  ipcMain.handle('content:update', async (_event, id: string, data: Partial<Content>) => {
    try {
      const content = await contentService.updateContent(id, data)
      return { success: true, data: content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 删除内容
  ipcMain.handle('content:delete', async (_event, id: string) => {
    try {
      await contentService.deleteContent(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 发布内容（异步：立即返回，后台执行）
  ipcMain.handle('content:publish', async (event, id: string) => {
    // 防止重复发布
    if (publishingSet.has(id)) {
      return { success: false, error: '该内容正在发布中，请稍候' }
    }

    try {
      // 验证内容存在且可发布
      const content = await contentService.getContent(id)
      if (!content) {
        return { success: false, error: '内容不存在' }
      }
      if (content.status === 'published') {
        return { success: false, error: '内容已发布' }
      }
      if (content.status === 'publishing') {
        return { success: false, error: '内容正在发布中' }
      }

      // 检查小红书登录状态
      const { loginGuard } = await import('../services/auth/login-guard')
      const loggedIn = await loginGuard.ensureLoggedIn('publish')
      if (!loggedIn) {
        return { success: false, error: 'NOT_LOGGED_IN', needLogin: true }
      }

      // 标记为发布中
      publishingSet.add(id)
      await contentService.updateContent(id, { status: 'publishing' })

      // 立即返回，后台继续执行
      const sender = event.sender
      setImmediate(async () => {
        try {
          const result = await contentService.executePublish(id, content)
          sender.send('content:publish-progress', {
            id,
            status: result.status,
            error: result.status === 'failed' ? (result as any).error : undefined
          })
        } catch (error: any) {
          sender.send('content:publish-progress', {
            id,
            status: 'failed',
            error: error.message
          })
        } finally {
          publishingSet.delete(id)
        }
      })

      return { success: true, data: { ...content, status: 'publishing' } }
    } catch (error: any) {
      publishingSet.delete(id)
      return { success: false, error: error.message }
    }
  })

  // 获取最近内容
  ipcMain.handle('content:get-recent', async (_event, days: number = 7) => {
    try {
      const contents = await contentService.getRecentContents(days)
      return { success: true, data: contents }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取按日期分组的内容
  ipcMain.handle('content:get-by-date', async () => {
    try {
      const grouped = await contentService.getContentsByDate()
      // 转换 Map 为普通对象以便序列化
      const result: Record<string, Content[]> = {}
      grouped.forEach((value, key) => {
        result[key] = value
      })
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
