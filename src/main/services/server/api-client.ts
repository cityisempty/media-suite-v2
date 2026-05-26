import type {
  AppUser,
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
  DateRange
} from '../../../../packages/shared/src/types'

/**
 * 服务器 API 客户端接口
 */
export interface IApiClient {
  // === 认证 ===
  loginByWechat(code: string, deviceName?: string, deviceType?: string): Promise<AuthResult>
  loginByEmail(email: string, code: string, deviceName?: string, deviceType?: string): Promise<AuthResult>
  sendEmailCode(email: string): Promise<void>
  verifyToken(token: string): Promise<{ valid: boolean; user?: AppUser }>
  verifySession(sessionToken: string): Promise<SessionVerifyResult>
  refreshToken(): Promise<AuthResult>
  logout(sessionToken?: string): Promise<void>

  // === 人设 ===
  getPersona(): Promise<Persona | null>
  savePersona(persona: Omit<Persona, 'id' | 'userId' | 'serverGenerated' | 'updatedAt' | 'syncedAt'>): Promise<Persona>
  getPersonaStrategy(): Promise<Persona['serverGenerated']>

  // === 内容 ===
  getContents(filters: ContentFilter): Promise<PaginatedResult<Content>>
  getContentById(id: string): Promise<Content>
  createContent(data: Partial<Content>): Promise<Content>
  approveContent(id: string): Promise<Content>
  rejectContent(id: string, reason?: string): Promise<Content>

  // === 统计 ===
  getAnalytics(range: DateRange): Promise<AnalyticsData>
  getAnalyticsOverview(): Promise<AnalyticsOverview>
  refreshAnalytics(data: {
    platform: string
    followers: number
    posts: number
    views: number
    likes: number
    comments?: number
    shares?: number
  }): Promise<void>

  // === 平台 ===
  getPlatforms(): Promise<PlatformAccount[]>
  connectPlatform(platform: PlatformType, data: { nickname: string; avatarUrl?: string }): Promise<PlatformAccount>
  disconnectPlatform(platform: PlatformType): Promise<void>

  // === 物料包 ===
  getMaterialPackages(): Promise<any[]>
  getMaterialPackagesByDate(date: string): Promise<any[]>
  downloadMaterialPackage(packageId: number): Promise<any>

  // === MCP 二进制更新 ===
  getMcpBinaryManifest(): Promise<Record<string, { version: string; platforms: Record<string, { url: string; sha256: string }> }>>
}
