import { LocalStore } from '../../db/local-store'
import type { Persona } from '../../../../packages/shared/src/types'
import { join } from 'node:path'
import { getDataDir } from '../../utils/paths'
import { apiClient } from '../server'

/**
 * 人设服务
 * 管理用户的 IP 人设
 */
export class PersonaService {
  private store: LocalStore<Persona[]>

  constructor() {
    const dataPath = join(getDataDir(), 'personas.json')
    this.store = new LocalStore<Persona[]>(dataPath)
  }

  /**
   * 获取所有人设
   */
  async listPersonas(): Promise<Persona[]> {
    try {
      // 尝试从服务器获取
      const persona = await apiClient.getPersona()
      if (!persona) return this.store.read() || []

      // 服务端可能不返回 isActive 字段，需要与本地状态合并
      const localPersonas = this.store.read() || []
      const localMatch = localPersonas.find(p => p.id === persona.id)

      if (localMatch) {
        // 保留本地的 isActive 状态
        persona.isActive = localMatch.isActive
      } else if (localPersonas.length === 0) {
        // 本地没有任何 persona，服务端返回的是唯一的，自动激活
        persona.isActive = true
      }

      // 同步到本地存储
      this.store.write([persona])
      return [persona]
    } catch (error) {
      console.error('Failed to fetch persona from server:', error)
      // 降级到本地存储
      return this.store.read() || []
    }
  }

  /**
   * 创建默认人设（本地存储，无需服务器）
   */
  private createDefaultPersona(): Persona {
    const persona: Persona = {
      id: `default-${Date.now()}`,
      userId: 'local-user',
      personality: '专业、温暖、有亲和力',
      age: 25,
      languageStyle: '轻松活泼，适当使用 emoji',
      expertiseFields: ['心理学', '情感'],
      creativeFields: ['小红书图文'],
      publishSchedule: {
        timeSlots: ['09:00', '12:00', '18:00'],
        frequency: 1,
        style: ''
      },
      updatedAt: new Date().toISOString(),
      isActive: true
    }
    this.store.write([persona])
    return persona
  }

  /**
   * 获取单个人设
   */
  async getPersona(id: string): Promise<Persona | null> {
    const personas = await this.listPersonas()
    return personas.find(p => p.id === id) || null
  }

  /**
   * 创建人设
   */
  async createPersona(data: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>): Promise<Persona> {
    try {
      console.log('[PersonaService] 创建人设，原始数据:', data)

      // 调用服务器 API
      const persona = await apiClient.savePersona(data)

      console.log('[PersonaService] ✅ 人设创建成功（已同步到云端）:', persona)

      // 同时保存到本地作为缓存
      const personas = this.store.read() || []
      personas.push(persona)
      this.store.write(personas)

      return persona
    } catch (error) {
      console.warn('[PersonaService] ⚠️ 无法连接到服务器，已保存到本地（离线模式）:', error)

      // 降级：直接保存到本地
      const persona: Persona = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: 'local-user',
        ...data,
        updatedAt: new Date().toISOString(),
        isActive: true
      }

      const personas = this.store.read() || []
      personas.push(persona)
      this.store.write(personas)

      console.log('[PersonaService] ✅ 人设已保存到本地:', persona)

      // 抛出特殊错误，让前端知道是离线保存
      const offlineError = new Error('OFFLINE_SAVE') as any
      offlineError.persona = persona
      offlineError.isOffline = true
      throw offlineError
    }
  }

  /**
   * 更新人设
   */
  async updatePersona(id: string, data: Partial<Omit<Persona, 'id' | 'createdAt'>>): Promise<Persona> {
    try {
      // 调用服务器 API
      const persona = await apiClient.savePersona(data)

      // 同时更新本地缓存
      const personas = this.store.read() || []
      const index = personas.findIndex(p => p.id === id)
      if (index !== -1) {
        personas[index] = persona
        this.store.write(personas)
      }

      return persona
    } catch (error) {
      console.error('[PersonaService] 更新人设失败，降级到本地存储:', error)

      // 降级：直接更新本地
      const personas = this.store.read() || []
      const index = personas.findIndex(p => p.id === id)

      if (index === -1) {
        throw new Error('人设不存在')
      }

      personas[index] = {
        ...personas[index],
        ...data,
        updatedAt: new Date().toISOString()
      }

      this.store.write(personas)
      return personas[index]
    }
  }

  /**
   * 删除人设
   */
  async deletePersona(id: string): Promise<void> {
    const personas = this.store.read() || []
    const filtered = personas.filter(p => p.id !== id)

    if (filtered.length === personas.length) {
      throw new Error('人设不存在')
    }

    this.store.write(filtered)
  }

  /**
   * 获取当前激活的人设
   */
  async getActivePersona(): Promise<Persona | null> {
    const personas = await this.listPersonas()
    return personas.find(p => p.isActive) || null
  }

  /**
   * 设置激活的人设
   */
  async setActivePersona(id: string): Promise<void> {
    const personas = this.store.read() || []

    // 取消所有人设的激活状态
    personas.forEach(p => (p.isActive = false))

    // 激活指定人设
    const target = personas.find(p => p.id === id)
    if (!target) {
      throw new Error('人设不存在')
    }

    target.isActive = true
    this.store.write(personas)
  }
}

// 单例
export const personaService = new PersonaService()
