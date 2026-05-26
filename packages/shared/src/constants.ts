// IPC 事件名常量
export const IPC_CHANNELS = {
  // 应用认证
  APP_AUTH_LOGIN_WECHAT: 'app-auth:login-wechat',
  APP_AUTH_LOGIN_PHONE: 'app-auth:login-phone',
  APP_AUTH_SEND_SMS: 'app-auth:send-sms',
  APP_AUTH_LOGOUT: 'app-auth:logout',
  APP_AUTH_STATUS: 'app-auth:status',
  APP_AUTH_EXPIRED: 'app-auth:expired',

  // 平台
  PLATFORM_GET_ACCOUNTS: 'platform:get-accounts',
  PLATFORM_CONNECT_XHS: 'platform:connect-xhs',
  PLATFORM_DISCONNECT: 'platform:disconnect',
  PLATFORM_XHS_STATUS: 'platform:xhs-status',
  PLATFORM_TOKEN_EXPIRED: 'platform:token-expired',

  // 人设
  PERSONA_GET: 'persona:get',
  PERSONA_SAVE: 'persona:save',
  PERSONA_GET_STRATEGY: 'persona:get-strategy',

  // 内容
  CONTENT_LIST: 'content:list',
  CONTENT_GET: 'content:get',
  CONTENT_CREATE: 'content:create',
  CONTENT_APPROVE: 'content:approve',
  CONTENT_REJECT: 'content:reject',
  CONTENT_NEW: 'content:new',
  CONTENT_STATUS_UPDATE: 'content:status-update',

  // 发布
  PUBLISH_XHS: 'publish:xhs',
  PUBLISH_PROGRESS: 'publish:progress',

  // 自动发布
  AUTO_PUBLISH_GET_CONFIG: 'auto-publish:get-config',
  AUTO_PUBLISH_SAVE_CONFIG: 'auto-publish:save-config',
  AUTO_PUBLISH_START: 'auto-publish:start',
  AUTO_PUBLISH_STOP: 'auto-publish:stop',
  AUTO_PUBLISH_STATUS: 'auto-publish:status',
  AUTO_PUBLISH_EVENT: 'auto-publish:event',

  // 统计
  ANALYTICS_GET_OVERVIEW: 'analytics:get-overview',
  ANALYTICS_GET_TIMESERIES: 'analytics:get-timeseries',
  ANALYTICS_UPDATE: 'analytics:update',

  // 文件
  FILE_SELECT_IMAGES: 'file:select-images',
  FILE_READ_IMAGE_BASE64: 'file:read-image-base64',

  // 应用
  APP_GET_INFO: 'app:get-info'
} as const

// 平台类型枚举
export const PLATFORM_TYPES = {
  XIAOHONGSHU: 'xiaohongshu',
  DOUYIN: 'douyin',
  WECHAT_GZH: 'wechat_gzh',
  WECHAT_VIDEO: 'wechat_video',
  ZHIHU: 'zhihu'
} as const

// 内容状态
export const CONTENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed'
} as const

// 内容来源
export const CONTENT_SOURCE = {
  SERVER_GENERATED: 'server_generated',
  USER_CREATED: 'user_created',
  IMPORTED: 'imported'
} as const

// API 端点
export const API_ENDPOINTS = {
  // 认证
  AUTH_SEND_CODE: '/api/auth/send-code',
  AUTH_LOGIN_EMAIL: '/api/auth/login/email',
  AUTH_LOGIN_PHONE: '/api/auth/login/phone',
  AUTH_LOGIN_WECHAT: '/api/auth/login/wechat',
  AUTH_LOGIN_WECHAT_QRCODE: '/api/auth/login/wechat/qrcode',
  AUTH_LOGIN_WECHAT_STATUS: '/api/auth/login/wechat/status',
  AUTH_VERIFY: '/api/auth/verify',
  AUTH_VERIFY_SESSION: '/api/auth/verify-session',
  AUTH_REFRESH: '/api/auth/refresh',
  AUTH_LOGOUT: '/api/auth/logout',

  // 人设
  PERSONAS: '/api/personas',

  // 平台
  PLATFORMS: '/api/platforms',

  // 内容
  CONTENTS: '/api/contents',

  // 物料包
  MATERIALS_PENDING: '/api/materials/pending',
  MATERIALS_DOWNLOAD: '/api/materials/download',

  // 统计
  ANALYTICS_OVERVIEW: '/api/analytics/overview',
  ANALYTICS_DAILY: '/api/analytics/daily',

  // WebSocket
  WS: '/api/ws'
} as const

// 测试账号配置
export const TEST_ACCOUNT = {
  PHONE: '13800138000',
  TOKEN: 'test-token-dev-mode',
  USER: {
    id: 'user-test-001',
    phone: '13800138000',
    nickname: '测试用户',
    avatar: undefined
  }
} as const
