import { contextBridge, ipcRenderer } from 'electron'

export interface PublishProgress {
  level: string
  event: string
  data: any
}

export interface ElectronAPI {
  // 认证
  auth: {
    login(email: string, code: string): Promise<{ success: boolean; user?: any; error?: string }>
    sendEmailCode(email: string): Promise<{ success: boolean; error?: string }>
    logout(): Promise<{ success: boolean }>
    refreshToken(): Promise<{ success: boolean }>
    getCurrentUser(): Promise<any | null>
    updateProfile(data: { nickname?: string; phone?: string; avatarUrl?: string }): Promise<{ success: boolean; data?: any; error?: string }>
    uploadAvatar(filePath: string): Promise<{ success: boolean; data?: { avatarUrl: string }; error?: string }>
    onForceLogout(callback: () => void): () => void
  }

  // 人设
  persona: {
    list(): Promise<any[]>
    get(id: string): Promise<any | null>
    getActive(): Promise<any | null>
    create(data: any): Promise<any>
    update(id: string, data: any): Promise<any>
    delete(id: string): Promise<{ success: boolean }>
  }

  // 内容
  content: {
    list(filters?: any): Promise<{ success: boolean; data?: any[]; error?: string }>
    get(id: string): Promise<{ success: boolean; data?: any; error?: string }>
    update(id: string, data: any): Promise<{ success: boolean; data?: any; error?: string }>
    delete(id: string): Promise<{ success: boolean; error?: string }>
    publish(id: string): Promise<{ success: boolean; data?: any; error?: string }>
    getRecent(days?: number): Promise<{ success: boolean; data?: any[]; error?: string }>
    getByDate(): Promise<{ success: boolean; data?: Record<string, any[]>; error?: string }>
    onPublishProgress(callback: (progress: { id: string; status: string; error?: string }) => void): () => void
  }

  // 平台
  platform: {
    list(): Promise<{ success: boolean; data?: any[]; error?: string }>
    get(id: string): Promise<{ success: boolean; data?: any; error?: string }>
    getByPlatform(platform: string): Promise<{ success: boolean; data?: any[]; error?: string }>
    add(data: any): Promise<{ success: boolean; data?: any; error?: string }>
    update(id: string, data: any): Promise<{ success: boolean; data?: any; error?: string }>
    delete(id: string): Promise<{ success: boolean; error?: string }>
    updateStatus(id: string, status: string): Promise<{ success: boolean; data?: any; error?: string }>
    getConnected(): Promise<{ success: boolean; data?: any[]; error?: string }>
  }

  // 自动发布
  autoPublish: {
    getConfig(): Promise<any>
    updateConfig(config: any): Promise<any>
    getQueueStatus(): Promise<any>
    getQueue(): Promise<any[]>
    addToQueue(contentId: string): Promise<void>
    removeFromQueue(contentId: string): Promise<void>
    start(): Promise<void>
    stop(): Promise<void>
  }

  // 数据分析
  analytics: {
    getOverview(forceRefresh?: boolean): Promise<any>
    getDailyStats(startDate: string, endDate: string): Promise<any[]>
    updateStats(stats: any): Promise<void>
    addDailyStats(stat: any): Promise<void>
  }

  // 月度话题
  monthlyTopics: {
    list(yearMonth?: string): Promise<{ success: boolean; data?: any[]; error?: string }>
    update(id: number, topic: string): Promise<{ success: boolean; data?: any; error?: string }>
  }

  // 物料同步
  material: {
    sync(): Promise<{ success: boolean; data?: { imported: number; skipped: number }; message?: string; error?: string }>
    syncByDate(date: string): Promise<{ success: boolean; data?: { imported: number; skipped: number }; message?: string; error?: string }>
    check(): Promise<{ success: boolean; count: number; packages?: any[]; error?: string }>
  }

  // 登录
  xhsLogin(): Promise<{ success: boolean; message?: string; error?: string }>
  xhsLoginStatus(): Promise<{ loggedIn: boolean; expiresAt?: number }>
  xhsClearCookies(): Promise<{ success: boolean }>
  xhsGetQRCode(): Promise<{ success: boolean; qrCode?: string; url?: string; error?: string }>

  // 发布
  xhsPublish(params: {
    title: string
    body: string
    tags: string[]
    images: string[]
    visibility: string
  }): Promise<{ success: boolean; summary?: string; error?: string }>
  onPublishProgress(callback: (progress: PublishProgress) => void): () => void

  // 文件
  selectImages(): Promise<string[] | null>
  readImageAsBase64(filePath: string): Promise<string>

  // 应用信息
  getAppInfo(): Promise<{ version: string; platform: string; arch: string; dataDir: string }>
  getServerUrl(): Promise<string>
  setServerUrl(url: string): Promise<void>
}

