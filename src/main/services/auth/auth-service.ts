import { BrowserWindow } from 'electron'
import { hostname } from 'node:os'
import { apiClient } from '../server'
import { authStorage } from './auth-storage'
import { TEST_ACCOUNT } from '../../../../packages/shared/src/constants'
import type { AppUser, AuthResult } from '../../../../packages/shared/src/types'
import { serverConfig } from '../server/server-config'
import { log } from '../../utils/logger'

/**
 * 认证服务（双 Token 机制）
 * - sessionToken：永久凭证，加密存储在本地
 * - accessToken：短期令牌（60分钟），内存缓存
 */
export class AuthService {
  private currentUser: AppUser | null = null
  private refreshTimer: NodeJS.Timeout | null = null

  constructor() {
    // 注入 token getter（accessToken，内存）
    if ('setTokenGetter' in apiClient && typeof apiClient.setTokenGetter === 'function') {
      apiClient.setTokenGetter(() => this.getAccessToken())
    }

    // 注入 session token getter
    if ('setSessionTokenGetter' in apiClient && typeof apiClient.setSessionTokenGetter === 'function') {
      apiClient.setSessionTokenGetter(() => authStorage.getSessionToken())
    }

    // 注入 token 刷新处理器
    if ('setRefreshHandler' in apiClient && typeof apiClient.setRefreshHandler === 'function') {
      apiClient.setRefreshHandler(() => this.doRefresh())
    }

    // 注入强制登出处理器
    if ('setForceLogoutHandler' in apiClient && typeof apiClient.setForceLogoutHandler === 'function') {
      apiClient.setForceLogoutHandler(() => this.handleForceLogout())
    }
  }

  /**
   * 初始化：使用 sessionToken 验证并恢复登录状态
   */
  async initialize(): Promise<AppUser | null> {
    const sessionToken = authStorage.getSessionToken()
    log.info(`[AuthService] initialize: sessionToken=${sessionToken ? 'exists (' + sessionToken.substring(0, 20) + '...)' : 'null'}`)

    if (!sessionToken) {
      log.info('[AuthService] initialize: 无 sessionToken，跳过自动登录')
      return null
    }

    // Mock 模式下测试账号直接登录
    if (serverConfig.useMock && sessionToken === TEST_ACCOUNT.TOKEN) {
      this.currentUser = TEST_ACCOUNT.USER as AppUser
      log.info('[AuthService] 使用测试账号登录（Mock 模式）')
      return this.currentUser
    }

    // 真实后端：使用 sessionToken 验证
    try {
      log.info('[AuthService] initialize: 调用 verifySession...')
      const result = await apiClient.verifySession(sessionToken)
      log.info('[AuthService] initialize: verifySession 结果:', result.valid ? 'valid' : 'invalid')

      if (result.valid && result.user) {
        this.currentUser = result.user

        // 刷新 accessToken（失败不阻塞登录）
        try {
          await this.refreshAccessToken()
          log.info('[AuthService] initialize: accessToken 刷新成功')
        } catch (refreshError: any) {
          log.error('[AuthService] initialize: accessToken 刷新失败:', refreshError.message)
        }

        this.startRefreshTimer()
        log.info('[AuthService] Session 验证成功，自动登录:', this.currentUser?.nickname || this.currentUser?.phone || 'unknown')
        this.fetchPersonaAfterLogin()
        return this.currentUser
      }

      log.info('[AuthService] initialize: verifySession 返回 valid=false，清除 session')
    } catch (error: any) {
      log.error('[AuthService] initialize: verifySession 异常:', error.message)
    }

    // Session 无效，清除本地数据
    authStorage.clearAll()
    this.currentUser = null
    return null
  }

  async loginWithEmail(email: string, code: string): Promise<AuthResult> {
    const result = await apiClient.loginByEmail(email, code, this.getDeviceName(), 'desktop')

    log.info('[AuthService] loginWithEmail: 保存 session...')
    log.info('[AuthService] sessionToken:', result.tokens.sessionToken ? result.tokens.sessionToken.substring(0, 20) + '...' : 'MISSING')
    log.info('[AuthService] accessToken:', result.tokens.accessToken ? result.tokens.accessToken.substring(0, 20) + '...' : 'MISSING')
    log.info('[AuthService] expiresIn:', result.tokens.expiresIn)

    authStorage.saveSession(
      result.tokens.sessionToken,
      result.tokens.accessToken,
      result.tokens.expiresIn
    )

    // 验证是否保存成功
    const savedToken = authStorage.getSessionToken()
    log.info('[AuthService] loginWithEmail: 保存后验证 sessionToken:', savedToken ? 'OK (' + savedToken.substring(0, 20) + '...)' : 'FAILED')

    this.currentUser = result.user
    this.startRefreshTimer()
    this.fetchPersonaAfterLogin()

    return result
  }

