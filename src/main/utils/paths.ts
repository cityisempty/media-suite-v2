import { app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * 获取二进制文件目录
 * 开发环境: 项目根目录/tools/bin
 * 生产环境: process.resourcesPath/tools/bin
 */
export function getBinDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'tools', 'bin')
  }
  return join(app.getAppPath(), 'tools', 'bin')
}

/**
 * 获取用户数据目录（cookies、历史等）
 * 使用项目根目录，与 MCP 保持一致
 */
export function getDataDir(): string {
  // 开发环境：使用项目根目录
  if (!app.isPackaged) {
    return app.getAppPath()
  }
  // 生产环境：使用 userData 目录
  return app.getPath('userData')
}

/**
 * Cookie 文件路径
 */
export function getCookiePath(): string {
  return join(getDataDir(), 'cookies.json')
}

/**
 * 发布历史文件路径
 */
export function getHistoryPath(): string {
  return join(getDataDir(), 'publish-history.json')
}

/**
 * 获取下载临时目录
 */
export function getDownloadDir(): string {
  return join(getDataDir(), 'downloads')
}

/**
 * 根据当前平台自动解析对应的二进制文件路径
 * 命名规则: {baseName}-{platform}-{arch}[.exe]
 * 例如: xiaohongshu-mcp-darwin-arm64, xiaohongshu-mcp-win-x64.exe
 */
export function resolvePlatformBinary(baseName: string): string {
  let filename: string

  if (process.platform === 'win32') {
    // Windows: 固定使用 windows-amd64
    filename = `${baseName}-windows-amd64.exe`
  } else {
    // macOS/Linux: 使用实际平台和架构
    const arch = process.arch === 'arm64' ? 'arm64' : process.arch
    filename = `${baseName}-${process.platform}-${arch}`
  }

  const fullPath = join(getBinDir(), filename)

  if (!existsSync(fullPath)) {
    throw new Error(
      `缺少二进制文件: ${filename}\n` +
      `请从 Releases 下载对应版本。`
    )
  }

  return fullPath
}
