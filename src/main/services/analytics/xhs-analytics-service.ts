import { mcpServiceManager } from '../mcp/mcp-service-manager'
import { analyticsCacheService } from './analytics-cache-service'

export interface XhsUserStats {
  userId: string
  nickname: string
  followers: number
  likes: number
  notes: number
  notesList: XhsNoteStats[]
}

export interface XhsNoteStats {
  noteId: string
  title: string
  type: string
  likes: number
  collects: number
  comments: number
  shares: number
  createTime: number
}

export class XhsAnalyticsService {
  /**
   * 获取当前登录用户的统计数据（带缓存）
   */
  async getCurrentUserStats(forceRefresh = false): Promise<XhsUserStats | null> {
    try {
      // 1. 获取 userId
      const { platformService } = await import('../platform/platform-service')
      const xhsAccounts = await platformService.getAccountsByPlatform('xiaohongshu')
      const xhsAccount = xhsAccounts.find(a => a.status === 'connected')
      const userId = (
        xhsAccount?.metadata?.sessionUserId ||
        xhsAccount?.metadata?.profileUserId ||
        xhsAccount?.accountId ||
        xhsAccount?.metadata?.userId
      ) as string | undefined

      if (!userId) {
        console.log('[XhsAnalytics] 平台账号中没有保存 userId，需要手动配置')
        throw new Error('USER_ID_NOT_CONFIGURED')
      }

      // 2. 如果不强制刷新，先尝试从缓存获取
      if (!forceRefresh) {
        const cachedData = await analyticsCacheService.get(userId)
        if (cachedData) {
          return cachedData
        }
      }

      // 3. 缓存未命中或强制刷新，从 MCP 获取数据
      const stats = await this.fetchUserStatsFromMcp(userId)

      // 4. 保存到缓存
      if (stats) {
        await analyticsCacheService.set(userId, stats)
      }

      return stats
    } catch (error) {
      if (error instanceof Error && (error.message === 'NOT_LOGGED_IN' || error.message === 'USER_ID_NOT_CONFIGURED')) {
        throw error
      }
      console.error('[XhsAnalytics] 获取用户统计数据失败:', error)
      return null
    }
  }

  /**
   * 从 MCP 获取用户统计数据
   */
  private async fetchUserStatsFromMcp(userId: string): Promise<XhsUserStats | null> {
    try {
      const client = await mcpServiceManager.getClient()

      // 1. 检查登录状态
      const loginStatus = await client.callTool('check_login_status', {})
      const statusText = this.extractText(loginStatus)

      if (!statusText.includes('已登录')) {
        console.log('[XhsAnalytics] 用户未登录，需要先登录小红书')
        throw new Error('NOT_LOGGED_IN')
      }

      // 2. 获取首页 Feed 以获取 xsecToken
      const feedsResult = await client.callTool('list_feeds', {})
      const feedsText = this.extractText(feedsResult)

      let xsecToken: string | null = null
      try {
        const feedsData = JSON.parse(feedsText)
        if (feedsData.feeds && feedsData.feeds.length > 0) {
          xsecToken = feedsData.feeds[0].xsecToken
        }
      } catch (parseError) {
        console.error('[XhsAnalytics] 解析 Feed JSON 失败:', parseError)
      }

      if (!xsecToken) {
        console.log('[XhsAnalytics] 无法获取 xsecToken')
        throw new Error('NOT_LOGGED_IN')
      }

      // 3. 获取用户主页信息
      const profileResult = await client.callTool('user_profile', {
        user_id: userId,
        xsec_token: xsecToken
      })

      console.log('[XhsAnalytics] user_profile 返回结果:', JSON.stringify(profileResult, null, 2))

      const profileText = this.extractText(profileResult)
      console.log('[XhsAnalytics] 提取的用户主页文本:', profileText.substring(0, 1000))

      // 解析用户统计数据
      const stats = this.parseUserProfile(profileText, userId)

      return stats
    } catch (error) {
      throw error
    }
  }

  /**
   * 获取指定笔记的详细数据
   */
  async getNoteStats(feedId: string, xsecToken: string): Promise<XhsNoteStats | null> {
    try {
      const client = await mcpServiceManager.getClient()
      const result = await client.callTool('get_feed_detail', {
        feed_id: feedId,
        xsec_token: xsecToken,
        load_all_comments: false
      })

      const text = this.extractText(result)
      return this.parseNoteDetail(text, feedId)
    } catch (error) {
      console.error(`[XhsAnalytics] 获取笔记 ${feedId} 详情失败:`, error)
      return null
    }
  }

  /**
   * 从 MCP 返回结果中提取文本内容
   */
  private extractText(result: any): string {
    if (!result || !result.content) return ''

    const textContent = result.content.find((c: any) => c.type === 'text')
    return textContent?.text || ''
  }

