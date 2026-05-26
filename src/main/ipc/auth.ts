import { ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { authService } from '../services/auth/auth-service'
import { authStorage } from '../services/auth/auth-storage'
import { apiClient } from '../services/server'
import { serverConfig, saveServerUrl } from '../services/server/server-config'

/**
 * 注册认证相关的 IPC Handler
 */
export function registerAuthHandlers(): void {
  // 邮箱登录
  ipcMain.handle('auth:login-email', async (_event, email: string, code: string) => {
    try {
      console.log('[IPC] auth:login-email 开始:', { email, code })
      const result = await authService.loginWithEmail(email, code)
      console.log('[IPC] auth:login-email 成功:', result)
      return { success: true, user: result.user, hasPersona: result.hasPersona }
    } catch (error: any) {
      console.error('[IPC] auth:login-email 失败:', error)
      console.error('[IPC] 错误堆栈:', error.stack)
      return { success: false, error: error.message || '登录失败' }
    }
  })

  // 发送邮件验证码
  ipcMain.handle('auth:send-email-code', async (_event, email: string) => {
    try {
      await authService.sendEmailCode(email)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '发送失败' }
    }
  })

  // 微信登录
  ipcMain.handle('auth:login-wechat', async (_event, code: string) => {
    try {
      const result = await authService.loginWithWechat(code)
      return { success: true, user: result.user, hasPersona: result.hasPersona }
    } catch (error: any) {
      return { success: false, error: error.message || '登录失败' }
    }
  })

  // 登出
  ipcMain.handle('auth:logout', async () => {
    try {
      await authService.logout()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取当前用户
  ipcMain.handle('auth:get-current-user', async () => {
    return await authService.getCurrentUser()
  })

  // 获取 Access Token
  ipcMain.handle('auth:get-token', async () => {
    return authService.getAccessToken()
  })

  ipcMain.handle('app:get-server-url', () => {
    return serverConfig.baseUrl
  })

  ipcMain.handle('app:set-server-url', (_e, url: string) => {
    saveServerUrl(url)
  })

  ipcMain.handle('app:get-version', () => {
    return require('electron').app.getVersion()
  })

  // 刷新 Token
  ipcMain.handle('auth:refresh-token', async () => {
    try {
      await authService.doRefresh()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || '刷新失败' }
    }
  })

  // 更新个人资料
  ipcMain.handle('auth:update-profile', async (_event, data: { nickname?: string }) => {
    try {
      const token = authService.getAccessToken()
      const response = await fetch(`${serverConfig.baseUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ nickname: data.nickname })
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }))
        throw new Error(error.message || `HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 上传头像
  ipcMain.handle('auth:upload-avatar', async (_event, filePath: string) => {
    try {
      const token = authService.getAccessToken()
      const fileData = await readFile(filePath)
      const fileName = basename(filePath)
      const ext = fileName.split('.').pop()?.toLowerCase() || 'png'
      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp'
      }
      const blob = new Blob([fileData], { type: mimeTypes[ext] || 'image/png' })

      const formData = new FormData()
      formData.append('avatar', blob, fileName)

      const response = await fetch(`${serverConfig.baseUrl}/auth/avatar`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }))
        throw new Error(error.message || `HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
