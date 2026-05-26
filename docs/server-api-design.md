# 媒体自动化套件 - 服务器 API 设计

## 1. 认证相关

### 1.1 发送验证码
```
POST /api/auth/send-code
Request: { phone: string }
Response: { success: boolean, message: string }
```

### 1.2 手机号登录
```
POST /api/auth/login/phone
Request: { phone: string, code: string }
Response: { 
  success: boolean,
  token: string,
  user: {
    id: string,
    phone: string,
    nickname: string,
    avatar?: string
  }
}
```

### 1.3 微信登录 - 获取二维码
```
POST /api/auth/login/wechat/qrcode
Response: {
  qrcodeUrl: string,
  ticket: string,
  expiresIn: number
}
```

### 1.4 微信登录 - 轮询状态
```
GET /api/auth/login/wechat/status?ticket={ticket}
Response: {
  status: 'pending' | 'scanned' | 'confirmed' | 'expired',
  token?: string,
  user?: { id, phone, nickname, avatar }
}
```

### 1.5 验证 Token
```
POST /api/auth/verify
Headers: { Authorization: Bearer {token} }
Response: {
  valid: boolean,
  user?: { id, phone, nickname, avatar }
}
```

### 1.6 刷新 Token
```
POST /api/auth/refresh
Headers: { Authorization: Bearer {token} }
Response: {
  token: string,
  expiresIn: number
}
```

## 2. 人设管理

### 2.1 获取人设列表
```
GET /api/personas
Headers: { Authorization: Bearer {token} }
Response: {
  personas: Persona[]
}
```

### 2.2 创建人设
```
POST /api/personas
Headers: { Authorization: Bearer {token} }
Request: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>
Response: { persona: Persona }
```

### 2.3 更新人设
```
PUT /api/personas/:id
Headers: { Authorization: Bearer {token} }
Request: Partial<Persona>
Response: { persona: Persona }
```

### 2.4 删除人设
```
DELETE /api/personas/:id
Headers: { Authorization: Bearer {token} }
Response: { success: boolean }
```

## 3. 平台管理

### 3.1 获取平台列表
```
GET /api/platforms
Headers: { Authorization: Bearer {token} }
Response: {
  platforms: PlatformAccount[]
}
```

### 3.2 绑定平台账号
```
POST /api/platforms
Headers: { Authorization: Bearer {token} }
Request: {
  platform: PlatformType,
  cookies: string, // JSON string
  username?: string
}
Response: { platform: PlatformAccount }
```

### 3.3 更新平台状态
```
PUT /api/platforms/:id
Headers: { Authorization: Bearer {token} }
Request: { status: 'connected' | 'disconnected' | 'error' }
Response: { platform: PlatformAccount }
```

### 3.4 删除平台绑定
```
DELETE /api/platforms/:id
Headers: { Authorization: Bearer {token} }
Response: { success: boolean }
```

## 4. 内容管理

### 4.1 获取内容列表
```
GET /api/contents?status={status}&startDate={date}&endDate={date}
Headers: { Authorization: Bearer {token} }
Response: {
  contents: Content[]
}
```

### 4.2 获取单个内容
```
GET /api/contents/:id
Headers: { Authorization: Bearer {token} }
Response: { content: Content }
```

### 4.3 更新内容
```
PUT /api/contents/:id
Headers: { Authorization: Bearer {token} }
Request: Partial<Content>
Response: { content: Content }
```

### 4.4 删除内容
```
DELETE /api/contents/:id
Headers: { Authorization: Bearer {token} }
Response: { success: boolean }
```

### 4.5 上报发布结果
```
POST /api/contents/:id/publish-result
Headers: { Authorization: Bearer {token} }
Request: {
  status: 'published' | 'failed',
  publishedAt?: number,
  error?: string,
  platformPostId?: string
}
Response: { success: boolean }
```

## 5. 物料包管理

### 5.1 获取待下载物料包列表
```
GET /api/materials/pending
Headers: { Authorization: Bearer {token} }
Response: {
  materials: Array<{
    id: string,
    date: string,
    postId: string,
    downloadUrl: string,
    checksum: string
  }>
}
```

### 5.2 下载物料包
```
GET /api/materials/download/:id
Headers: { Authorization: Bearer {token} }
Response: Binary (ZIP file)
```

### 5.3 确认物料包已下载
```
POST /api/materials/:id/confirm
Headers: { Authorization: Bearer {token} }
Response: { success: boolean }
```

## 6. 数据统计

### 6.1 获取统计概览
```
GET /api/analytics/overview?days={days}
Headers: { Authorization: Bearer {token} }
Response: {
  totalFans: number,
  totalPosts: number,
  totalViews: number,
  totalLikes: number,
  fansGrowth: number,
  viewsGrowth: number
}
```

### 6.2 获取每日统计
```
GET /api/analytics/daily?days={days}
Headers: { Authorization: Bearer {token} }
Response: {
  stats: DailyStats[]
}
```

### 6.3 上报客户端统计数据
```
POST /api/analytics/report
Headers: { Authorization: Bearer {token} }
Request: {
  platform: PlatformType,
  date: string,
  fans: number,
  posts: number,
  views: number,
  likes: number
}
Response: { success: boolean }
```

## 7. WebSocket 推送

### 7.1 连接
```
WS /api/ws
Headers: { Authorization: Bearer {token} }
```

### 7.2 消息类型

#### 新物料包推送
```json
{
  "type": "new_material",
  "data": {
    "id": "material-xxx",
    "date": "2026-04-21",
    "postId": "post-001",
    "downloadUrl": "https://..."
  }
}
```

#### 发布任务推送
```json
{
  "type": "publish_task",
  "data": {
    "contentId": "content-xxx",
    "scheduledAt": 1776697200000
  }
}
```

#### 系统通知
```json
{
  "type": "notification",
  "data": {
    "title": "系统通知",
    "message": "您的账号即将到期",
    "level": "info" | "warning" | "error"
  }
}
```

## 8. 测试账号

开发阶段固定测试账号：
- 手机号：13800138000
- 验证码：任意6位数字（服务器不验证）
- Token：固定返回 `test-token-dev-mode`
- 用户信息：
  ```json
  {
    "id": "user-test-001",
    "phone": "13800138000",
    "nickname": "测试用户",
    "avatar": null
  }
  ```

## 9. 错误码

```
200 - 成功
400 - 请求参数错误
401 - 未授权（token无效或过期）
403 - 禁止访问（账号被封禁）
404 - 资源不存在
429 - 请求过于频繁
500 - 服务器内部错误
```

## 10. 技术栈建议

### 后端
- **框架**: Go (Gin) 或 Node.js (Express/Fastify)
- **数据库**: PostgreSQL (主数据) + Redis (缓存/Session)
- **文件存储**: 阿里云OSS 或 MinIO (自建)
- **WebSocket**: Socket.io 或原生 WebSocket

### 部署
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **HTTPS**: Let's Encrypt
- **监控**: Prometheus + Grafana
