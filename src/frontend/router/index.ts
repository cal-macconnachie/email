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

  // Check if we have an access token
  authStore.checkAuth()

  // If not authenticated, try to refresh the token
  if (!authStore.isAuthenticated) {
    await authStore.refreshToken()
  }

  // Now check if authentication is required
  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.name === 'login' && authStore.isAuthenticated) {
    next({ name: 'emails' })
  } else {
    next()
  }
})

export default router
