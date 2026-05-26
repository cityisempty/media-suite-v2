import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'node:fs/promises'
import { app } from 'electron'

export function registerFileDialogIpc(): void {
  ipcMain.handle('dialog:select-images', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择图片',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths
  })

  ipcMain.handle('file:read-image-base64', async (_event, filePath: string) => {
    const buffer = await readFile(filePath)
    return buffer.toString('base64')
  })

  ipcMain.handle('app:info', async () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      dataDir: app.getPath('userData')
    }
  })
}
