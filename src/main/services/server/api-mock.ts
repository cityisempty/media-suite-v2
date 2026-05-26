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
import { LocalStore } from '../../db/local-store'
import { getDataDir } from '../../utils/paths'
import { join } from 'node:path'

/**
 * Mock API 客户端 - 使用本地 JSON 文件模拟服务器
 */
export class MockApiClient implements IApiClient {
  private userStore: LocalStore<AppUser>
  private personaStore: LocalStore<Persona>
  private contentsStore: LocalStore<Content[]>
  private platformsStore: LocalStore<PlatformAccount[]>

  constructor() {
    const mockDir = join(getDataDir(), 'mock-data')
    this.userStore = new LocalStore(join(mockDir, 'user.json'))
    this.personaStore = new LocalStore(join(mockDir, 'persona.json'))
    this.contentsStore = new LocalStore(join(mockDir, 'contents.json'))
    this.platformsStore = new LocalStore(join(mockDir, 'platforms.json'))

    this.initMockData()
  }

  private initMockData() {
    if (!this.contentsStore.exists()) {
      this.contentsStore.write([])
    }
    if (!this.platformsStore.exists()) {
      this.platformsStore.write([])
    }
  }

  async loginByWechat(code: string, _deviceName?: string, _deviceType?: string): Promise<AuthResult> {
    await this.delay(800)
    const user: AppUser = {
      id: 'mock-user-1',
      wechatOpenId: 'mock-openid-' + code,
      nickname: '测试用户',
      avatarUrl: 'https://via.placeholder.com/100',
      createdAt: new Date().toISOString()
    }
    this.userStore.write(user)

    return {
      user,
      tokens: {
        sessionToken: 'mock-session-token-' + Date.now(),
        accessToken: 'mock-access-token-' + Date.now(),
        refreshToken: '',
        expiresAt: Date.now() + 3600 * 1000,
        expiresIn: 3600
      },
      hasPersona: this.personaStore.exists()
    }
  }

  async loginByEmail(email: string, _code: string, _deviceName?: string, _deviceType?: string): Promise<AuthResult> {
    await this.delay(500)
    const user: AppUser = {
      id: 'mock-user-1',
      email,
      nickname: email.split('@')[0] + '用户',
      createdAt: new Date().toISOString()
    }
    this.userStore.write(user)

    return {
      user,
      tokens: {
        sessionToken: 'mock-session-token-' + Date.now(),
        accessToken: 'mock-access-token-' + Date.now(),
        refreshToken: '',
        expiresAt: Date.now() + 3600 * 1000,
        expiresIn: 3600
      },
      hasPersona: this.personaStore.exists()
    }
  }

  async sendEmailCode(email: string): Promise<void> {
    await this.delay(300)
    console.log(`[Mock] 验证码已发送到 ${email}: 123456`)
  }

  async verifyToken(token: string): Promise<{ valid: boolean; user?: AppUser }> {
    await this.delay(200)

    if (token === 'test-token-dev-mode') {
      return {
        valid: true,
        user: {
          id: 'user-test-001',
          phone: '13800138000',
          nickname: '测试用户',
          createdAt: new Date().toISOString()
        }
      }
    }

    const user = this.userStore.read()
    if (user && token.startsWith('mock-access-token-')) {
      return { valid: true, user }
    }

    return { valid: false }
  }

  async verifySession(_sessionToken: string): Promise<SessionVerifyResult> {
    await this.delay(200)
    const user = this.userStore.read()
    if (user) {
      return { valid: true, user }
    }
    return { valid: false }
  }

  async refreshToken(): Promise<AuthResult> {
    const user = this.userStore.read()
    if (!user) throw new Error('用户未登录')

    return {
      user,
      tokens: {
        sessionToken: 'mock-session-token-' + Date.now(),
        accessToken: 'mock-access-token-' + Date.now(),
        refreshToken: '',
        expiresAt: Date.now() + 3600 * 1000,
        expiresIn: 3600
      },
      hasPersona: this.personaStore.exists()
    }
  }

  async logout(_sessionToken?: string): Promise<void> {
    this.userStore.delete()
  }

  async getPersona(): Promise<Persona | null> {
    await this.delay(200)
    return this.personaStore.read()
  }

  async savePersona(data: any): Promise<Persona> {
    await this.delay(500)
    const user = this.userStore.read()
    if (!user) throw new Error('用户未登录')

    const persona: Persona = {
      id: 'persona-' + Date.now(),
      userId: user.id,
      personality: data.personality || '',
      age: data.age || 30,
      languageStyle: data.languageStyle || '',
      gender: data.gender || 'unknown',
      expertiseFields: data.expertiseFields || [],
      creativeFields: data.creativeFields || [],
      publishSchedule: data.publishSchedule || {
        timeSlots: [],
        frequency: 1,
        style: ''
      },
      serverGenerated: {
        track: '心理学科普赛道',
        imagePosition: '温暖专业的心理咨询师形象',
        catchphrase: '用科学的方法，温暖每一颗心',
        growthPlan: '第1-3月：建立专业形象，发布基础心理学知识；第4-6月：深度内容+案例分析；第7-12月：打造个人IP，开展线上咨询'
      },
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    }

    console.log('[MockApiClient] 保存人设:', persona)
    this.personaStore.write(persona)
    return persona
  }

