import { ipcMain } from 'electron'
import { platformService } from '../services/platform/platform-service'
import { LoginService } from '../services/mcp/login-service'

const loginService = new LoginService()

export function registerPlatformHandlers(): void {
  // 获取所有平台账号
  ipcMain.handle('platform:list', async () => {
    try {
      const accounts = await platformService.listAccounts()
      return { success: true, data: accounts }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取单个平台账号
  ipcMain.handle('platform:get', async (_, id: string) => {
    try {
      const account = await platformService.getAccount(id)
      return { success: true, data: account }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 按平台类型获取账号
  ipcMain.handle('platform:get-by-platform', async (_, platform: string) => {
    try {
      const accounts = await platformService.getAccountsByPlatform(platform)
      return { success: true, data: accounts }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 添加平台账号
  ipcMain.handle('platform:add', async (_, data: any) => {
    try {
      const account = await platformService.addAccount(data)
      return { success: true, data: account }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 更新平台账号
  ipcMain.handle('platform:update', async (_, id: string, data: any) => {
    try {
      const account = await platformService.updateAccount(id, data)
      return { success: true, data: account }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 删除平台账号（小红书账号会同时清除 Cookie）
  ipcMain.handle('platform:delete', async (_, id: string) => {
    try {
      // 先获取账号信息，判断是否是小红书
      const account = await platformService.getAccount(id)
      if (account && account.platform === 'xiaohongshu') {
        // 清除小红书 Cookie
        await loginService.clearLogin()
        console.log('[Platform] 已清除小红书 Cookie')
      }
      await platformService.deleteAccount(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 更新账号状态
  ipcMain.handle('platform:update-status', async (_, id: string, status: string) => {
    try {
      const account = await platformService.updateAccountStatus(id, status as any)
      return { success: true, data: account }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取已连接的账号
  ipcMain.handle('platform:get-connected', async () => {
    try {
      const accounts = await platformService.getConnectedAccounts()
      return { success: true, data: accounts }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
