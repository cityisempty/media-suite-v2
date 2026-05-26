import type { IApiClient } from './api-client'
import { MockApiClient } from './api-mock'
import { RealApiClient } from './real-api-client'
import { serverConfig } from './server-config'

/**
 * API 客户端代理 - 根据 token 动态选择 Mock 或真实客户端
 */
class ApiClientProxy implements IApiClient {
  private mockClient: MockApiClient
  private realClient: RealApiClient
  private tokenGetter: (() => string | null) | null = null

  constructor() {
    this.mockClient = new MockApiClient()
    this.realClient = new RealApiClient()
  }

  setTokenGetter(getter: () => string | null): void {
    this.tokenGetter = getter
    this.realClient.setTokenGetter(getter)
  }

  setSessionTokenGetter(getter: () => string | null): void {
    this.realClient.setSessionTokenGetter(getter)
  }

  setRefreshHandler(handler: () => Promise<string>): void {
    this.realClient.setRefreshHandler(handler)
  }

  setForceLogoutHandler(handler: () => void): void {
    this.realClient.setForceLogoutHandler(handler)
  }

  /**
   * 判断是否使用测试账号（保留兼容）
   */
  private isTestAccount(): boolean {
    if (!this.tokenGetter) return false
    const token = this.tokenGetter()
    return token === 'test-token-dev-mode'
  }

  /**
   * 获取当前应该使用的客户端
   */
  private getClient(): IApiClient {
    // 强制使用 Mock 模式
    if (serverConfig.useMock) {
      return this.mockClient
    }

    // 默认走真实后端客户端
    return this.realClient
  }

  // 代理所有方法到实际客户端
  async loginByWechat(code: string, deviceName?: string, deviceType?: string) {
    return this.getClient().loginByWechat(code, deviceName, deviceType)
  }

  async loginByEmail(email: string, code: string, deviceName?: string, deviceType?: string) {
    return this.getClient().loginByEmail(email, code, deviceName, deviceType)
  }

  async sendEmailCode(email: string) {
    return this.getClient().sendEmailCode(email)
  }

  async verifyToken(token: string) {
    return this.getClient().verifyToken(token)
  }

  async verifySession(sessionToken: string) {
    return this.getClient().verifySession(sessionToken)
  }

  async refreshToken() {
    return this.getClient().refreshToken()
  }

  async logout(sessionToken?: string) {
    return this.getClient().logout(sessionToken)
  }

  async getPersona() {
    return this.getClient().getPersona()
  }

  async savePersona(persona: any) {
    return this.getClient().savePersona(persona)
  }

  async getPersonaStrategy() {
    return this.getClient().getPersonaStrategy()
  }

  async getContents(filters: any) {
    return this.getClient().getContents(filters)
  }

  async getContentById(id: string) {
    return this.getClient().getContentById(id)
  }

  async createContent(data: any) {
    return this.getClient().createContent(data)
  }

  async approveContent(id: string) {
    return this.getClient().approveContent(id)
  }

  async rejectContent(id: string, reason?: string) {
    return this.getClient().rejectContent(id, reason)
  }

  async getAnalytics(range: any) {
    return this.getClient().getAnalytics(range)
  }

  async getAnalyticsOverview() {
    return this.getClient().getAnalyticsOverview()
  }

  async refreshAnalytics(data: {
    platform: string
    followers: number
    posts: number
    views: number
    likes: number
    comments?: number
    shares?: number
  }) {
    return this.getClient().refreshAnalytics(data)
  }

  async getPlatforms() {
    return this.getClient().getPlatforms()
  }

  async connectPlatform(platform: any, data: any) {
    return this.getClient().connectPlatform(platform, data)
  }

  async disconnectPlatform(platform: any) {
    return this.getClient().disconnectPlatform(platform)
  }

  async getMaterialPackages() {
    return this.getClient().getMaterialPackages()
  }

  async downloadMaterialPackage(packageId: number) {
    return this.getClient().downloadMaterialPackage(packageId)
  }

  async getMaterialPackagesByDate(date: string) {
    return this.getClient().getMaterialPackagesByDate(date)
  }

  async getMcpBinaryManifest() {
    return this.getClient().getMcpBinaryManifest()
  }
}

// 单例导出
export const apiClient = new ApiClientProxy()
