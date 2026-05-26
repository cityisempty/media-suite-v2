import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/app-login'
    },
    {
      path: '/app-login',
      name: 'app-login',
      component: () => import('../views/AppLoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('../views/SetupView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/platforms',
      name: 'platforms',
      component: () => import('../views/PlatformsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/content',
      name: 'content',
      component: () => import('../views/ContentView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('../views/AnalyticsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/monthly-topics',
      name: 'monthly-topics',
      component: () => import('../views/MonthlyTopicsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/publish',
      name: 'publish',
      component: () => import('../views/PublishView.vue'),
      meta: { requiresAuth: true }
    },
    // 旧路由保留兼容
    {
      path: '/persona',
      redirect: '/profile'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('../views/HelpView.vue')
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('../views/PrivacyView.vue')
    }
  ]
})

// 路由守卫：检查登录状态和引导流程
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  console.log('[Router] 导航到:', to.name, '| loggedIn:', auth.loggedIn, '| checked:', auth.checked, '| setupChecked:', auth.setupChecked, '| isSetupComplete:', auth.isSetupComplete)

  // setup 页面直接放行
  if (to.name === 'setup') {
    console.log('[Router] setup 页面，放行')
    next()
    return
  }

  // 等待初始认证检查完成（App.vue 的 checkStatus）
  if (!auth.checked) {
    console.log('[Router] 等待 checkStatus...')
    await auth.checkStatus()
  }

  // 未登录用户：放行非认证页面，重定向认证页面到登录页
  if (!auth.loggedIn) {
    if (to.meta.requiresAuth) {
      console.log('[Router] 未登录，重定向到 /app-login')
      next('/app-login')
    } else {
      next()
    }
    return
  }

  // 已登录用户：检查引导状态
  if (!auth.setupChecked) {
    console.log('[Router] 等待 checkSetupStatus...')
    await auth.checkSetupStatus()
  }

  console.log('[Router] 引导状态: hasValidPersona:', auth.hasValidPersona, '| xhsConnected:', auth.xhsConnected, '| isSetupComplete:', auth.isSetupComplete)

  // 引导未完成，强制跳转 setup
  if (!auth.isSetupComplete) {
    if (to.name !== 'setup') {
      console.log('[Router] 引导未完成，重定向到 /setup')
      next('/setup')
      return
    }
  }

  // app-login 页面：已登录且引导完成，跳转 dashboard
  if (to.name === 'app-login' && auth.isSetupComplete) {
    console.log('[Router] 已登录且引导完成，重定向到 /dashboard')
    next('/dashboard')
    return
  }

  console.log('[Router] 放行:', to.name)
  next()
})

export default router
