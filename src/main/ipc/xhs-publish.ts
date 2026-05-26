import { ipcMain, BrowserWindow } from 'electron'
import { runXhsMcpTask } from '../services/mcp/mcp-bridge'

export function registerXhsPublishIpc(): void {
  ipcMain.handle('xhs:publish', async (event, params: {
    title: string
    body: string
    tags: string[]
    images: string[]
    visibility: string
  }) => {
    // 检查小红书登录状态
    const { loginGuard } = await import('../services/auth/login-guard')
    const loggedIn = await loginGuard.ensureLoggedIn('publish')
    if (!loggedIn) {
      return { success: false, error: 'NOT_LOGGED_IN', needLogin: true }
    }

    const win = BrowserWindow.fromWebContents(event.sender)

    // 将 logger 输出转发到 Renderer 进程
    const logger = (level: string, logEvent: string, data: any = {}) => {
      win?.webContents.send('xhs:publish-progress', { level, event: logEvent, data })
    }

    try {
      const result = await runXhsMcpTask({
        taskId: `task-${Date.now()}`,
        input: params,
        logger
      })
      return {
        success: result.status === 'completed',
        summary: result.summary,
        error: result.errorMessage
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
