import { app, BrowserWindow, shell, protocol, Tray, Menu, nativeImage } from 'electron'
import { log } from './utils/logger'

// 生产环境不跳过 TLS 验证
if (!app.isPackaged) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

// 防止 stdout/stderr 管道断开时崩溃（EPIPE）
// console.log 内部调用 process.stdout.write，错误是异步的，try-catch 无法捕获
// 需要直接监听 stream 的 error 事件
process.stdout.on('error', () => {})
process.stderr.on('error', () => {})
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { registerAuthHandlers } from './ipc/auth'
import { registerPersonaHandlers } from './ipc/persona'
import { registerContentHandlers } from './ipc/content'
import { registerPlatformHandlers } from './ipc/platform'
import { registerAutoPublishHandlers } from './ipc/auto-publish'
import { registerAnalyticsHandlers } from './ipc/analytics'
import { registerMonthlyTopicsHandlers } from './ipc/monthly-topics'
import { registerXhsLoginIpc } from './ipc/xhs-login'
import { registerXhsPublishIpc } from './ipc/xhs-publish'
import { registerFileDialogIpc } from './ipc/file-dialog'
import { registerMaterialHandlers } from './ipc/material'
import { autoPublishService } from './services/publish/auto-publish-service'
import { authService } from './services/auth/auth-service'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let syncInterval: NodeJS.Timeout | null = null

// 扩展 app 对象
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Ctrl+Shift+I 打开开发者工具
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
      }
    },
    {
      label: '同步物料包',
      click: async () => {
        try {
          const { materialPackageService } = await import('./services/material/material-package-service')
          await materialPackageService.syncFromServer()
        } catch (error) {
          log.error('[Tray] 同步物料包失败:', error)
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('媒体发布助手')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
  })
}

async function startAutoSync(): Promise<void> {
  const syncMaterials = async () => {
    try {
      log.info('[AutoSync] 开始自动同步物料包...')
      const { materialPackageService } = await import('./services/material/material-package-service')
      const { contentService } = await import('./services/content/content-service')
      const { personaService } = await import('./services/persona/persona-service')

      // 获取当前激活的人设和订阅信息
      const activePersona = await personaService.getActivePersona()
      if (!activePersona) {
        // 诊断：列出所有人设的状态
        const allPersonas = await personaService.listPersonas()
        log.info(`[AutoSync] 没有激活的人设，跳过同步。本地共 ${allPersonas.length} 个人设:`,
          allPersonas.map(p => ({ id: p.id, isActive: p.isActive })))
        return
      }

      log.info(`[AutoSync] 激活人设: ${activePersona.id}, isActive: ${activePersona.isActive}`)

      // 从订阅信息获取每日配额，如果没有订阅则默认为3
      const dailyQuota = activePersona.subscription?.dailyQuota || 3
      log.info(`[AutoSync] 每日配额: ${dailyQuota}`)

      // 获取今天已同步的物料包数量（只统计来自服务器的内容）
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

      const allContents = await contentService.listContents()
      const todayServerContents = allContents.filter(c =>
        c.createdAt >= todayStart && c.source === 'server_generated'
      )

      log.info(`[AutoSync] 今日已同步: ${todayServerContents.length}/${dailyQuota}`)

      if (todayServerContents.length >= dailyQuota) {
        log.info(`[AutoSync] 已达到今日配额，等待明天重置`)
        scheduleNextDayReset()
        return
      }

      // 执行同步
      const result = await materialPackageService.syncFromServer()
      log.info(`[AutoSync] 同步完成: 导入 ${result.imported} 个，跳过 ${result.skipped} 个`)

      // 同步后检查小红书登录状态
      if (result.imported > 0) {
        const { loginGuard } = await import('./services/auth/login-guard')
        await loginGuard.ensureLoggedIn('sync')
      }

      // 检查是否达到配额
      const newTodayCount = todayServerContents.length + result.imported
      if (newTodayCount >= dailyQuota) {
        log.info(`[AutoSync] 已达到今日配额 ${dailyQuota}，等待明天重置`)
        scheduleNextDayReset()
      }
    } catch (error: any) {
      log.error('[AutoSync] 自动同步失败:', error.message || error)
      if (error.status === 401) {
        log.error('[AutoSync] Token 已过期或无效，将在下次轮询时重试')
      } else if (error.status === 404) {
        log.error('[AutoSync] 服务器暂无物料包')
      } else if (!error.status) {
        log.error('[AutoSync] 可能是网络连接问题')
      }
    }
  }

  // 达到配额后，等到午夜再恢复自动同步
  let nextDayTimer: NodeJS.Timeout | null = null
  function scheduleNextDayReset() {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
    if (nextDayTimer) return
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const msUntilMidnight = tomorrow.getTime() - now.getTime() + 60_000 // 午夜后1分钟
    log.info(`[AutoSync] 将在 ${Math.round(msUntilMidnight / 60000)} 分钟后恢复自动同步（明天）`)
    nextDayTimer = setTimeout(() => {
      nextDayTimer = null
      syncMaterials()
      syncInterval = setInterval(syncMaterials, 30 * 60 * 1000)
    }, msUntilMidnight)
  }

  // 启动时延迟5分钟后首次同步
  setTimeout(syncMaterials, 5 * 60 * 1000)

  // 每30分钟检查一次是否需要同步
  syncInterval = setInterval(syncMaterials, 30 * 60 * 1000)
}

