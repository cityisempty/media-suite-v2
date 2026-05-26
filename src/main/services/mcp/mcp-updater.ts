import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { rename, unlink, mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { getBinDir, getDownloadDir, getDataDir } from '../../utils/paths'
import { apiClient } from '../server'
import { mcpServiceManager } from './mcp-service-manager'
import { log } from '../../utils/logger'

interface LocalVersionInfo {
  version: string
  updatedAt: string
}

interface LocalVersions {
  [key: string]: LocalVersionInfo
}

const BINARY_NAMES = ['xiaohongshu-mcp', 'xiaohongshu-login']

/**
 * MCP 二进制自动更新服务
 */
class McpUpdater {
  private updating = false

  /**
   * 获取本地版本文件路径
   */
  private getVersionPath(): string {
    return join(getDataDir(), 'mcp-version.json')
  }

  /**
   * 读取本地版本信息
   */
  private async getLocalVersions(): Promise<LocalVersions> {
    try {
      const path = this.getVersionPath()
      if (existsSync(path)) {
        const data = await readFile(path, 'utf-8')
        return JSON.parse(data)
      }
    } catch (e: any) {
      log.warn('[McpUpdater] 读取本地版本文件失败:', e.message)
    }
    return {}
  }

  /**
   * 保存本地版本信息
   */
  private async saveLocalVersions(versions: LocalVersions): Promise<void> {
    const path = this.getVersionPath()
    await writeFile(path, JSON.stringify(versions, null, 2), 'utf-8')
  }

  /**
   * 获取当前平台标识
   */
  private getPlatformKey(): string {
    if (process.platform === 'win32') return 'windows-amd64'
    const arch = process.arch === 'arm64' ? 'arm64' : process.arch
    return `${process.platform}-${arch}`
  }

  /**
   * 获取二进制文件名
   */
  private getBinaryFilename(baseName: string): string {
    if (process.platform === 'win32') return `${baseName}-windows-amd64.exe`
    const arch = process.arch === 'arm64' ? 'arm64' : process.arch
    return `${baseName}-${process.platform}-${arch}`
  }

  /**
   * 比较版本号 (语义化版本)
   * 返回: -1 (a < b), 0 (a === b), 1 (a > b)
   */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0
      const nb = pb[i] || 0
      if (na > nb) return 1
      if (na < nb) return -1
    }
    return 0
  }

  /**
   * 计算文件 SHA256
   */
  private async sha256File(filePath: string): Promise<string> {
    const buffer = await readFile(filePath)
    return createHash('sha256').update(buffer).digest('hex')
  }

  /**
   * 下载文件到临时路径
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载失败: HTTP ${response.status}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(destPath, buffer)
  }

  /**
   * 检查并更新单个二进制
   */
  private async updateBinary(
    baseName: string,
    manifest: { version: string; platforms: Record<string, { url: string; sha256: string }> },
    localVersions: LocalVersions
  ): Promise<boolean> {
    const platformKey = this.getPlatformKey()
    const localInfo = localVersions[baseName]
    const localVersion = localInfo?.version || '0.0.0'

    // 检查是否有新版本
    if (this.compareVersions(manifest.version, localVersion) <= 0) {
      log.info(`[McpUpdater] ${baseName} 已是最新版本: ${localVersion}`)
      return false
    }

    // 检查是否有当前平台的二进制
    const platformInfo = manifest.platforms[platformKey]
    if (!platformInfo) {
      log.warn(`[McpUpdater] ${baseName} 没有 ${platformKey} 平台的二进制`)
      return false
    }

    log.info(`[McpUpdater] 发现 ${baseName} 新版本: ${localVersion} → ${manifest.version}`)

    // 创建下载目录
    const downloadDir = getDownloadDir()
    await mkdir(downloadDir, { recursive: true })

    // 下载到临时文件
    const tmpPath = join(downloadDir, `${this.getBinaryFilename(baseName)}.tmp`)
    log.info(`[McpUpdater] 下载 ${baseName}...`)
    await this.downloadFile(platformInfo.url, tmpPath)

    // 校验 SHA256
    const actualSha256 = await this.sha256File(tmpPath)
    if (actualSha256 !== platformInfo.sha256) {
      log.error(`[McpUpdater] ${baseName} SHA256 校验失败: 期望 ${platformInfo.sha256}, 实际 ${actualSha256}`)
      await unlink(tmpPath).catch(() => {})
      return false
    }
    log.info(`[McpUpdater] ${baseName} SHA256 校验通过`)

    // 停止 MCP 服务
    log.info(`[McpUpdater] 停止 MCP 服务...`)
    await mcpServiceManager.shutdown().catch(() => {})

    // 替换二进制文件
    const targetPath = join(getBinDir(), this.getBinaryFilename(baseName))
    log.info(`[McpUpdater] 替换 ${baseName}: ${targetPath}`)

    try {
      // 如果目标文件存在，先删除（Windows 上 rename 不能覆盖已存在的文件）
      if (existsSync(targetPath)) {
        await unlink(targetPath)
      }
      await rename(tmpPath, targetPath)
    } catch (e: any) {
      log.error(`[McpUpdater] 替换 ${baseName} 失败:`, e.message)
      // 清理临时文件
      await unlink(tmpPath).catch(() => {})
      return false
    }

    // 更新本地版本记录
    localVersions[baseName] = {
      version: manifest.version,
      updatedAt: new Date().toISOString()
    }
    await this.saveLocalVersions(localVersions)

    log.info(`[McpUpdater] ${baseName} 更新完成: ${manifest.version}`)
    return true
  }

  /**
   * 检查并执行更新
   */
  async checkAndUpdate(): Promise<void> {
    if (this.updating) {
      log.info('[McpUpdater] 更新正在进行中，跳过')
      return
    }

    this.updating = true
    let anyUpdated = false

    try {
      log.info('[McpUpdater] 开始检查 MCP 二进制更新...')

      // 获取服务器端版本清单
      const manifest = await apiClient.getMcpBinaryManifest()
      if (!manifest || Object.keys(manifest).length === 0) {
        log.info('[McpUpdater] 服务器无版本清单')
        return
      }

      const localVersions = await this.getLocalVersions()

      // 检查每个二进制
      for (const baseName of BINARY_NAMES) {
        const binaryManifest = manifest[baseName]
        if (!binaryManifest) {
          log.info(`[McpUpdater] 服务器无 ${baseName} 版本信息`)
          continue
        }

        try {
          const updated = await this.updateBinary(baseName, binaryManifest, localVersions)
          if (updated) anyUpdated = true
        } catch (e: any) {
          log.error(`[McpUpdater] 更新 ${baseName} 失败:`, e.message)
        }
      }

      // 如果有任何更新，重启 MCP 服务
      if (anyUpdated) {
        log.info('[McpUpdater] 有二进制更新，重启 MCP 服务...')
        try {
          await mcpServiceManager.getClient()
          log.info('[McpUpdater] MCP 服务重启成功')
        } catch (e: any) {
          log.error('[McpUpdater] MCP 服务重启失败:', e.message)
        }
      } else {
        log.info('[McpUpdater] 所有二进制均为最新版本')
      }
    } catch (e: any) {
      log.error('[McpUpdater] 更新检查失败:', e.message)
    } finally {
      this.updating = false
    }
  }
}

// 单例
export const mcpUpdater = new McpUpdater()
