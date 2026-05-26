import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { app } from 'electron'

export interface ServerConfig {
  useMock: boolean
  baseUrl: string
  wsUrl: string
}

const DEFAULT_BASE_URL = 'https://rednote.xinlioa.com/api'

function getConfigPath(): string {
  return join(app.getPath('userData'), 'server-config.json')
}

function loadConfig(): ServerConfig {
  try {
    const path = getConfigPath()
    if (existsSync(path)) {
      const saved = JSON.parse(readFileSync(path, 'utf-8'))
      return { useMock: false, baseUrl: saved.baseUrl || DEFAULT_BASE_URL, wsUrl: saved.wsUrl || '' }
    }
  } catch {}
  return { useMock: false, baseUrl: DEFAULT_BASE_URL, wsUrl: '' }
}

export function saveServerUrl(baseUrl: string): void {
  writeFileSync(getConfigPath(), JSON.stringify({ baseUrl }), 'utf-8')
  serverConfig.baseUrl = baseUrl
}

export const serverConfig: ServerConfig = loadConfig()
