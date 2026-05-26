import type { IApiClient } from './api-client'
import type {
  AuthResult,
  SessionVerifyResult,
  Persona,
  Content,
  ContentFilter,
  PaginatedResult,
  AnalyticsData,
  AnalyticsOverview,
  PlatformAccount,
  PlatformType,
  DateRange,
  AppUser
} from '../../../../packages/shared/src/types'
import { serverConfig } from './server-config'
import { app } from 'electron'
import { log } from '../../utils/logger'

// 仅开发环境跳过 SSL 证书验证（自签名证书等）
if (!app.isPackaged) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

/**
 * 真实 API 客户端 - 连接到 Laravel 后端
 */
export class RealApiClient implements IApiClient {
  private tokenGetter: (() => string | null) | null = null
  private sessionTokenGetter: (() => string | null) | null = null
  private refreshHandler: (() => Promise<string>) | null = null
  private forceLogoutHandler: (() => void) | null = null
  private isRefreshing = false
  private failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = []

  /**
   * 设置 token 获取函数（由外部注入，避免循环依赖）
   */
  setTokenGetter(getter: () => string | null): void {
    this.tokenGetter = getter
  }

  /**
   * 设置 session token 获取函数
   */
  setSessionTokenGetter(getter: () => string | null): void {
    this.sessionTokenGetter = getter
  }

  /**
   * 设置 token 刷新函数（由 AuthService 注入）
   */
  setRefreshHandler(handler: () => Promise<string>): void {
    this.refreshHandler = handler
  }

  /**
   * 设置强制登出回调
   */
  setForceLogoutHandler(handler: () => void): void {
    this.forceLogoutHandler = handler
  }

  /**
   * 获取当前 token
   */
  private getToken(): string | null {
    if (this.tokenGetter) {
      return this.tokenGetter()
    }
    return null
  }