  /**
   * 解析用户主页信息
   * MCP 返回格式：
   * {
   *   "userBasicInfo": { "nickname": "...", "desc": "...", "avatar": "..." },
   *   "interactions": [
   *     { "type": "follow", "name": "关注", "count": "123" },
   *     { "type": "fans", "name": "粉丝", "count": "456" },
   *     { "type": "interaction", "name": "获赞与收藏", "count": "789" }
   *   ],
   *   "feeds": [...]
   * }
   */
  private parseUserProfile(text: string, userId: string): XhsUserStats {
    const stats: XhsUserStats = {
      userId,
      nickname: '',
      followers: 0,
      likes: 0,
      notes: 0,
      notesList: []
    }

    try {
      const profileData = JSON.parse(text)

      // 解析用户基本信息
      if (profileData.userBasicInfo) {
        stats.nickname = profileData.userBasicInfo.nickname || ''
      }

      // 解析互动数据
      if (Array.isArray(profileData.interactions)) {
        for (const interaction of profileData.interactions) {
          const count = this.parseInteractionCount(interaction.count)

          // 根据 type 或 name 判断数据类型
          if (interaction.type === 'fans' || interaction.name === '粉丝') {
            stats.followers = count
          } else if (interaction.type === 'interaction' || interaction.name === '获赞与收藏') {
            stats.likes = count
          }
        }
      }

      // 解析笔记列表
      if (Array.isArray(profileData.feeds)) {
        stats.notes = profileData.feeds.length

        for (const feed of profileData.feeds) {
          if (feed.id && feed.noteCard) {
            stats.notesList.push({
              noteId: feed.id,
              title: feed.noteCard.displayTitle || '',
              type: feed.noteCard.type || '',
              likes: this.parseInteractionCount(feed.noteCard.interactInfo?.likedCount || '0'),
              collects: this.parseInteractionCount(feed.noteCard.interactInfo?.collectedCount || '0'),
              comments: this.parseInteractionCount(feed.noteCard.interactInfo?.commentCount || '0'),
              shares: this.parseInteractionCount(feed.noteCard.interactInfo?.sharedCount || '0'),
              createTime: Date.now()
            })
          }
        }
      }
    } catch (error) {
      console.error('[XhsAnalytics] 解析用户主页 JSON 失败:', error)
    }

    return stats
  }

  /**
   * 解析互动数量（支持 "1.2万" 格式）
   */
  private parseInteractionCount(countStr: string): number {
    if (!countStr || countStr === '') return 0

    const str = countStr.toString().trim()
    if (str.match(/[wW万]/)) {
      const num = parseFloat(str.replace(/[wW万]/, ''))
      return Math.round(num * 10000)
    }

    return parseInt(str) || 0
  }

  /**
   * 解析笔记详情
   */
  private parseNoteDetail(text: string, noteId: string): XhsNoteStats {
    const stats: XhsNoteStats = {
      noteId,
      title: '',
      type: '',
      likes: 0,
      collects: 0,
      comments: 0,
      shares: 0,
      createTime: Date.now()
    }

    // 提取标题
    const titleMatch = text.match(/标题[：:]\s*([^\n]+)/)
    if (titleMatch) {
      stats.title = titleMatch[1].trim()
    }

    // 提取类型
    const typeMatch = text.match(/类型[：:]\s*([^\n]+)/)
    if (typeMatch) {
      stats.type = typeMatch[1].trim()
    }

    // 提取点赞数
    const likesMatch = text.match(/点赞[：:]\s*([\d.]+)([wW万]?)/)
    if (likesMatch) {
      stats.likes = this.parseInteractionCount(likesMatch[1] + (likesMatch[2] || ''))
    }

    // 提取收藏数
    const collectsMatch = text.match(/收藏[：:]\s*([\d.]+)([wW万]?)/)
    if (collectsMatch) {
      stats.collects = this.parseInteractionCount(collectsMatch[1] + (collectsMatch[2] || ''))
    }

    // 提取评论数
    const commentsMatch = text.match(/评论[：:]\s*([\d.]+)([wW万]?)/)
    if (commentsMatch) {
      stats.comments = this.parseInteractionCount(commentsMatch[1] + (commentsMatch[2] || ''))
    }

    // 提取分享数
    const sharesMatch = text.match(/分享[：:]\s*([\d.]+)([wW万]?)/)
    if (sharesMatch) {
      stats.shares = this.parseInteractionCount(sharesMatch[1] + (sharesMatch[2] || ''))
    }

    return stats
  }
}

export const xhsAnalyticsService = new XhsAnalyticsService()