  async loginWithWechat(code: string): Promise<AuthResult> {
    const result = await apiClient.loginByWechat(code, this.getDeviceName(), 'desktop')

    authStorage.saveSession(
      result.tokens.sessionToken,
      result.tokens.accessToken,
      result.tokens.expiresIn
    )

    this.currentUser = result.user
    this.startRefreshTimer()
    this.fetchPersonaAfterLogin()

    return result
  }

  private getDeviceName(): string {
    return hostname() || 'Electron Client'
  }

  private async fetchPersonaAfterLogin(): Promise<void> {
    try {
      const { personaService } = await import('../persona/persona-service')
      const persona = await personaService.getActivePersona()
      if (persona?.subscription) {
        log.info(`[AuthService] 订阅配额: 每日 ${persona.subscription.dailyQuota} 个`)
      } else {
        log.info('[AuthService] 未获取到订阅信息，使用默认配额')
      }
    } catch (error) {
      log.error('[AuthService] 获取人设信息失败:', error)
    }
  }

  /**
   * 刷新 accessToken（使用 sessionToken）
   */
  private async refreshAccessToken(): Promise<void> {
    const result = await apiClient.refreshToken()
    authStorage.saveAccessToken(result.tokens.accessToken, result.tokens.expiresIn)
    if (result.user) {
      this.currentUser = result.user
    }
  }

  /**
   * 执行 Token 刷新（供 RealApiClient 401 重试调用）
   * 返回新的 accessToken
   */
  async doRefresh(): Promise<string> {
    const sessionToken = authStorage.getSessionToken()
    if (!sessionToken) {
      throw new Error('No session token available')
    }

    const result = await apiClient.refreshToken()

    authStorage.saveAccessToken(result.tokens.accessToken, result.tokens.expiresIn)
    if (result.user) {
      this.currentUser = result.user
    }
    this.startRefreshTimer()

    return result.tokens.accessToken
  }

  /**
   * 处理强制登出（Session 失效或其他不可恢复的认证失败）
   */
  private handleForceLogout(): void {
    log.info('[AuthService] 强制登出（Session 失效）')
    authStorage.clearAll()
    this.currentUser = null
    this.stopRefreshTimer()

    try {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      mainWindow?.webContents.send('auth:force-logout')
    } catch (error) {
      log.error('[AuthService] 通知渲染进程失败:', error)
    }
  }

  async sendEmailCode(email: string): Promise<void> {
    await apiClient.sendEmailCode(email)
  }

  async logout(): Promise<void> {
    try {
      if (this.currentUser?.id !== TEST_ACCOUNT.USER.id) {
        const sessionToken = authStorage.getSessionToken()
        await apiClient.logout(sessionToken ?? undefined)
      }
    } catch (error) {
      log.error('Logout API call failed:', error)
    }

    authStorage.clearAll()
    this.currentUser = null
    this.stopRefreshTimer()
  }

  getCurrentUser(): AppUser | null {
    return this.currentUser
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null
  }

  /**
   * 启动自动刷新定时器
   * 在 accessToken 过期前 60 秒刷新
   */
  private startRefreshTimer(): void {
    this.stopRefreshTimer()

    if (!authStorage.hasSession()) return

    // 测试账号不需要刷新
    const rawToken = authStorage.getRawAccessToken()
    if (rawToken === TEST_ACCOUNT.TOKEN) return

    const expiresAt = authStorage.getAccessTokenExpiresAt()
    if (!expiresAt) return

    const timeUntilExpiry = expiresAt - Date.now()
    const refreshTime = Math.max(timeUntilExpiry - 60_000, 30_000)

    try { log.info(`[AuthService] 将在 ${Math.round(refreshTime / 1000)} 秒后刷新 accessToken`) } catch {}

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken()
        this.startRefreshTimer()
      } catch (error) {
        try { log.error('[AuthService] 定时刷新 accessToken 失败:', error) } catch {}
        this.refreshTimer = setTimeout(() => this.startRefreshTimer(), 60_000)
      }
    }, refreshTime)
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * 获取当前 Access Token（内存缓存，过期自动返回 null）
   */
  getAccessToken(): string | null {
    return authStorage.getAccessToken()
  }
}

export const authService = new AuthService()
