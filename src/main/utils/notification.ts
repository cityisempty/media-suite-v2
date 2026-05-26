import { Notification, BrowserWindow } from 'electron'

export function notifyUser(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({ title, body })

  notification.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.show()
      win.focus()
    }
    onClick?.()
  })

  notification.show()
}
