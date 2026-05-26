import { LocalStore } from '../../db/local-store'
import { join } from 'node:path'
import { getDataDir } from '../../utils/paths'

/**
 * 物料包同步状态
 */
export interface MaterialSyncState {
  /** 物料包ID */
  packageId: string
  /** 对应的内容ID */
  contentId: string
  /** 同步时间 */
  syncedAt: number
  /** 物料包修改时间（用于检测变更） */
  packageModifiedAt: number
}

/**
 * 物料包同步状态管理
 */
export class MaterialSyncStateService {
  private store: LocalStore<MaterialSyncState[]>

  constructor() {
    const dataPath = join(getDataDir(), 'material-sync-state.json')
    this.store = new LocalStore<MaterialSyncState[]>(dataPath)
  }

  /**
   * 获取所有同步状态
   */
  getAll(): MaterialSyncState[] {
    return this.store.read() || []
  }

  /**
   * 检查物料包是否已同步
   */
  isSynced(packageId: string, packageModifiedAt: number): boolean {
    const states = this.getAll()
    const state = states.find(s => s.packageId === packageId)

    if (!state) {
      return false
    }

    // 如果物料包修改时间变化，视为未同步
    return state.packageModifiedAt === packageModifiedAt
  }

  /**
   * 记录同步状态
   */
  recordSync(packageId: string, contentId: string, packageModifiedAt: number): void {
    const states = this.getAll()
    const existingIndex = states.findIndex(s => s.packageId === packageId)

    const newState: MaterialSyncState = {
      packageId,
      contentId,
      syncedAt: Date.now(),
      packageModifiedAt
    }

    if (existingIndex >= 0) {
      states[existingIndex] = newState
    } else {
      states.push(newState)
    }

    this.store.write(states)
  }

  /**
   * 删除同步状态
   */
  removeSync(packageId: string): void {
    const states = this.getAll()
    const filtered = states.filter(s => s.packageId !== packageId)
    this.store.write(filtered)
  }

  /**
   * 清空所有同步状态
   */
  clearAll(): void {
    this.store.write([])
  }
}

// 单例
export const materialSyncStateService = new MaterialSyncStateService()