const api: ElectronAPI = {
  // 认证
  auth: {
    login: (email, code) => ipcRenderer.invoke('auth:login-email', email, code),
    sendEmailCode: (email) => ipcRenderer.invoke('auth:send-email-code', email),
    logout: () => ipcRenderer.invoke('auth:logout'),
    refreshToken: () => ipcRenderer.invoke('auth:refresh-token'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
    updateProfile: (data) => ipcRenderer.invoke('auth:update-profile', data),
    uploadAvatar: (filePath) => ipcRenderer.invoke('auth:upload-avatar', filePath),
    onForceLogout: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('auth:force-logout', handler)
      return () => ipcRenderer.removeListener('auth:force-logout', handler)
    }
  },

  // 人设
  persona: {
    list: () => ipcRenderer.invoke('persona:list'),
    get: (id) => ipcRenderer.invoke('persona:get', id),
    getActive: () => ipcRenderer.invoke('persona:get-active'),
    create: (data) => ipcRenderer.invoke('persona:create', data),
    update: (id, data) => ipcRenderer.invoke('persona:update', id, data),
    delete: (id) => ipcRenderer.invoke('persona:delete', id)
  },

  // 内容
  content: {
    list: (filters) => ipcRenderer.invoke('content:list', filters),
    get: (id) => ipcRenderer.invoke('content:get', id),
    update: (id, data) => ipcRenderer.invoke('content:update', id, data),
    delete: (id) => ipcRenderer.invoke('content:delete', id),
    publish: (id) => ipcRenderer.invoke('content:publish', id),
    getRecent: (days) => ipcRenderer.invoke('content:get-recent', days),
    getByDate: () => ipcRenderer.invoke('content:get-by-date'),
    onPublishProgress: (callback) => {
      const handler = (_event: any, progress: { id: string; status: string; error?: string }) => callback(progress)
      ipcRenderer.on('content:publish-progress', handler)
      return () => {
        ipcRenderer.removeListener('content:publish-progress', handler)
      }
    }
  },

  // 平台
  platform: {
    list: () => ipcRenderer.invoke('platform:list'),
    get: (id) => ipcRenderer.invoke('platform:get', id),
    getByPlatform: (platform) => ipcRenderer.invoke('platform:get-by-platform', platform),
    add: (data) => ipcRenderer.invoke('platform:add', data),
    update: (id, data) => ipcRenderer.invoke('platform:update', id, data),
    delete: (id) => ipcRenderer.invoke('platform:delete', id),
    updateStatus: (id, status) => ipcRenderer.invoke('platform:update-status', id, status),
    getConnected: () => ipcRenderer.invoke('platform:get-connected')
  },

  // 自动发布
  autoPublish: {
    getConfig: () => ipcRenderer.invoke('auto-publish:get-config'),
    updateConfig: (config) => ipcRenderer.invoke('auto-publish:update-config', config),
    getQueueStatus: () => ipcRenderer.invoke('auto-publish:get-queue-status'),
    getQueue: () => ipcRenderer.invoke('auto-publish:get-queue'),
    addToQueue: (contentId) => ipcRenderer.invoke('auto-publish:add-to-queue', contentId),
    removeFromQueue: (contentId) => ipcRenderer.invoke('auto-publish:remove-from-queue', contentId),
    start: () => ipcRenderer.invoke('auto-publish:start'),
    stop: () => ipcRenderer.invoke('auto-publish:stop')
  },

  // 数据分析
  analytics: {
    getOverview: (forceRefresh) => ipcRenderer.invoke('analytics:get-overview', forceRefresh),
    getDailyStats: (startDate, endDate) => ipcRenderer.invoke('analytics:get-daily-stats', startDate, endDate),
    updateStats: (stats) => ipcRenderer.invoke('analytics:update-stats', stats),
    addDailyStats: (stat) => ipcRenderer.invoke('analytics:add-daily-stats', stat)
  },

  // 月度话题
  monthlyTopics: {
    list: (yearMonth) => ipcRenderer.invoke('monthly-topics:list', yearMonth),
    update: (id, topic) => ipcRenderer.invoke('monthly-topics:update', id, topic)
  },

  // 物料同步
  material: {
    sync: () => ipcRenderer.invoke('material:sync'),
    syncByDate: (date) => ipcRenderer.invoke('material:syncByDate', date),
    check: () => ipcRenderer.invoke('material:check')
  },

  // 登录
  xhsLogin: () => ipcRenderer.invoke('xhs:login'),
  xhsLoginStatus: () => ipcRenderer.invoke('xhs:login-status'),
  xhsClearCookies: () => ipcRenderer.invoke('xhs:clear-cookies'),
  xhsGetQRCode: () => ipcRenderer.invoke('xhs:get-qrcode'),

  // 发布
  xhsPublish: (params) => ipcRenderer.invoke('xhs:publish', params),
  onPublishProgress: (callback) => {
    const handler = (_event: any, progress: PublishProgress) => callback(progress)
    ipcRenderer.on('xhs:publish-progress', handler)
    return () => {
      ipcRenderer.removeListener('xhs:publish-progress', handler)
    }
  },

  // 文件
  selectImages: () => ipcRenderer.invoke('dialog:select-images'),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('file:read-image-base64', filePath),

  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  getServerUrl: () => ipcRenderer.invoke('app:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('app:set-server-url', url)
}

contextBridge.exposeInMainWorld('api', api)
