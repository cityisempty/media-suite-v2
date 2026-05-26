import type { ElectronAPI, PublishProgress } from './index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
