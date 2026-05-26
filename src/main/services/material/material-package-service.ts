import { join } from 'node:path'
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { getDataDir } from '../../utils/paths'
import type { Content, ContentImage } from '../../../../packages/shared/src/types'
import { materialSyncStateService } from './material-sync-state'
import { personaService } from '../persona/persona-service'
import { log } from '../../utils/logger'

/**
 * 物料包元数据
 */
export interface MaterialMetadata {
  title: string
  body: string
  tags: string[]
  platform: string
  scheduledAt: number
  images: string[] // 相对路径，如 "./image-1.jpg"
  visibility?: string
}

/**
 * 物料包信息
 */
export interface MaterialPackage {
  id: string // 物料包ID，如 "2026-04-20/post-001"
  path: string // 物料包绝对路径
  metadata: MaterialMetadata
  imageFiles: string[] // 图片文件的绝对路径
  createdAt: number
}

/**
 * 物料包服务
 * 管理本地物料包的扫描、解析和读取
 */
export class MaterialPackageService {
  private materialsDir: string

  constructor() {
    this.materialsDir = join(getDataDir(), 'materials')
  }

  /**
   * 获取物料包根目录
   */
  getMaterialsDir(): string {
    return this.materialsDir
  }

  /**
   * 扫描所有物料包
   * 按日期目录组织：materials/2026-04-20/post-001/
   */
  async scanAllPackages(): Promise<MaterialPackage[]> {
    const packages: MaterialPackage[] = []

    try {
      // 读取日期目录
      const dateDirs = await readdir(this.materialsDir)

      for (const dateDir of dateDirs) {
        const datePath = join(this.materialsDir, dateDir)
        const dateStat = await stat(datePath)

        if (!dateStat.isDirectory()) continue

        // 读取该日期下的所有物料包
        const postDirs = await readdir(datePath)

        for (const postDir of postDirs) {
          const postPath = join(datePath, postDir)
          const postStat = await stat(postPath)

          if (!postStat.isDirectory()) continue

          try {
            const pkg = await this.loadPackage(dateDir, postDir)
            packages.push(pkg)
          } catch (error) {
            log.error(`Failed to load package ${dateDir}/${postDir}:`, error)
          }
        }
      }
    } catch (error) {
      log.error('Failed to scan material packages:', error)
    }

    return packages
  }

