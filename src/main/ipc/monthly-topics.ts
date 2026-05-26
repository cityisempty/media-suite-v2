import { ipcMain } from 'electron'
import { authService } from '../services/auth/auth-service'
import { serverConfig } from '../services/server/server-config'

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = authService.getAccessToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const response = await fetch(`${serverConfig.baseUrl}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export function registerMonthlyTopicsHandlers() {
  ipcMain.handle('monthly-topics:list', async (_event, yearMonth?: string) => {
    try {
      const query = yearMonth ? `?year_month=${yearMonth}` : ''
      return await apiRequest(`/monthly-topics${query}`)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('monthly-topics:update', async (_event, id: number, topic: string) => {
    try {
      return await apiRequest(`/monthly-topics/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ topic })
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