  async getPersonaStrategy(): Promise<Persona['serverGenerated']> {
    await this.delay(300)
    const persona = this.personaStore.read()
    return persona?.serverGenerated || null
  }

  async getContents(filters: ContentFilter): Promise<PaginatedResult<Content>> {
    await this.delay(300)
    let contents = this.contentsStore.read() || []

    if (filters.status) {
      contents = contents.filter(c => c.status === filters.status)
    }
    if (filters.platform) {
      contents = contents.filter(c => c.targetPlatform === filters.platform)
    }
    if (filters.source) {
      contents = contents.filter(c => c.source === filters.source)
    }

    const start = (filters.page - 1) * filters.pageSize
    const items = contents.slice(start, start + filters.pageSize)

    return {
      items,
      total: contents.length,
      page: filters.page,
      pageSize: filters.pageSize
    }
  }

  async getContentById(id: string): Promise<Content> {
    await this.delay(200)
    const contents = this.contentsStore.read() || []
    const content = contents.find(c => c.id === id)
    if (!content) throw new Error('内容不存在')
    return content
  }

  async createContent(data: Partial<Content>): Promise<Content> {
    await this.delay(400)
    const user = this.userStore.read()
    if (!user) throw new Error('用户未登录')

    const content: Content = {
      id: 'content-' + Date.now(),
      userId: user.id,
      source: 'user_created',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    } as Content

    this.contentsStore.update(contents => [...(contents || []), content])
    return content
  }

  async approveContent(id: string): Promise<Content> {
    await this.delay(300)
    const contents = this.contentsStore.read() || []
    const content = contents.find(c => c.id === id)
    if (!content) throw new Error('内容不存在')

    content.status = 'approved'
    content.updatedAt = new Date().toISOString()
    this.contentsStore.write(contents)
    return content
  }

  async rejectContent(id: string, reason?: string): Promise<Content> {
    await this.delay(300)
    const contents = this.contentsStore.read() || []
    const content = contents.find(c => c.id === id)
    if (!content) throw new Error('内容不存在')

    content.status = 'rejected'
    content.rejectionReason = reason
    content.updatedAt = new Date().toISOString()
    this.contentsStore.write(contents)
    return content
  }

  async getAnalytics(range: DateRange): Promise<AnalyticsData> {
    await this.delay(500)
    return this.generateMockAnalytics()
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    await this.delay(300)
    return {
      totalFans: 1234,
      totalPosts: 56,
      totalViews: 12345,
      totalLikes: 2345,
      fansGrowth: 123,
      viewsGrowth: 456
    }
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
    await this.delay(300)
    // Mock 模式下不做任何操作
  }

  async getPlatforms(): Promise<PlatformAccount[]> {
    await this.delay(200)
    return this.platformsStore.read() || []
  }

  async connectPlatform(platform: PlatformType, data: { nickname: string; avatarUrl?: string }): Promise<PlatformAccount> {
    await this.delay(400)
    const account: PlatformAccount = {
      platform,
      nickname: data.nickname,
      avatarUrl: data.avatarUrl,
      connectedAt: new Date().toISOString(),
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
      status: 'active'
    }

    this.platformsStore.update(platforms => {
      const filtered = (platforms || []).filter(p => p.platform !== platform)
      return [...filtered, account]
    })

    return account
  }

  async disconnectPlatform(platform: PlatformType): Promise<void> {
    await this.delay(300)
    this.platformsStore.update(platforms => {
      return (platforms || []).filter(p => p.platform !== platform)
    })
  }

  async getMaterialPackages(): Promise<any[]> {
    await this.delay(300)
    // Mock 模式返回空数组
    return []
  }

  async getMaterialPackagesByDate(date: string): Promise<any[]> {
    await this.delay(300)
    // Mock 模式返回空数组
    return []
  }

  async downloadMaterialPackage(packageId: number): Promise<any> {
    await this.delay(500)
    // Mock 模式返回空对象
    return {}
  }

  async getMcpBinaryManifest(): Promise<Record<string, { version: string; platforms: Record<string, { url: string; sha256: string }> }>> {
    await this.delay(300)
    return {}
  }

  private generateMockAnalytics(): AnalyticsData {
    const dates: string[] = []
    const fans: number[] = []
    const views: number[] = []
    const likes: number[] = []
    const posts: number[] = []

    let baseFans = 1000
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])

      baseFans += Math.floor(Math.random() * 20)
      fans.push(baseFans)
      views.push(Math.floor(Math.random() * 500) + 200)
      likes.push(Math.floor(Math.random() * 100) + 50)
      posts.push(Math.random() > 0.7 ? 1 : 0)
    }

    return {
      overview: {
        totalFans: baseFans,
        totalPosts: posts.reduce((a, b) => a + b, 0),
        totalViews: views.reduce((a, b) => a + b, 0),
        totalLikes: likes.reduce((a, b) => a + b, 0),
        fansGrowth: baseFans - 1000,
        viewsGrowth: Math.floor(Math.random() * 1000)
      },
      timeSeries: { dates, fans, views, likes, posts },
      topContent: []
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
