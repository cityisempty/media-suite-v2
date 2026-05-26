import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'

interface StoredSession {
  sessionToken: string
}

/**
 * 认证存储服务
 * - sessionToken：永久凭证，持久化到本地文件
 * - accessToken：短期令牌，仅存储在内存中
 */
export class AuthStorage {
  private sessionPath: string
  private accessToken: string | null = null
  private accessTokenExpiresAt: number = 0

  constructor() {
    this.sessionPath = join(app.getPath('userData'), '.auth-session.json')
  }

  // ==================== Session Token（持久化） ====================

  getSessionToken(): string | null {
    try {
      if (!existsSync(this.sessionPath)) return null
      const content = readFileSync(this.sessionPath, 'utf8')
      const data: StoredSession = JSON.parse(content)
      return data.sessionToken ?? null
    } catch {
      return null
    }
  }

  saveSessionToken(token: string): void {
    const data: StoredSession = { sessionToken: token }
    writeFileSync(this.sessionPath, JSON.stringify(data), 'utf8')
  }

  clearSessionToken(): void {
    if (existsSync(this.sessionPath)) {
      unlinkSync(this.sessionPath)
    }
  }

  // ==================== Access Token（内存缓存） ====================

  getAccessToken(): string | null {
    // 提前 60 秒视为过期
    if (this.accessToken && Date.now() >= this.accessTokenExpiresAt - 60_000) {
      return null
    }
    return this.accessToken
  }

  getRawAccessToken(): string | null {
    return this.accessToken
  }

  saveAccessToken(token: string, expiresIn: number): void {
    this.accessToken = token
    this.accessTokenExpiresAt = Date.now() + expiresIn * 1000
  }

  clearAccessToken(): void {
    this.accessToken = null
    this.accessTokenExpiresAt = 0
  }

  isAccessTokenExpired(): boolean {
    if (!this.accessToken) return true
    return Date.now() >= this.accessTokenExpiresAt - 60_000
  }

  getAccessTokenExpiresAt(): number {
    return this.accessTokenExpiresAt
  }

  // ==================== 组合操作 ====================

  saveSession(sessionToken: string, accessToken: string, expiresIn: number): void {
    this.saveSessionToken(sessionToken)
    this.saveAccessToken(accessToken, expiresIn)
  }

  clearAll(): void {
    this.clearSessionToken()
    this.clearAccessToken()
  }

  hasSession(): boolean {
    return this.getSessionToken() !== null
  }
}

export const authStorage = new AuthStorage()