// 在 app ready 之前注册协议
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  if (!app.isPackaged) {
    event.preventDefault()
    callback(true) // 仅开发环境信任所有证书（内网自签名）
  }
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      bypassCSP: true,
      supportFetchAPI: true,
      standard: true,
      secure: true
    }
  }
])

app.whenReady().then(async () => {
  // 注册自定义协议来访问本地文件
  protocol.handle('local-file', async (request) => {
    let url = request.url.replace('local-file://', '')
    let decodedPath = decodeURIComponent(url)

    // 统一将反斜杠转为正斜杠
    decodedPath = decodedPath.replace(/\\/g, '/')

    // 确保路径以 / 开头（修复 macOS/Linux 路径问题）
    if (!decodedPath.startsWith('/') && !decodedPath.match(/^[A-Za-z]:/)) {
      decodedPath = '/' + decodedPath
    }

    // Windows: /C:/path -> C:/path（必须在 /c/path 之前检查）
    if (/^\/[A-Za-z]:/.test(decodedPath)) {
      decodedPath = decodedPath.slice(1)
    }
    // Windows: /c/path -> C:/path（小写盘符，无冒号）
    else if (/^\/[a-z]\//.test(decodedPath)) {
      decodedPath = decodedPath[1].toUpperCase() + ':' + decodedPath.slice(2)
    }

    try {
      const data = await readFile(decodedPath)
      // 根据文件扩展名返回正确的 MIME 类型
      const ext = decodedPath.split('.').pop()?.toLowerCase()
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
      }
      const mimeType = mimeTypes[ext || ''] || 'application/octet-stream'

      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      })
    } catch (error) {
      log.error('[Protocol] 读取文件失败:', decodedPath, error)
      return new Response('File not found', { status: 404 })
    }
  })

  registerAuthHandlers()
  registerPersonaHandlers()
  registerContentHandlers()
  registerPlatformHandlers()
  registerAutoPublishHandlers()
  registerAnalyticsHandlers()
  registerMonthlyTopicsHandlers()
  registerXhsLoginIpc()
  registerXhsPublishIpc()
  registerFileDialogIpc()
  registerMaterialHandlers()

  // 应用菜单
  const isMac = process.platform === 'darwin'
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' as const },
    {
      label: '帮助',
      submenu: [
        {
          label: '使用帮助',
          click: () => mainWindow?.webContents.send('navigate', '/help')
        },
        {
          label: '隐私政策',
          click: () => mainWindow?.webContents.send('navigate', '/privacy')
        },
        { type: 'separator' },
        {
          label: '关于心理学媒体助手',
          click: () => mainWindow?.webContents.send('navigate', '/about')
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  // 初始化认证服务（尝试从本地恢复登录状态）
  try {
    const user = await authService.initialize()
    if (user) {
      log.info(`[App] 自动登录成功: ${user.nickname || user.phone}`)
    } else {
      log.info('[App] 未找到本地登录信息，需要用户登录')
    }
  } catch (error) {
    log.error('[App] 认证服务初始化失败:', error)
  }

  // 检查小红书登录状态，首次使用引导登录
  try {
    const { loginGuard } = await import('./services/auth/login-guard')
    const loggedIn = await loginGuard.ensureLoggedIn('startup')
    if (!loggedIn) {
      mainWindow?.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send('navigate', '/platforms')
      })
    }
  } catch (error) {
    log.error('[App] 小红书登录检查失败:', error)
  }

  // 启动自动发布服务（不阻塞启动）
  autoPublishService.start()

  // 设置开机自启动
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false
  })

  // 创建系统托盘
  createTray()

  // 恢复孤立的 publishing 状态（进程重启后 MCP 任务已丢失）
  try {
    const { contentService } = await import('./services/content/content-service')
    const all = await contentService.listContents()
    for (const c of all) {
      if (c.status === 'publishing') {
        await contentService.updateContent(c.id, { status: 'pending' })
      }
    }
  } catch {}

  // 扫描超时内容，加入发布队列
  try {
    await autoPublishService.scanOverdueContent()
  } catch (error) {
    log.error('[App] 扫描超时内容失败:', error)
  }

  // 启动自动同步
  startAutoSync()

  // MCP 二进制自动更新检查
  try {
    const { mcpUpdater } = await import('./services/mcp/mcp-updater')
    // 启动 30 秒后首次检查（不阻塞启动）
    setTimeout(() => mcpUpdater.checkAndUpdate().catch(() => {}), 30_000)
    // 之后每 6 小时检查一次
    setInterval(() => mcpUpdater.checkAndUpdate().catch(() => {}), 6 * 60 * 60 * 1000)
  } catch (error) {
    log.error('[App] MCP 更新服务初始化失败:', error)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (syncInterval) {
    clearInterval(syncInterval)
  }
})

app.on('window-all-closed', () => {
  // macOS 下关闭窗口不退出应用，保持后台运行
  if (process.platform !== 'darwin') {
    // Windows/Linux 下也保持后台运行
    // app.quit()
  }
})