  /**
   * 处理等待队列
   */
  private processQueue(error: any, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error || !token) {
        reject(error)
      } else {
        resolve(token)
      }
    })
    this.failedQueue = []
  }

  /**
   * 发起 HTTP 请求（带 401 自动重试）
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${serverConfig.baseUrl}${endpoint}`

    const makeRequest = async (token: string | null): Promise<T> => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, { ...options, headers })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        const error: any = new Error(errorData.message || `HTTP ${response.status}`)
        error.status = response.status
        error.data = errorData
        throw error
      }

      return response.json()
    }

    // 如果正在刷新中，将请求加入队列等待
    if (this.isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        this.failedQueue.push({ resolve, reject })
      }).then((newToken) => makeRequest(newToken))
    }

    const token = this.getToken()

    try {
      return await makeRequest(token)
    } catch (error: any) {
      // 非 401 错误直接抛出
      if (error.status !== 401) {
        throw error
      }

      // 没有刷新处理器，直接抛出
      if (!this.refreshHandler) {
        this.forceLogoutHandler?.()
        throw error
      }

      // 检查是否是 refresh_token_expired
      if (error.data?.message === 'refresh_token_expired') {
        log.info('[RealApiClient] Refresh Token 已过期，强制登出')
        this.forceLogoutHandler?.()
        throw error
      }

      // 开始刷新
      log.info('[RealApiClient] 检测到 401，正在刷新 Token...')
      this.isRefreshing = true

      try {
        const newToken = await this.refreshHandler()
        this.processQueue(null, newToken)
        log.info('[RealApiClient] Token 刷新成功，重试请求')
        return await makeRequest(newToken)
      } catch (refreshError: any) {
        this.processQueue(refreshError, null)
        log.error('[RealApiClient] Token 刷新失败:', refreshError.message)
        this.forceLogoutHandler?.()
        throw error
      } finally {
        this.isRefreshing = false
      }
    }
  }

  // === 认证 ===
  async loginByWechat(code: string, deviceName?: string, deviceType?: string): Promise<AuthResult> {
    const body: Record<string, string> = { code }
    if (deviceName) body.device_name = deviceName
    if (deviceType) body.device_type = deviceType

    const response = await this.request<{
      user: AppUser
      tokens: { sessionToken: string; accessToken: string; expiresIn: number }
      has_persona: boolean
    }>('/auth/login/wechat', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    return {
      user: response.user,
      tokens: {
        sessionToken: response.tokens.sessionToken,
        accessToken: response.tokens.accessToken,
        refreshToken: '',
        expiresAt: Date.now() + response.tokens.expiresIn * 1000,
        expiresIn: response.tokens.expiresIn
      },
      hasPersona: response.has_persona
    }
  }

  async loginByEmail(email: string, code: string, deviceName?: string, deviceType?: string): Promise<AuthResult> {
    const body: Record<string, string> = { email, code }
    if (deviceName) body.device_name = deviceName
    if (deviceType) body.device_type = deviceType

    const response = await this.request<{
      user: AppUser
      tokens: { sessionToken: string; accessToken: string; expiresIn: number }
      has_persona: boolean
    }>('/auth/login/email', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    return {
      user: response.user,
      tokens: {
        sessionToken: response.tokens.sessionToken,
        accessToken: response.tokens.accessToken,
        refreshToken: '',
        expiresAt: Date.now() + response.tokens.expiresIn * 1000,
        expiresIn: response.tokens.expiresIn
      },
      hasPersona: response.has_persona
    }
  }

  async sendEmailCode(email: string): Promise<void> {
    await this.request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
  }

  async verifyToken(_token: string): Promise<{ valid: boolean; user?: AppUser }> {
    try {
      const response = await this.request<{ valid: boolean; user?: AppUser }>('/auth/verify', {
        method: 'POST'
      })
      return response
    } catch {
      return { valid: false }
    }
  }

  async verifySession(sessionToken: string): Promise<SessionVerifyResult> {
    try {
      const response = await this.request<{ valid: boolean; user?: AppUser }>('/auth/verify-session', {
        method: 'POST',
        body: JSON.stringify({ session_token: sessionToken })
      })
      return response
    } catch {
      return { valid: false }
    }
  }

  async refreshToken(): Promise<AuthResult> {
    const sessionToken = this.sessionTokenGetter?.()
    if (!sessionToken) {
      throw new Error('No session token available for refresh')
    }

    // 不走 this.request()，避免 401 → refreshHandler → refreshToken 递归
    const response = await fetch(`${serverConfig.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    const data = await response.json() as { accessToken: string; expiresIn: number; user: AppUser }

    return {
      user: data.user,
      tokens: {
        sessionToken,
        accessToken: data.accessToken,
        refreshToken: '',
        expiresAt: Date.now() + data.expiresIn * 1000,
        expiresIn: data.expiresIn
      },
      hasPersona: false
    }
  }

  async logout(sessionToken?: string): Promise<void> {
    const token = sessionToken ?? this.sessionTokenGetter?.()
    if (token) {
      try {
        // 不走 this.request()，避免过期 token 触发 401 刷新递归
        await fetch(`${serverConfig.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ session_token: token })
        })
      } catch {
        // logout API 失败不应阻止本地清理
      }
    }
  }

  // === 人设 ===
  async getPersona(): Promise<Persona | null> {
    try {
      const response = await this.request<{ data: { persona: any; subscription?: any } }>('/personas')
      const data = response.data
      if (!data?.persona) {
        return null
      }

      const persona = this.formatPersonaFromApi(data.persona)

      if (data.subscription) {
        persona.subscription = this.formatSubscriptionFromApi(data.subscription)
      }

      return persona
    } catch {
      return null
    }
  }

  async savePersona(persona: Omit<Persona, 'id' | 'userId' | 'serverGenerated' | 'updatedAt' | 'syncedAt'>): Promise<Persona> {
    // 转换 camelCase 为 snake_case
    const requestData = {
      personality: persona.personality,
      age: persona.age,
      language_style: persona.languageStyle,
      gender: persona.gender || 'other',
      expertise_fields: persona.expertiseFields,
      creative_fields: persona.creativeFields,
      publish_schedule: {
        timeSlots: persona.publishSchedule.timeSlots,
        frequency: persona.publishSchedule.frequency,
        style: persona.publishSchedule.style
      }
    }

    log.info('[RealApiClient] savePersona 请求数据:', requestData)

    const response = await this.request<{ persona: any }>('/personas', {
      method: 'POST',
      body: JSON.stringify(requestData)
    })

    log.info('[RealApiClient] savePersona 响应:', response)

    return this.formatPersonaFromApi(response.persona)
  }

  async getPersonaStrategy(): Promise<Persona['serverGenerated']> {
    const response = await this.request<{ strategy: any }>('/personas/strategy')
    return response.strategy
  }

  /**
   * 格式化 API 返回的人设数据（兼容 snake_case 和 camelCase）
   */
  private formatPersonaFromApi(data: any): Persona {
    return {
      id: data.id?.toString() || '',
      userId: data.user_id?.toString() || data.userId?.toString() || '',
      personality: data.personality || '',
      age: data.age || 30,
      languageStyle: data.language_style || data.languageStyle || '',
      gender: data.gender || 'unknown',
      expertiseFields: data.expertise_fields || data.expertiseFields || [],
      creativeFields: data.creative_fields || data.creativeFields || [],
      publishSchedule: {
        timeSlots: data.publish_schedule?.timeSlots || data.publish_schedule?.time_slots || [],
        frequency: data.publish_schedule?.frequency || 1,
        style: data.publish_schedule?.style || ''
      },
      isActive: true,
      serverGenerated: data.server_generated || data.serverGenerated,
      updatedAt: data.updated_at || data.updatedAt || new Date().toISOString(),
      syncedAt: data.synced_at || data.syncedAt
    }
  }

  /**
   * 格式化 API 返回的订阅数据（snake_case -> camelCase）
   */
  private formatSubscriptionFromApi(data: any): Subscription {
    return {
      id: data.id?.toString() || '',
      userId: data.user_id?.toString() || data.userId?.toString() || '',
      planId: data.plan_id?.toString() || data.planId?.toString() || '',
      status: data.status || 'inactive',
      startsAt: data.starts_at || data.startsAt || '',
      endsAt: data.ends_at || data.endsAt || '',
      dailyQuota: data.daily_quota || data.dailyQuota || data.plan?.daily_quota || data.plan?.dailyQuota || 0,
      monthlyQuota: data.monthly_quota || data.monthlyQuota || data.plan?.monthly_quota || data.plan?.monthlyQuota || 0,
      plan: data.plan ? {
        id: data.plan.id?.toString() || '',
        name: data.plan.name || '',
        price: data.plan.price || 0,
        dailyQuota: data.plan.daily_quota || data.plan.dailyQuota || 0,
        monthlyQuota: data.plan.monthly_quota || data.plan.monthlyQuota || 0,
        features: data.plan.features || []
      } : undefined
    }
  }

  // === 内容 ===
  async getContents(filters: ContentFilter): Promise<PaginatedResult<Content>> {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.platform) params.append('platform', filters.platform)
    if (filters.source) params.append('source', filters.source)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.pageSize) params.append('per_page', filters.pageSize.toString())

    const response = await this.request<{
      data: Content[]
      total: number
      page: number
      per_page: number
    }>(`/contents?${params}`)

    return {
      data: response.data,
      total: response.total,
      page: response.page,
      pageSize: response.per_page
    }
  }

  async getContentById(id: string): Promise<Content> {
    const response = await this.request<{ data: Content }>(`/contents/${id}`)
    return response.data
  }

  async createContent(data: Partial<Content>): Promise<Content> {
    const response = await this.request<{ data: Content }>('/contents', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    return response.data
  }

  async approveContent(id: string): Promise<Content> {
    const response = await this.request<{ data: Content }>(`/contents/${id}/approve`, {
      method: 'POST'
    })
    return response.data
  }

  async rejectContent(id: string, reason?: string): Promise<Content> {
    const response = await this.request<{ data: Content }>(`/contents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
    return response.data
  }

  // === 统计 ===
  async getAnalytics(range: DateRange): Promise<AnalyticsData> {
    const params = new URLSearchParams()
    params.append('start_date', range.startDate)
    params.append('end_date', range.endDate)
    if (range.platform) params.append('platform', range.platform)

    const response = await this.request<{ data: AnalyticsData }>(`/analytics/daily?${params}`)
    return response.data
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const response = await this.request<AnalyticsOverview>('/analytics/overview')
    return response
  }

  async refreshAnalytics(data: {
    platform: string
    followers: number
    posts: number
    views: number
    likes: number
    comments?: number
    shares?: number
  }): Promise<void> {
    await this.request('/analytics/refresh', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // === 平台 ===
  async getPlatforms(): Promise<PlatformAccount[]> {
    const response = await this.request<{ data: PlatformAccount[] }>('/platforms')
    return response.data
  }

  async connectPlatform(platform: PlatformType, data: { nickname: string; avatarUrl?: string }): Promise<PlatformAccount> {
    const response = await this.request<{ data: PlatformAccount }>('/platforms', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        nickname: data.nickname,
        avatar_url: data.avatarUrl
      })
    })
    return response.data
  }

  async disconnectPlatform(platform: PlatformType): Promise<void> {
    // 需要先获取平台 ID
    const platforms = await this.getPlatforms()
    const platformAccount = platforms.find(p => p.platform === platform)
    if (platformAccount) {
      await this.request(`/platforms/${platformAccount.id}`, {
        method: 'DELETE'
      })
    }
  }

  // === 物料包 ===
  async getMaterialPackages(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0]

    const token = this.getToken()
    log.info(`[RealApiClient] getMaterialPackages token: ${token ? token.substring(0, 20) + '...' : 'null'}`)

    try {
      const response = await this.request<{ success: boolean; data: any[]; message?: string }>(`/materials?date=${today}`)
      log.info(`[RealApiClient] /materials?date=${today} 响应: ${response.data?.length || 0} 个物料包`)
      return response.data || []
    } catch (e: any) {
      log.error(`[RealApiClient] 查询物料包失败: status=${e.status}, message=${e.message}`)
      // 404 表示当天没有物料，属于正常情况
      if (e.status === 404) {
        return []
      }
      // 其他错误（401/500/网络错误等）向上抛出，让调用方处理
      throw e
    }
  }

  async getMaterialPackagesByDate(date: string): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[]; message?: string }>(`/materials?date=${date}`)
    return response.data || []
  }

  async downloadMaterialPackage(packageId: number): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/materials/${packageId}/download`)
    return response.data
  }

  // === MCP 二进制更新 ===
  async getMcpBinaryManifest(): Promise<Record<string, { version: string; platforms: Record<string, { url: string; sha256: string }> }>> {
    const response = await this.request<{ success: boolean; data: any }>('/mcp-binaries/manifest')
    return response.data
  }
}
