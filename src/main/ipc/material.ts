import { ipcMain } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { authService } from '../services/auth/auth-service'
import { serverConfig } from '../services/server/server-config'
import { contentService } from '../services/content/content-service'
import { autoPublishService } from '../services/publish/auto-publish-service'
import { getDataDir } from '../utils/paths'
import type { ContentImage } from '../../../packages/shared/src/types'

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = authService.getAccessToken()
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const response = await fetch(`${serverConfig.baseUrl}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || error.error || `HTTP ${response.status}`)
  }
  return response
}

async function downloadImage(url: string, savePath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`下载图片失败: HTTP ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(savePath, buffer)
}

export function registerMaterialHandlers(): void {
  ipcMain.handle('material:sync', async () => {
    try {
      console.log('[Material] 开始同步物料...')

      // 按日期查询（今天+昨天），/latest 端点不可靠
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]

      const allPackages: any[] = []
      for (const date of [today, yesterday]) {
        try {
          const res = await apiRequest(`/materials?date=${date}`)
          const data = await res.json()
          if (data.success && data.data?.length) {
            allPackages.push(...data.data)
          }
        } catch (e: any) {
          console.error(`[Material] 查询 ${date} 物料失败:`, e.message)
        }
      }

      if (allPackages.length === 0) {
        console.log('[Material] 没有新的物料包')
        return { success: true, data: { imported: 0, skipped: 0 }, message: '没有新的物料包' }
      }

      // 去重：检查已有内容，跳过已同步的物料包
      const existingContents = await contentService.listContents()
      const syncedPackageIds = new Set(
        existingContents
          .filter((c: any) => c.source === 'server_generated')
          .map((c: any) => c.userId)
      )

      const packages = allPackages.filter((pkg: any) => !syncedPackageIds.has(pkg.id.toString()))
      const skippedCount = allPackages.length - packages.length

      if (packages.length === 0) {
        console.log(`[Material] 所有 ${allPackages.length} 个物料包均已同步，跳过`)
        return { success: true, data: { imported: 0, skipped: skippedCount }, message: '物料包均已同步' }
      }

      console.log(`[Material] 发现 ${packages.length} 个新物料包（跳过 ${skippedCount} 个已同步）`)

      let synced = 0

      for (const pkg of packages) {
        try {
          console.log(`[Material] 下载物料包 ${pkg.id}...`)
          const downloadRes = await apiRequest(`/materials/${pkg.id}/download`)
          const downloadData = await downloadRes.json()

          if (!downloadData.success || !downloadData.data) {
            console.error(`[Material] 下载物料包 ${pkg.id} 失败`)
            continue
          }

          const pkgData = downloadData.data
          const date = pkgData.generation_date
          const imageDir = join(getDataDir(), 'materials', date)
          await mkdir(imageDir, { recursive: true })

          const images: ContentImage[] = []
          const imagesList = Array.isArray(pkgData.images) ? pkgData.images : Object.values(pkgData.images || {})
          for (const item of imagesList) {
            try {
              if (!item.url) {
                console.log(`[Material] 图片 ${item.id} 无 URL，跳过`)
                continue
              }
              const fileName = `${pkg.id}_${item.id}_${item.order}.png`
              const localPath = join(imageDir, fileName)
              await downloadImage(item.url, localPath)
              images.push({
                id: `img-${item.id}`,
                localPath,
                isCover: item.page_type === 'cover'
              })
              console.log(`[Material] 图片 ${item.id} 已下载`)
            } catch (e: any) {
              console.error(`[Material] 图片 ${item.id} 下载失败:`, e.message)
            }
          }

          if (images.length === 0) {
            console.error(`[Material] 物料包 ${pkg.id} 没有成功下载的图片，跳过`)
            continue
          }

          const copywriting = pkgData.copywriting || {}
          const titles = copywriting.titles || []
          const title = titles[0] || pkgData.custom_topic || `${date} 物料`
          const body = copywriting.copywriting || ''
          const tags: string[] = (copywriting.tags || []).map((t: string) =>
            t.startsWith('#') ? t.slice(1) : t
          )

          const content = await contentService.receiveContent({
            userId: String(pkg.id),
            source: 'server_generated',
            title,
            body,
            tags,
            images,
            platform: 'xiaohongshu',
            targetPlatform: 'xiaohongshu',
            visibility: '公开可见',
            status: 'pending',
            scheduledAt: Date.now()
          })

          console.log(`[Material] 物料包 ${pkg.id} 已转为内容 ${content.id}`)

          await autoPublishService.handleNewContent(content)
          synced++
        } catch (e: any) {
          console.error(`[Material] 处理物料包 ${pkg.id} 失败:`, e.message)
        }
      }

      console.log(`[Material] 同步完成，共 ${synced} 个物料包，跳过 ${skippedCount} 个`)
      return { success: true, data: { imported: synced, skipped: skippedCount }, message: `成功同步 ${synced} 个物料包` }
    } catch (error: any) {
      console.error('[Material] 同步失败:', error.message)
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('material:syncByDate', async (_event, date: string) => {
    try {
      console.log(`[Material] 开始同步 ${date} 的物料...`)

      const latestRes = await apiRequest(`/materials?date=${date}`)
      const latestData = await latestRes.json()

      if (!latestData.success || !latestData.data?.length) {
        console.log(`[Material] ${date} 没有物料包`)
        return { success: true, data: { imported: 0, skipped: 0 }, message: '该日期没有物料包' }
      }

      // 去重：检查已有内容，跳过已同步的物料包
      const existingContents = await contentService.listContents()
      const syncedPackageIds = new Set(
        existingContents
          .filter((c: any) => c.source === 'server_generated')
          .map((c: any) => c.userId)
      )

      const allPackages = latestData.data
      const packages = allPackages.filter((pkg: any) => !syncedPackageIds.has(pkg.id.toString()))
      const skippedCount = allPackages.length - packages.length

      if (packages.length === 0) {
        console.log(`[Material] ${date} 所有物料包均已同步，跳过`)
        return { success: true, data: { imported: 0, skipped: skippedCount }, message: '该日期物料包均已同步' }
      }

      console.log(`[Material] ${date} 发现 ${packages.length} 个新物料包（跳过 ${skippedCount} 个已同步）`)

      let synced = 0

      for (const pkg of packages) {
        try {
          console.log(`[Material] 下载物料包 ${pkg.id}...`)
          const downloadRes = await apiRequest(`/materials/${pkg.id}/download`)
          const downloadData = await downloadRes.json()

          if (!downloadData.success || !downloadData.data) {
            console.error(`[Material] 下载物料包 ${pkg.id} 失败`)
            continue
          }

          const pkgData = downloadData.data
          const pkgDate = pkgData.generation_date
          const imageDir = join(getDataDir(), 'materials', pkgDate)
          await mkdir(imageDir, { recursive: true })

          const images: ContentImage[] = []
          const imagesList = Array.isArray(pkgData.images) ? pkgData.images : Object.values(pkgData.images || {})
          for (const item of imagesList) {
            try {
              if (!item.url) {
                console.log(`[Material] 图片 ${item.id} 无 URL，跳过`)
                continue
              }
              const fileName = `${pkg.id}_${item.id}_${item.order}.png`
              const localPath = join(imageDir, fileName)
              await downloadImage(item.url, localPath)
              images.push({
                id: `img-${item.id}`,
                localPath,
                isCover: item.page_type === 'cover'
              })
              console.log(`[Material] 图片 ${item.id} 已下载`)
            } catch (e: any) {
              console.error(`[Material] 图片 ${item.id} 下载失败:`, e.message)
            }
          }

          if (images.length === 0) {
            console.error(`[Material] 物料包 ${pkg.id} 没有成功下载的图片，跳过`)
            continue
          }

          const copywriting = pkgData.copywriting || {}
          const titles = copywriting.titles || []
          const title = titles[0] || pkgData.custom_topic || `${pkgDate} 物料`
          const body = copywriting.copywriting || ''
          const tags: string[] = (copywriting.tags || []).map((t: string) =>
            t.startsWith('#') ? t.slice(1) : t
          )

          const content = await contentService.receiveContent({
            userId: String(pkg.id),
            source: 'server_generated',
            title,
            body,
            tags,
            images,
            platform: 'xiaohongshu',
            targetPlatform: 'xiaohongshu',
            visibility: '公开可见',
            status: 'pending',
            scheduledAt: Date.now()
          })

          console.log(`[Material] 物料包 ${pkg.id} 已转为内容 ${content.id}`)

          await autoPublishService.handleNewContent(content)
          synced++
        } catch (e: any) {
          console.error(`[Material] 处理物料包 ${pkg.id} 失败:`, e.message)
        }
      }

      console.log(`[Material] ${date} 同步完成，共 ${synced} 个物料包，跳过 ${skippedCount} 个`)
      return { success: true, data: { imported: synced, skipped: skippedCount }, message: `成功同步 ${synced} 个物料包` }
    } catch (error: any) {
      console.error(`[Material] 同步 ${date} 失败:`, error.message)
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('material:check', async () => {
    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]

      const allPackages: any[] = []
      for (const date of [today, yesterday]) {
        const res = await apiRequest(`/materials?date=${date}`)
        const data = await res.json()
        if (data.success && data.data?.length) {
          allPackages.push(...data.data)
        }
      }

      return {
        success: true,
        count: allPackages.length,
        packages: allPackages
      }
    } catch (error: any) {
      return { success: false, error: error.message, count: 0 }
    }
  })
}
