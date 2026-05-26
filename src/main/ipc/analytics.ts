import { ipcMain } from 'electron'
import { analyticsService } from '../services/analytics/analytics-service'

export function registerAnalyticsHandlers() {
  ipcMain.handle('analytics:get-overview', async (_event, forceRefresh = false) => {
    try {
      return await analyticsService.getOverview(forceRefresh)
    } catch (error) {
      if (error instanceof Error && (error.message === 'NOT_LOGGED_IN' || error.message === 'USER_ID_NOT_CONFIGURED')) {
        throw error
      }
      throw error
    }
  })

  ipcMain.handle('analytics:get-daily-stats', async (_event, startDate: string, endDate: string) => {
    return await analyticsService.getDailyStats(startDate, endDate)
  })

  ipcMain.handle('analytics:update-stats', async (_event, stats) => {
    await analyticsService.updateStats(stats)
  })

  ipcMain.handle('analytics:add-daily-stats', async (_event, stat) => {
    await analyticsService.addDailyStats(stat)
  })
}
