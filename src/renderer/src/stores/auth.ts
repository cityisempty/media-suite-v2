import { defineStore } from 'pinia'

// 检查人设是否存在
function isPersonaValid(persona: any): boolean {
  if (!persona) return false
  // 人设存在即有效，用户可随时编辑完善
  return true
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any | null,
    loggedIn: false,
    checking: false,
    checked: false,
    loggingIn: false,
    expiresAt: null as number | null,
    error: null as string | null,
    hasValidPersona: false,
    xhsConnected: false,
    setupChecked: false
  }),
  getters: {
    isSetupComplete: (state) => state.hasValidPersona && state.xhsConnected
  },
  actions: {
    async checkStatus() {
      this.checking = true
      try {
        const user = await window.api.auth.getCurrentUser()
        this.user = user
        this.loggedIn = !!user
      } catch {
        this.user = null
        this.loggedIn = false
      } finally {
        this.checking = false
        this.checked = true
      }
    },
    async checkSetupStatus() {
      try {
        const [personaRes, xhsStatus] = await Promise.all([
          window.api.persona.getActive(),
          window.api.xhsLoginStatus()
        ])
        const persona = personaRes?.data ?? personaRes
        this.hasValidPersona = isPersonaValid(persona)
        this.xhsConnected = xhsStatus.loggedIn
        this.setupChecked = true
      } catch {
        this.hasValidPersona = false
        this.xhsConnected = false
        this.setupChecked = true
      }
    },
    // 登录后刷新引导状态（供 SetupView 调用）
    async refreshSetupStatus() {
      await this.checkSetupStatus()
    },
    async login() {
      this.loggingIn = true
      this.error = null
      try {
        const result = await window.api.xhsLogin()
        if (!result.success) throw new Error(result.error || '登录失败')
        await this.checkStatus()
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loggingIn = false
      }
    },
    async logout() {
      try {
        await window.api.auth.logout()
        this.user = null
        this.loggedIn = false
        this.expiresAt = null
        this.hasValidPersona = false
        this.xhsConnected = false
        this.setupChecked = false
        this.checked = false
      } catch (error) {
        console.error('退出登录失败:', error)
      }
    },
    async clearLogin() {
      await window.api.xhsClearCookies()
      this.user = null
      this.loggedIn = false
      this.expiresAt = null
      this.hasValidPersona = false
      this.xhsConnected = false
      this.setupChecked = false
      this.checked = false
    }
  }
})
