import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { ensureDir } from '../../utils/file-utils'

/**
 * Token 安全存储
 * macOS: 使用 keychain (TODO: 未来优化)
 * 当前: 加密存储到本地文件
 */
export class TokenStore {
  private tokenPath: string

  constructor() {
    const dataDir = app.getPath('userData')
    this.tokenPath = join(dataDir, '.auth-tokens')
  }

  /**
   * 保存 Token
   */
  save(accessToken: string, refreshToken: string, expiresAt: number): void {
    ensureDir(app.getPath('userData'))
    const data = {
      accessToken,
      refreshToken,
      expiresAt
    }
    // TODO: 加密存储
    writeFileSync(this.tokenPath, JSON.stringify(data), 'utf8')
  }

  /**
   * 读取 Token
   */
  read(): { accessToken: string; refreshToken: string; expiresAt: number } | null {
    if (!existsSync(this.tokenPath)) {
      return null
    }
    try {
      const content = readFileSync(this.tokenPath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * 清除 Token
   */
  clear(): void {
    if (existsSync(this.tokenPath)) {
      unlinkSync(this.tokenPath)
    }
  }

  /**
   * 检查 Token 是否过期（基于 JWT exp 字段）
   */
  isExpired(): boolean {
    const tokens = this.read()
    if (!tokens) return true
    const expMs = this.getJwtExpMs(tokens.accessToken)
    if (expMs) {
      return Date.now() >= expMs
    }
    return Date.now() >= tokens.expiresAt
  }

  /**
   * 检查 Access Token 是否即将过期（提前 60 秒）
   */
  isAccessTokenExpiredSoon(): boolean {
    const tokens = this.read()
    if (!tokens) return true
    const expMs = this.getJwtExpMs(tokens.accessToken)
    if (expMs) {
      return Date.now() >= expMs - 60 * 1000
    }
    return Date.now() >= tokens.expiresAt - 60 * 1000
  }

  /**
   * 从 JWT 中解析 exp 字段（毫秒）
   */
  private getJwtExpMs(accessToken: string): number | null {
    try {
      const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString())
      return payload.exp ? payload.exp * 1000 : null
    } catch {
      return null
    }
  }
}
