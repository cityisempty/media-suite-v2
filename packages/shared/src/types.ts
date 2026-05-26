// ============ 应用用户 ============
export interface AppUser {
  id: string
  phone?: string
  wechatOpenId?: string
  nickname: string
  avatarUrl?: string
  createdAt: string
}

// ============ 订阅 ============
export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'active' | 'expired' | 'cancelled' | 'inactive'
  startsAt: string
  endsAt: string
  dailyQuota: number
  monthlyQuota: number
  plan?: {
    id: string
    name: string
    price: number
    dailyQuota: number
    monthlyQuota: number
    features: string[]
  }
}

// ============ 认证 ============
export interface AuthTokens {
  sessionToken: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  expiresIn: number
}

export interface AuthResult {
  user: AppUser
  tokens: AuthTokens
  hasPersona: boolean
}

export interface SessionVerifyResult {
  valid: boolean
  user?: AppUser
}

// ============ IP 人设 ============
export interface Persona {
  id: string
  userId: string
  personality: string
  age: number
  languageStyle: string
  gender?: string
  expertiseFields: string[]
  creativeFields: string[]
  publishSchedule: {
    timeSlots: string[]
    frequency: number
    style: string
  }
  serverGenerated?: {
    track: string
    imagePosition: string
    catchphrase: string
    growthPlan: string
  }
  subscription?: Subscription
  updatedAt: string
  syncedAt?: string
}

// ============ 社交媒体账号 ============
export type PlatformType = 'xiaohongshu' | 'douyin' | 'wechat_gzh' | 'wechat_video' | 'zhihu'

export interface PlatformAccount {
  platform: PlatformType
  nickname: string
  avatarUrl?: string
  connectedAt: string
  expiresAt?: number
  status: 'active' | 'expired' | 'disconnected'
  metadata?: Record<string, any>
}

// ============ 内容 ============
export type ContentSource = 'server_generated' | 'user_created' | 'imported'
export type ContentStatus = 'draft' | 'pending' | 'approved' | 'scheduled' | 'rejected' | 'publishing' | 'published' | 'failed'

export interface ContentImage {
  id: string
  localPath?: string
  url?: string
  base64?: string
  isCover: boolean
}

export interface ContentStats {
  likes: number
  comments: number
  shares: number
  views: number
  collects: number
}

export interface Content {
  id: string
  userId: string
  source: ContentSource
  title: string
  body: string
  tags: string[]
  images: ContentImage[]
  targetPlatform: PlatformType
  visibility: string
  scheduledAt?: string
  status: ContentStatus
  publishedAt?: string
  publishedUrl?: string
  rejectionReason?: string
  failureReason?: string
  stats?: ContentStats
  createdAt: string
  updatedAt: string
}

// ============ 统计数据 ============
export interface DailyStats {
  date: string
  followers: number
  posts: number
  views: number
  likes: number
  comments: number
  shares: number
}

export interface AnalyticsData {
  totalFollowers: number
  totalPosts: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  dailyStats: DailyStats[]
}

export interface AnalyticsOverview {
  totalFans: number
  totalPosts: number
  totalViews: number
  totalLikes: number
  fansGrowth: number
  viewsGrowth: number
}

export interface AnalyticsTimeSeries {
  dates: string[]
  fans: number[]
  views: number[]
  likes: number[]
  posts: number[]
}

// ============ 自动发布配置 ============
export interface AutoPublishConfig {
  enabled: boolean
  platforms: PlatformType[]
  mode: 'auto' | 'semi_auto'
  maxPostsPerDay: number
  quietHours: { start: string; end: string }
}

// ============ WebSocket 推送事件 ============
export type WsEventType =
  | 'content:generated'
  | 'content:status_update'
  | 'analytics:update'
  | 'persona:strategy_update'
  | 'platform:token_expired'

export interface WsEvent<T = any> {
  type: WsEventType
  payload: T
  timestamp: string
}

// ============ 分页结果 ============
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ============ 日期范围 ============
export interface DateRange {
  startDate: string
  endDate: string
}

// ============ 内容过滤器 ============
export interface ContentFilter {
  status?: ContentStatus
  platform?: PlatformType
  source?: ContentSource
  page: number
  pageSize: number
}
