import { contentService } from '../content/content-service'
import { analyticsService } from '../analytics/analytics-service'
import { personaService } from '../persona/persona-service'
import type { Content } from '../../../../packages/shared/src/types'

/**
 * Mock 数据生成器
 * 用于模拟服务器推送的物料包
 */
export class MockDataGenerator {
  private titles = [
    '如何管理情绪？3个实用技巧分享',
    '心理学小知识：了解自己的情绪模式',
    '焦虑时该怎么办？试试这些方法',
    '建立良好人际关系的5个原则',
    '自我成长：从接纳自己开始',
    '压力大？这些放松技巧帮你缓解',
    '如何提升自信心？心理学视角解析',
    '情绪调节的艺术：学会与情绪共处'
  ]

  private bodies = [
    '今天和大家分享一些实用的心理学技巧...\n\n1. 觉察自己的情绪\n2. 接纳当下的感受\n3. 采取积极的行动\n\n希望对你有帮助！',
    '很多人问我如何管理情绪，其实情绪管理的第一步是...\n\n记住：情绪没有好坏，关键是如何应对。\n\n#心理学 #情绪管理',
    '分享一个心理学小技巧：\n\n当你感到焦虑时，试着深呼吸，专注于当下。\n\n这个方法简单但很有效，建议收藏！',
    '今天想和大家聊聊人际关系...\n\n良好的关系建立在相互理解和尊重的基础上。\n\n你觉得呢？'
  ]

  private tags = [
    ['心理学', '情绪管理', '自我成长'],
    ['心理健康', '焦虑', '压力管理'],
    ['人际关系', '沟通技巧', '社交'],
    ['自信', '自我接纳', '心理学'],
    ['情绪调节', '心理技巧', '实用干货']
  ]

  /**
   * 生成随机内容
   */
  async generateContent(daysOffset: number = 0): Promise<Omit<Content, 'id' | 'createdAt' | 'updatedAt'>> {
    const now = Date.now()
    const scheduledAt = now + daysOffset * 24 * 60 * 60 * 1000
    const activePersona = await personaService.getActivePersona()

    return {
      title: this.randomItem(this.titles),
      body: this.randomItem(this.bodies),
      images: [],
      tags: this.randomItem(this.tags),
      platform: 'xiaohongshu',
      status: 'draft',
      scheduledAt,
      personaId: activePersona?.id || 'persona-default'
    }
  }

  /**
   * 生成多条内容
   */
  async generateMultipleContents(count: number = 7): Promise<void> {
    console.log(`Generating ${count} mock contents...`)

    for (let i = 0; i < count; i++) {
      const content = await this.generateContent(i - 3)
      await contentService.receiveContent(content)
    }

    console.log('Mock contents generated successfully')
  }

  /**
   * 生成随机图片 URL
   */
  private generateImages(): string[] {
    const count = Math.floor(Math.random() * 3) + 1 // 1-3张图片
    const images: string[] = []

    for (let i = 0; i < count; i++) {
      const width = 800
      const height = 600
      images.push(`https://picsum.photos/${width}/${height}?random=${Date.now()}-${i}`)
    }

    return images
  }

  /**
   * 随机选择数组中的一项
   */
  private randomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }
}

// 单例
export const mockDataGenerator = new MockDataGenerator()

/**
 * 生成 Mock 数据（仅在开发模式下）
 */
export async function generateMockData(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    try {
      const contents = await contentService.listContents()
      if (contents.length === 0) {
        await mockDataGenerator.generateMultipleContents(7)
      }

      // 生成分析数据
      await generateAnalyticsData()
    } catch (error) {
      console.error('Failed to generate mock data:', error)
    }
  }
}

/**
 * 生成分析数据
 */
async function generateAnalyticsData(): Promise<void> {
  const dailyStats = []
  let followers = 1000
  let totalViews = 0
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0
  let totalPosts = 0

  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    // 模拟增长
    followers += Math.floor(Math.random() * 50)
    const posts = Math.floor(Math.random() * 3)
    const views = Math.floor(Math.random() * 500) + 200
    const likes = Math.floor(Math.random() * 100) + 50
    const comments = Math.floor(Math.random() * 30) + 10
    const shares = Math.floor(Math.random() * 20) + 5

    totalPosts += posts
    totalViews += views
    totalLikes += likes
    totalComments += comments
    totalShares += shares

    dailyStats.push({
      date: dateStr,
      followers,
      posts,
      views,
      likes,
      comments,
      shares
    })
  }

  await analyticsService.updateStats({
    totalFollowers: followers,
    totalPosts,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    dailyStats
  })
}