  /**
   * 加载单个物料包
   */
  async loadPackage(dateDir: string, postDir: string): Promise<MaterialPackage> {
    const packagePath = join(this.materialsDir, dateDir, postDir)
    const metadataPath = join(packagePath, 'metadata.json')

    // 读取元数据
    const metadataContent = await readFile(metadataPath, 'utf-8')
    const metadata: MaterialMetadata = JSON.parse(metadataContent)

    // 解析图片文件路径
    const imageFiles: string[] = []
    for (const relPath of metadata.images) {
      // 移除 "./" 前缀
      const cleanPath = relPath.replace(/^\.\//, '')
      const absolutePath = join(packagePath, cleanPath)
      imageFiles.push(absolutePath)
    }

    // 获取创建时间
    const packageStat = await stat(packagePath)

    return {
      id: `${dateDir}/${postDir}`,
      path: packagePath,
      metadata,
      imageFiles,
      createdAt: packageStat.birthtimeMs
    }
  }

  /**
   * 将物料包转换为 Content 对象
   */
  async packageToContent(pkg: MaterialPackage): Promise<Omit<Content, 'id' | 'createdAt' | 'updatedAt'>> {
    const displayImages = pkg.imageFiles.map(p => {
      // Windows 路径需要转换为 local-file:///C:/path 格式
      const normalized = p.replace(/\\/g, '/')
      if (/^[A-Za-z]:/.test(normalized)) {
        return `local-file:///${normalized}`
      }
      return `local-file://${normalized}`
    })
    const activePersona = await personaService.getActivePersona()

    return {
      title: pkg.metadata.title,
      body: pkg.metadata.body,
      tags: pkg.metadata.tags,
      images: displayImages,
      platform: pkg.metadata.platform,
      status: 'pending',
      scheduledAt: pkg.metadata.scheduledAt,
      personaId: activePersona?.id || 'persona-default'
    }
  }

  /**
   * 批量导入物料包到内容管理（增量同步）
   */
  async importPackagesToContents(): Promise<{ imported: number; skipped: number }> {
    const packages = await this.scanAllPackages()
    const { contentService } = await import('../content/content-service')

    let importedCount = 0
    let skippedCount = 0

    for (const pkg of packages) {
      try {
        // 检查是否已同步
        if (materialSyncStateService.isSynced(pkg.id, pkg.createdAt)) {
          log.info(`Skipped already synced package: ${pkg.id}`)
          skippedCount++
          continue
        }

        // 导入内容
        const contentData = await this.packageToContent(pkg)
        const content = await contentService.receiveContent(contentData)

        // 记录同步状态
        materialSyncStateService.recordSync(pkg.id, content.id, pkg.createdAt)

        importedCount++
        log.info(`Imported package: ${pkg.id} -> content: ${content.id}`)
      } catch (error) {
        log.error(`Failed to import package ${pkg.id}:`, error)
      }
    }

    return { imported: importedCount, skipped: skippedCount }
  }

  /**
   * 强制重新同步所有物料包
   */
  async forceResyncAll(): Promise<number> {
    materialSyncStateService.clearAll()
    const result = await this.importPackagesToContents()
    return result.imported
  }

  /**
   * 从服务器同步物料包
   */
  async syncFromServer(): Promise<{ imported: number; skipped: number }> {
    const { apiClient } = await import('../server')

    try {
      // 先从服务器获取可用的物料包列表
      const response = await apiClient.getMaterialPackages()

      if (!response || response.length === 0) {
        const packages = await this.scanAllPackages()
        log.info(`[MaterialPackageService] 服务器暂无新物料包，本地已有 ${packages.length} 个物料包`)
        return { imported: 0, skipped: packages.length }
      }

      log.info(`[MaterialPackageService] 服务器有 ${response.length} 个可用物料包`)

      // 下载并导入新的物料包
      const { contentService } = await import('../content/content-service')
      const { autoPublishService } = await import('../publish/auto-publish-service')

      // 获取已有内容，用于去重
      const existingContents = await contentService.listContents()
      const syncedPackageIds = new Set(
        existingContents
          .filter(c => c.source === 'server_generated')
          .map(c => c.userId)
      )

      let importedCount = 0
      let skippedCount = 0

      for (const pkg of response) {
        try {
          // 检查本地是否已有该物料包的内容
          if (syncedPackageIds.has(pkg.id.toString())) {
            log.info(`[MaterialPackageService] 跳过已同步的物料包: ${pkg.id}`)
            skippedCount++
            continue
          }

          log.info(`[MaterialPackageService] 下载物料包 ${pkg.id}...`)
          const downloadData = await apiClient.downloadMaterialPackage(pkg.id)

          if (!downloadData) {
            log.error(`[MaterialPackageService] 下载物料包 ${pkg.id} 失败`)
            continue
          }

          const pkgData = downloadData
          const date = pkgData.generation_date
          const imageDir = join(getDataDir(), 'materials', date)
          await mkdir(imageDir, { recursive: true })

          const images: ContentImage[] = []
          const imagesList = Array.isArray(pkgData.images) ? pkgData.images : Object.values(pkgData.images || {})
          for (const item of imagesList) {
            try {
              if (!item.url) {
                log.info(`[MaterialPackageService] 图片 ${item.id} 无 URL，跳过`)
                continue
              }
              const fileName = `${pkg.id}_${item.id}_${item.order}.png`
              const localPath = join(imageDir, fileName)
              await this.downloadImage(item.url, localPath)
              images.push({
                id: `img-${item.id}`,
                localPath,
                isCover: item.page_type === 'cover'
              })
              log.info(`[MaterialPackageService] 图片 ${item.id} 已下载`)
            } catch (e: any) {
              log.error(`[MaterialPackageService] 图片 ${item.id} 下载失败:`, e.message)
            }
          }

          if (images.length === 0) {
            log.error(`[MaterialPackageService] 物料包 ${pkg.id} 没有成功下载的图片，跳过`)
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

          // 记录同步状态
          materialSyncStateService.recordSync(
            pkg.id.toString(),
            content.id,
            pkg.updated_at || pkg.created_at || Date.now()
          )

          log.info(`[MaterialPackageService] 物料包 ${pkg.id} 已转为内容 ${content.id}`)

          await autoPublishService.handleNewContent(content)
          importedCount++
        } catch (e: any) {
          log.error(`[MaterialPackageService] 处理物料包 ${pkg.id} 失败:`, e.message)
        }
      }

      log.info(`[MaterialPackageService] 同步完成，共导入 ${importedCount} 个物料包`)
      return { imported: importedCount, skipped: skippedCount }
    } catch (error: any) {
      log.error('[MaterialPackageService] 同步失败:', error.message, 'status:', error.status)

      if (error.message?.includes('暂无可用物料包') || error.status === 404) {
        const packages = await this.scanAllPackages()
        return { imported: 0, skipped: packages.length }
      }

      throw error
    }
  }

  /**
   * 下载图片
   */
  private async downloadImage(url: string, savePath: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载图片失败: HTTP ${response.status}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(savePath, buffer)
  }
}

// 单例
export const materialPackageService = new MaterialPackageService()
