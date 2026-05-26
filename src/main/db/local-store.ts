import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { ensureDir } from '../utils/file-utils'
import { dirname } from 'node:path'

/**
 * 本地 JSON 文件存储抽象层
 */
export class LocalStore<T = any> {
  constructor(private filePath: string) {}

  read(): T | null {
    if (!existsSync(this.filePath)) {
      return null
    }
    try {
      const content = readFileSync(this.filePath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  write(data: T): void {
    ensureDir(dirname(this.filePath))
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  update(updater: (current: T | null) => T): void {
    const current = this.read()
    const updated = updater(current)
    this.write(updated)
  }

  delete(): void {
    if (existsSync(this.filePath)) {
      const { unlinkSync } = require('node:fs')
      unlinkSync(this.filePath)
    }
  }

  exists(): boolean {
    return existsSync(this.filePath)
  }
}
