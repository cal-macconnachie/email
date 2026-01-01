import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Login from '../views/Login.vue'
import EmailList from '../views/EmailList.vue'
import EmailDetail from '../views/EmailDetail.vue'
import Compose from '../views/Compose.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: '/emails',
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresAuth: false },
    },
    {
      path: '/emails',
      name: 'emails',
      component: EmailList,
      meta: { requiresAuth: true },
    },
    {
      path: '/emails/:s3Key',
      name: 'email-detail',
      component: EmailDetail,
      meta: { requiresAuth: true },
      props: true,
    },
    {
      path: '/compose',
      name: 'compose',
      component: Compose,
      meta: { requiresAuth: true },
    },
  ],
})

// Navigation guard to check authentication
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false

  // checkAuth doesn't overwrite existing auth state - it's safe to call
  authStore.checkAuth()

  // If not authenticated, try to refresh the token (this checks HttpOnly cookies server-side)
  if (!authStore.isAuthenticated) {
    const refreshed = await authStore.refreshToken()
    // If refresh succeeded, we're authenticated now
    if (!refreshed && requiresAuth) {
      // Can't refresh and route requires auth - go to login
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
  }

  // Now check if authentication is required
  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    // Already logged in, redirect to emails
    next({ name: 'emails' })
  } else {
    next()
  }
})

export default router
