import { ipcMain } from 'electron'
import { LoginService } from '../services/mcp/login-service'
import { platformService } from '../services/platform/platform-service'

const loginService = new LoginService()

export function registerXhsLoginIpc(): void {
  ipcMain.handle('xhs:login', async () => {
    try {
      const result = await loginService.startLogin()
      // 登录成功后不需要立即同步平台信息，让前端自己决定何时同步
      return { success: true, ...result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('xhs:login-status', async () => {
    const status = await loginService.checkLoginStatus()
    // 只返回登录状态，不自动同步平台信息
    return status
  })

  ipcMain.handle('xhs:clear-cookies', async () => {
    await loginService.clearLogin()
    return { success: true }
  })

  ipcMain.handle('xhs:get-qrcode', async () => {
    try {
      const result = await loginService.getLoginQRCode()
      return { success: true, ...result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
