import { spawn, ChildProcess } from 'node:child_process'
import { resolvePlatformBinary, getDataDir } from '../../utils/paths'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadJson, removeFile, ensureDir } from '../../utils/file-utils'
import { log } from '../../utils/logger'

export interface LoginStatus {
  loggedIn: boolean
  expiresAt?: number
}

export interface QRCodeData {
  qrCode: string // base64 编码的二维码图片
  url: string // 登录链接
}

/**
 * 小红书登录服务
 */
export class LoginService {
  private process: ChildProcess | null = null

  /**
   * 获取登录二维码
   * 使用 MCP 的 get_login_qrcode 工具获取二维码
   */
  async getLoginQRCode(): Promise<QRCodeData> {
    try {
      const { mcpServiceManager } = await import('./mcp-service-manager')
      const client = await mcpServiceManager.getClient()
      const result = await client.callTool('get_login_qrcode', {})

      log.info('[LoginService] MCP 返回的二维码数据:', JSON.stringify(result, null, 2))

      if (result.content) {
        // 查找文本内容（包含 URL）
        const textContent = result.content.find((c: any) => c.type === 'text')
        // 查找图片内容（二维码）
        const imageContent = result.content.find((c: any) => c.type === 'image')

        log.info('[LoginService] 文本内容:', textContent)
        log.info('[LoginService] 图片内容:', imageContent ? '存在' : '不存在')

        // 如果返回"已登录"，抛出特殊错误，让前端知道用户已登录
        if (textContent && textContent.text.includes('已处于登录状态')) {
          throw new Error('ALREADY_LOGGED_IN')
        }

        if (textContent && imageContent) {
          // 从文本中提取 URL
          const urlMatch = textContent.text.match(/https?:\/\/[^\s]+/)
          const url = urlMatch ? urlMatch[0] : ''

          return {
            qrCode: imageContent.data, // base64 编码的图片
            url
          }
        }
      }

      throw new Error('无法获取二维码')
    } catch (error) {
      log.error('[LoginService] 获取二维码失败:', error)
      throw error
    }
  }

  /**
   * 轮询检查登录状态
   * 用于二维码登录后检测是否登录成功
   */
  async pollLoginStatus(maxAttempts = 60, interval = 2000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.checkLoginStatus()
      if (status.loggedIn) {
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    return false
  }

  /**
   * 启动扫码登录
   * 二进制会弹出浏览器窗口让用户扫码，登录成功后进程退出
   */
  async startLogin(): Promise<{ message: string }> {
    const binaryPath = resolvePlatformBinary('xiaohongshu-login')
    const profileDir = join(getDataDir(), 'profiles', 'mcp-xhs')
    ensureDir(profileDir)

    return new Promise((resolve, reject) => {
      this.process = spawn(binaryPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: getDataDir(),
        env: {
          ...process.env,
          XHS_DATA_DIR: profileDir
        }
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        log.info(`[Login stdout] ${data.toString().trim()}`)
      })
      this.process.stderr?.on('data', (data: Buffer) => {
        log.info(`[Login stderr] ${data.toString().trim()}`)
      })

      this.process.on('close', (code) => {
        this.process = null
        if (code === 0) {
          resolve({ message: '登录成功' })
        } else {
          reject(new Error(`登录进程退出 (code: ${code})`))
        }
      })

      this.process.on('error', (err) => {
        this.process = null
        reject(err)
      })
    })
  }

  /**
   * 检查登录状态
   * 登录成功的判定标准：Cookie 文件存在且有效
   */
  async checkLoginStatus(): Promise<LoginStatus> {
    const cookiePath = join(getDataDir(), 'cookies.json')

    // 首要判断：Cookie 文件是否存在
    if (!existsSync(cookiePath)) {
      return { loggedIn: false }
    }

    try {
      // 检查 cookie 文件是否有效
      const cookies = loadJson<any[]>(cookiePath)
      const sessionCookie = cookies.find((c) => c.name === 'web_session')

      // 只要 Cookie 存在且未过期，就认为已登录
      if (sessionCookie && sessionCookie.expires * 1000 > Date.now()) {
        log.info('[LoginService] ✅ Cookie 有效，已登录')
        return { loggedIn: true, expiresAt: sessionCookie.expires }
      }

      log.info('[LoginService] ⚠️ Cookie 已过期或无效')
      return { loggedIn: false }
    } catch (error) {
      log.error('[LoginService] 检查登录状态失败:', error)
      return { loggedIn: false }
    }
  }

  /**
   * 清除登录态
   */
  async clearLogin(): Promise<void> {
    const cookiePath = join(getDataDir(), 'cookies.json')
    removeFile(cookiePath)
  }
}

export const loginService = new LoginService()
