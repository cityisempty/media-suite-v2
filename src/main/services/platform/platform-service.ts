import { LocalStore } from '../../db/local-store'
import type { PlatformAccount } from '../../../../packages/shared/src/types'
import { join } from 'node:path'
import { getDataDir } from '../../utils/paths'

/**
 * 平台服务
 * 管理多个社交媒体平台账号
 */
export class PlatformService {
  private store: LocalStore<PlatformAccount[]>

  constructor() {
    const dataPath = join(getDataDir(), 'platforms.json')
    this.store = new LocalStore<PlatformAccount[]>(dataPath)
  }

  /**
   * 获取所有平台账号
   */
  async listAccounts(): Promise<PlatformAccount[]> {
    return this.store.read() || []
  }

  /**
   * 获取单个平台账号
   */
  async getAccount(id: string): Promise<PlatformAccount | null> {
    const accounts = this.store.read() || []
    return accounts.find(a => a.id === id) || null
  }

  /**
   * 按平台类型获取账号
   */
  async getAccountsByPlatform(platform: string): Promise<PlatformAccount[]> {
    const accounts = this.store.read() || []
    return accounts.filter(a => a.platform === platform)
  }

  /**
   * 添加平台账号
   */
  async addAccount(data: Omit<PlatformAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformAccount> {
    const account: PlatformAccount = {
      id: `platform-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const accounts = this.store.read() || []
    accounts.push(account)
    this.store.write(accounts)

    return account
  }

  /**
   * 更新平台账号
   */
  async updateAccount(
    id: string,
    data: Partial<Omit<PlatformAccount, 'id' | 'createdAt'>>
  ): Promise<PlatformAccount> {
    const accounts = this.store.read() || []
    const index = accounts.findIndex(a => a.id === id)

    if (index === -1) {
      throw new Error('平台账号不存在')
    }

    accounts[index] = {
      ...accounts[index],
      ...data,
      updatedAt: Date.now()
    }

    this.store.write(accounts)
    return accounts[index]
  }

  /**
   * 删除平台账号
   */
  async deleteAccount(id: string): Promise<void> {
    const accounts = this.store.read() || []
    const filtered = accounts.filter(a => a.id !== id)

    if (filtered.length === accounts.length) {
      throw new Error('平台账号不存在')
    }

    this.store.write(filtered)
  }

  /**
   * 更新账号状态
   */
  async updateAccountStatus(id: string, status: PlatformAccount['status']): Promise<PlatformAccount> {
    return await this.updateAccount(id, { status })
  }

  /**
   * 刷新账号 Token
   */
  async refreshAccountToken(id: string, credentials: any): Promise<PlatformAccount> {
    return await this.updateAccount(id, {
      credentials,
      status: 'connected'
    })
  }

  /**
   * 获取已连接的账号
   */
  async getConnectedAccounts(): Promise<PlatformAccount[]> {
    const accounts = this.store.read() || []
    return accounts.filter(a => a.status === 'connected')
  }

  /**
   * 获取需要重新授权的账号
   */
  async getExpiredAccounts(): Promise<PlatformAccount[]> {
    const accounts = this.store.read() || []
    return accounts.filter(a => a.status === 'expired')
  }

  /**
   * 获取当前激活的平台账号
   */
  async getActivePlatform(): Promise<PlatformAccount | null> {
    const accounts = this.store.read() || []
    // 返回第一个已连接的账号
    return accounts.find(a => a.status === 'connected') || null
  }

  /**
   * 同步小红书登录状态
   * 从 cookies.json 读取登录信息并更新平台账号
   */
  async syncXiaohongshuLogin(): Promise<void> {
    const { LoginService } = await import('../mcp/login-service')
    const { readFile } = await import('node:fs/promises')
    const loginService = new LoginService()
    const loginStatus = await loginService.checkLoginStatus()

    const accounts = this.store.read() || []
    const xhsAccount = accounts.find(a => a.platform === 'xiaohongshu')

    if (!loginStatus.loggedIn) {
      if (xhsAccount) {
        await this.updateAccount(xhsAccount.id, {
          status: 'disconnected'
        })
      }
      return
    }

    const cookiesPath = join(getDataDir(), 'cookies.json')
    let sessionUserId = ''
    let accountName = xhsAccount?.accountName || '小红书账号'
    let profileUserId = (xhsAccount?.metadata?.profileUserId as string | undefined) || ''

    try {
      const cookiesContent = await readFile(cookiesPath, 'utf-8')
      const cookies = JSON.parse(cookiesContent)
      sessionUserId = this.extractSessionUserIdFromCookies(cookies)
      if (sessionUserId) {
        console.log('[PlatformService] 提取到 sessionUserId:', sessionUserId)
      }
    } catch (error) {
      console.log('[PlatformService] 读取 cookies 失败:', error)
    }

    // 尝试验证 profileUserId（只有验证通过才用于分析）
    try {
      const { mcpServiceManager } = await import('../mcp/mcp-service-manager')
      const client = await mcpServiceManager.getClient()
      const feedsResult = await client.callTool('list_feeds', {})
      const feedsText = typeof feedsResult.content === 'string'
        ? feedsResult.content
        : feedsResult.content?.find((c: any) => c.type === 'text')?.text || ''

      const feedsData = JSON.parse(feedsText)
      const currentUser = feedsData?.currentUser
      if (currentUser?.nickname) {
        accountName = currentUser.nickname
      }

      const candidateUserId = sessionUserId || currentUser?.userId || currentUser?.id
      const xsecTokens: string[] = (feedsData?.feeds || [])
        .map((f: any) => f?.xsecToken)
        .filter((t: any) => !!t)
        .slice(0, 6)

      if (candidateUserId && xsecTokens.length > 0) {
        for (const token of xsecTokens) {
          try {
            const profileResult = await client.callTool('user_profile', {
              user_id: candidateUserId,
              xsec_token: token
            })
            const profileText = typeof profileResult.content === 'string'
              ? profileResult.content
              : profileResult.content?.find((c: any) => c.type === 'text')?.text || ''
            const profileData = JSON.parse(profileText)
            if (this.isValidProfilePayload(profileData)) {
              profileUserId = candidateUserId
              console.log('[PlatformService] 验证到可用 profileUserId:', profileUserId)
              break
            }
          } catch {
            // continue trying next token
          }
        }
      }
    } catch (error) {
      console.log('[PlatformService] 验证 profileUserId 失败:', error)
    }

    const resolvedProfileUserId = sessionUserId || profileUserId || ''

    const mergedMetadata = {
      ...(xhsAccount?.metadata || {}),
      sessionUserId,
      profileUserId: resolvedProfileUserId
    }

    if (xhsAccount) {
      await this.updateAccount(xhsAccount.id, {
        accountName,
        accountId: resolvedProfileUserId || xhsAccount.accountId || '',
        status: 'connected',
        credentials: { cookiesPath },
        metadata: mergedMetadata
      })
    } else {
      await this.addAccount({
        platform: 'xiaohongshu',
        accountName,
        accountId: resolvedProfileUserId,
        status: 'connected',
        credentials: { cookiesPath },
        metadata: mergedMetadata
      })
    }
  }

  private extractSessionUserIdFromCookies(cookies: any[]): string {
    const unreadCookie = cookies.find((c: any) => c.name === 'unread')
    if (unreadCookie?.value) {
      try {
        const unreadData = JSON.parse(decodeURIComponent(unreadCookie.value))
        if (unreadData?.ub) {
          return unreadData.ub
        }
      } catch {
        // ignore
      }
    }

    const webIdCookie = cookies.find((c: any) => c.name === 'webId')
    return webIdCookie?.value || ''
  }

  private isValidProfilePayload(profileData: any): boolean {
    if (!profileData || typeof profileData !== 'object') return false
    const nickname = profileData?.userBasicInfo?.nickname || ''
    const interactions = profileData?.interactions
    const feeds = profileData?.feeds

    const hasNickname = typeof nickname === 'string' && nickname.trim().length > 0
    const hasInteractions = Array.isArray(interactions) && interactions.length > 0
    const hasFeeds = Array.isArray(feeds) && feeds.length > 0

    return hasNickname || hasInteractions || hasFeeds
  }
}

// 单例
export const platformService = new PlatformService()
