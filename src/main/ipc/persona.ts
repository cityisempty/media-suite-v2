import { ipcMain } from 'electron'
import { personaService } from '../services/persona/persona-service'
import type { Persona } from '../../../packages/shared/src/types'

/**
 * 注册人设相关的 IPC Handler
 */
export function registerPersonaHandlers(): void {
  // 获取所有人设
  ipcMain.handle('persona:list', async () => {
    try {
      const personas = await personaService.listPersonas()
      return { success: true, data: personas }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取单个人设
  ipcMain.handle('persona:get', async (_event, id: string) => {
    try {
      const persona = await personaService.getPersona(id)
      return { success: true, data: persona }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 创建人设
  ipcMain.handle('persona:create', async (_event, data: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const persona = await personaService.createPersona(data)
      return { success: true, data: persona }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 更新人设
  ipcMain.handle('persona:update', async (_event, id: string, data: Partial<Persona>) => {
    try {
      const persona = await personaService.updatePersona(id, data)
      return { success: true, data: persona }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 删除人设
  ipcMain.handle('persona:delete', async (_event, id: string) => {
    try {
      await personaService.deletePersona(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 获取当前激活的人设
  ipcMain.handle('persona:get-active', async () => {
    try {
      const persona = await personaService.getActivePersona()
      return { success: true, data: persona }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 设置激活的人设
  ipcMain.handle('persona:set-active', async (_event, id: string) => {
    try {
      await personaService.setActivePersona(id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
