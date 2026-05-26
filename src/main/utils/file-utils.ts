import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'

export function ensureDir(dirPath: string): string {
  mkdirSync(dirPath, { recursive: true })
  return dirPath
}

export function loadJson<T = any>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

export function saveJson(filePath: string, value: any): void {
  ensureDir(dirname(filePath))
  writeFileSync(filePath, JSON.stringify(value, null, 2))
}

export function removeFile(filePath: string): void {
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
