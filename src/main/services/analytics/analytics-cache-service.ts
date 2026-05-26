import { join } from 'node:path'
import { getDataDir } from '../../utils/paths'
import { loadJson, saveJson } from '../../utils/file-utils'
import type { XhsUserStats } from './xhs-analytics-service'

interface CacheEntry {
  data: XhsUserStats
  timestamp: number
  expiresAt: number
}

/**
 * 数据分析缓存服务
 * 缓存小红书用户统计数据，避免频繁请求
 */
export class AnalyticsCacheService {
  private cacheFile: string
  private cacheDuration: number // 缓存有效期（毫秒）

  constructor(cacheDuration = 30 * 60 * 1000) {
    // 默认缓存30分钟
    this.cacheFile = join(getDataDir(), 'cache', 'analytics.json')
    this.cacheDuration = cacheDuration
  }

  /**
   * 获取缓存的数据
   */
  async get(userId: string): Promise<XhsUserStats | null> {
    try {
      const cache = loadJson<Record<string, CacheEntry>>(this.cacheFile)
      const entry = cache[userId]

      if (!entry) {
        return null
      }

      // 检查是否过期
      if (Date.now() > entry.expiresAt) {
        console.log('[AnalyticsCache] 缓存已过期')
        return null
      }

      console.log('[AnalyticsCache] 使用缓存数据')
      return entry.data
    } catch (error) {
      console.log('[AnalyticsCache] 读取缓存失败，将重新获取数据')
      return null
    }
  }

  /**
   * 保存数据到缓存
   */
  async set(userId: string, data: XhsUserStats): Promise<void> {
    try {
      let cache: Record<string, CacheEntry> = {}

      try {
        cache = loadJson<Record<string, CacheEntry>>(this.cacheFile)
      } catch {
        // 缓存文件不存在或损坏，使用空对象
      }

      const now = Date.now()
      cache[userId] = {
        data,
        timestamp: now,
        expiresAt: now + this.cacheDuration
      }

      saveJson(this.cacheFile, cache)
      console.log('[AnalyticsCache] 数据已缓存')
    } catch (error) {
      console.error('[AnalyticsCache] 保存缓存失败:', error)
    }
  }

  /**
   * 清除指定用户的缓存
   */
  async clear(userId: string): Promise<void> {
    try {
      const cache = loadJson<Record<string, CacheEntry>>(this.cacheFile)
      delete cache[userId]
      saveJson(this.cacheFile, cache)
      console.log('[AnalyticsCache] 缓存已清除')
    } catch (error) {
      console.error('[AnalyticsCache] 清除缓存失败:', error)
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAll(): Promise<void> {
    try {
      saveJson(this.cacheFile, {})
      console.log('[AnalyticsCache] 所有缓存已清除')
    } catch (error) {
      console.error('[AnalyticsCache] 清除所有缓存失败:', error)
    }
  }

  /**
   * 检查缓存是否有效
   */
  async isValid(userId: string): Promise<boolean> {
    const data = await this.get(userId)
    return data !== null
  }
}

export const analyticsCacheService = new AnalyticsCacheService()
