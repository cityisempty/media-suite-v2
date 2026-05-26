import { ipcMain } from 'electron'
import { autoPublishService } from '../services/publish/auto-publish-service'

/**
 * 注册自动发布相关的 IPC Handler
 */
export function registerAutoPublishHandlers(): void {
  // 获取配置
  ipcMain.handle('auto-publish:get-config', async () => {
    return autoPublishService.getConfig()
  })

  // 更新配置
  ipcMain.handle('auto-publish:update-config', async (_event, config) => {
    return autoPublishService.updateConfig(config)
  })

  // 获取队列状态
  ipcMain.handle('auto-publish:get-queue-status', async () => {
    return autoPublishService.getQueueStatus()
  })

  // 获取队列内容
  ipcMain.handle('auto-publish:get-queue', async () => {
    return autoPublishService.getQueue()
  })

  // 添加到队列
  ipcMain.handle('auto-publish:add-to-queue', async (_event, contentId: string) => {
    await autoPublishService.addToQueue(contentId)
  })

  // 从队列移除
  ipcMain.handle('auto-publish:remove-from-queue', async (_event, contentId: string) => {
    autoPublishService.removeFromQueue(contentId)
  })

  // 启动服务
  ipcMain.handle('auto-publish:start', async () => {
    autoPublishService.start()
  })

  // 停止服务
  ipcMain.handle('auto-publish:stop', async () => {
    autoPublishService.stop()
  })
}
