import { BrowserWindow } from 'electron'
import { loginService } from '../mcp/login-service'
import { notifyUser } from '../../utils/notification'

const MESSAGES: Record<string, { title: string; body: string }> = {
  publish: {
    title: '小红书未登录',
    body: '发布前需要登录小红书，点击此处前往登录'
  },
  sync: {
    title: '小红书登录已过期',
    body: '物料同步正常，但自动发布需要登录小红书'
  },
  startup: {
    title: '请登录小红书',
    body: '登录小红书后即可使用自动发布功能'
  }
}

function navigateToPlatforms(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    win.show()
    win.focus()
    win.webContents.send('navigate', '/platforms')
  }
}

class LoginGuard {
  async ensureLoggedIn(context: 'publish' | 'sync' | 'startup'): Promise<boolean> {
    try {
      const status = await loginService.checkLoginStatus()
      if (status.loggedIn) return true
    } catch {
      // checkLoginStatus failed, treat as not logged in
    }

    const msg = MESSAGES[context] || MESSAGES.startup
    notifyUser(msg.title, msg.body, navigateToPlatforms)

    // Also notify renderer if window is visible
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('xhs:login-required')
    }

    console.log(`[LoginGuard] ${context}: 用户未登录小红书`)
    return false
  }
}

export const loginGuard = new LoginGuard()
