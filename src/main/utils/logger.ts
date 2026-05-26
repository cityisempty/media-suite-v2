import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, appendFileSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { getDataDir } from './paths'

const LOG_DIR = join(getDataDir(), 'logs')
const RETENTION_DAYS = 7

function ensureLogDir(): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
  } catch {}
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0]
  return join(LOG_DIR, `app-${date}.log`)
}

function formatTime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function cleanupOldLogs(): void {
  try {
    const files = readdirSync(LOG_DIR)
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    for (const file of files) {
      if (!file.startsWith('app-') || !file.endsWith('.log')) continue
      const filePath = join(LOG_DIR, file)
      try {
        const stat = statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          unlinkSync(filePath)
        }
      } catch {}
    }
  } catch {}
}

function write(level: string, args: any[]): void {
  try {
    ensureLogDir()
    const message = args.map(a => {
      if (a instanceof Error) return a.stack || a.message
      if (typeof a === 'object') {
        try { return JSON.stringify(a, null, 2) } catch { return String(a) }
      }
      return String(a)
    }).join(' ')

    const line = `[${formatTime()}] [${level}] ${message}\n`
    appendFileSync(getLogFilePath(), line, 'utf-8')
  } catch {}
}

// 启动时清理旧日志
cleanupOldLogs()

export const log = {
  info: (...args: any[]) => {
    console.log(...args)
    write('INFO', args)
  },
  warn: (...args: any[]) => {
    console.warn(...args)
    write('WARN', args)
  },
  error: (...args: any[]) => {
    console.error(...args)
    write('ERROR', args)
  }
}
