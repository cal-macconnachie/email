import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import EmailList from '../views/EmailList.vue'
import Login from '../views/Login.vue'
import ThreadDetail from '../views/ThreadDetail.vue'

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
      component: ThreadDetail,
      meta: { requiresAuth: true },
      props: true,
    }
  ],
})

// Navigation guard to check authentication
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth !== false

  // Now check if authentication is required
  if (requiresAuth && !authStore.isAuthenticated) {
    const refreshed = await authStore.refreshToken()
    // If refresh succeeded, we're authenticated now
    if (!refreshed && requiresAuth) {
      // Can't refresh and route requires auth - go to login
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
    next()
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    // Already logged in, redirect to emails
    next({ name: 'emails' })
  } else {
    next()
  }
})

export default router
