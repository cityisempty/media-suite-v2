import { join } from 'path'
import { getDataDir } from '../../utils/paths'
import { LocalStore } from '../../db/local-store'
import type { AnalyticsData, DailyStats } from '../../../../packages/shared/src/types'
import { xhsAnalyticsService } from './xhs-analytics-service'
import { apiClient } from '../server'

export class AnalyticsService {
  private store: LocalStore<AnalyticsData>

  constructor() {
    const dataPath = join(getDataDir(), 'analytics.json')
    this.store = new LocalStore<AnalyticsData>(dataPath)
  }

  /**
   * 获取统计概览（优先从后端获取）
   */
  async getOverview(forceRefresh = false): Promise<AnalyticsData> {
    // 如果强制刷新，则从 MCP 获取最新数据并上报到后端
    if (forceRefresh) {
      return await this.refreshFromMcp()
    }

    // 优先从后端获取数据
    try {
      const overview = await apiClient.getAnalyticsOverview()

      const data: AnalyticsData = {
        totalFollowers: overview.totalFans || 0,
        totalPosts: overview.totalPosts || 0,
        totalViews: overview.totalViews || 0,
        totalLikes: overview.totalLikes || 0,
        totalComments: 0,
        totalShares: 0,
        dailyStats: []
      }

      // 保存到本地缓存
      this.store.write(data)
      return data
    } catch (error) {
      console.error('[AnalyticsService] 从后端获取数据失败:', error)

      // 后端获取失败，尝试返回本地缓存
      const cachedData = this.store.read()
      if (cachedData && (cachedData.totalFollowers > 0 || cachedData.totalPosts > 0)) {
        console.log('[AnalyticsService] 使用本地缓存数据')
        return cachedData
      }

      // 没有缓存数据，返回默认数据
      return this.getDefaultData()
    }
  }

  /**
   * 从 MCP 刷新数据并上报到后端
   */
  async refreshFromMcp(): Promise<AnalyticsData> {
    try {
      // 1. 从 MCP 获取最新数据
      const xhsStats = await xhsAnalyticsService.getCurrentUserStats(true)

      if (!xhsStats) {
        throw new Error('无法从小红书获取数据')
      }

      // 2. 计算总浏览量（基于笔记数的估算）
      const totalViews = xhsStats.notesList.reduce((sum, note) => {
        return sum + note.likes * 10
      }, 0)

      // 3. 计算总评论数和分享数
      const totalComments = xhsStats.notesList.reduce((sum, note) => sum + note.comments, 0)
      const totalShares = xhsStats.notesList.reduce((sum, note) => sum + note.shares, 0)

      // 4. 上报到后端
      await apiClient.refreshAnalytics({
        platform: 'xiaohongshu',
        followers: xhsStats.followers,
        posts: xhsStats.notes,
        views: totalViews,
        likes: xhsStats.likes,
        comments: totalComments,
        shares: totalShares
      })

      const data: AnalyticsData = {
        totalFollowers: xhsStats.followers,
        totalPosts: xhsStats.notes,
        totalViews: totalViews,
        totalLikes: xhsStats.likes,
        totalComments: totalComments,
        totalShares: totalShares,
        dailyStats: []
      }

      // 5. 保存到本地缓存
      this.store.write(data)

      return data
    } catch (error) {
      // 如果是未配置 userId，先尝试自动同步平台账号再重试一次
      if (error instanceof Error && error.message === 'USER_ID_NOT_CONFIGURED') {
        try {
          const { platformService } = await import('../platform/platform-service')
          await platformService.syncXiaohongshuLogin()

          const retryStats = await xhsAnalyticsService.getCurrentUserStats(true)
          if (retryStats) {
            const totalViews = retryStats.notesList.reduce((sum, note) => sum + note.likes * 10, 0)
            const totalComments = retryStats.notesList.reduce((sum, note) => sum + note.comments, 0)
            const totalShares = retryStats.notesList.reduce((sum, note) => sum + note.shares, 0)

            await apiClient.refreshAnalytics({
              platform: 'xiaohongshu',
              followers: retryStats.followers,
              posts: retryStats.notes,
              views: totalViews,
              likes: retryStats.likes,
              comments: totalComments,
              shares: totalShares
            })

            const retryData: AnalyticsData = {
              totalFollowers: retryStats.followers,
              totalPosts: retryStats.notes,
              totalViews,
              totalLikes: retryStats.likes,
              totalComments,
              totalShares,
              dailyStats: []
            }

            this.store.write(retryData)
            return retryData
          }
        } catch (syncError) {
          console.log('[AnalyticsService] 自动同步 userId 失败:', syncError)
        }

        console.log('[AnalyticsService] userId未配置，返回默认数据')
        throw new Error('USER_ID_NOT_CONFIGURED')
      }

      // 如果是未登录错误，向上抛出让前端处理
      if (error instanceof Error && error.message === 'NOT_LOGGED_IN') {
        throw error
      }

      console.error('[AnalyticsService] 刷新数据失败:', error)
      throw error
    }
  }

  private getDefaultData(): AnalyticsData {
    return {
      totalFollowers: 0,
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      dailyStats: []
    }
  }

  async getDailyStats(startDate: string, endDate: string): Promise<DailyStats[]> {
    const data = this.store.read()
    if (!data || !data.dailyStats) {
      return []
    }

    return data.dailyStats.filter(stat => {
      return stat.date >= startDate && stat.date <= endDate
    })
  }

  async updateStats(stats: Partial<AnalyticsData>): Promise<void> {
    const current = this.store.read() || {
      totalFollowers: 0,
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      dailyStats: []
    }

    const updated = { ...current, ...stats }
    this.store.write(updated)
  }

  async addDailyStats(stat: DailyStats): Promise<void> {
    const data = this.store.read() || {
      totalFollowers: 0,
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      dailyStats: []
    }

    // 检查是否已存在该日期的数据
    const existingIndex = data.dailyStats.findIndex(s => s.date === stat.date)
    if (existingIndex >= 0) {
      data.dailyStats[existingIndex] = stat
    } else {
      data.dailyStats.push(stat)
    }

    // 按日期排序
    data.dailyStats.sort((a, b) => a.date.localeCompare(b.date))

    this.store.write(data)
  }
}

export const analyticsService = new AnalyticsService()
