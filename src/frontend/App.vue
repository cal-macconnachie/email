<template>
  <div id="app" class="min-h-screen">
    <div class="compose-button">
      <base-button v-if="authStore.isAuthenticated" @click="emailStore.composing = true" variant="link-primary" size="sm">+</base-button>
    </div>
    <div class="theme-toggle">
      <base-button v-if="authStore.isAuthenticated" @click="handleLogout" variant="link-secondary" size="sm">Logout</base-button>
      <theme-toggle size="sm"/>
    </div>
    <router-view />
    <base-drawer ref="composeDrawer" size="lg" @drawer-close="emailStore.composing = false">
      <compose />
    </base-drawer>
  </div>
</template>

<script setup lang="ts">
import { BaseDrawer } from '@cal.macconnachie/web-components'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useEmailStore } from './stores/email'
import Compose from './views/Compose.vue'

const authStore = useAuthStore()
const emailStore = useEmailStore()
const router = useRouter()
const { composing } = storeToRefs(emailStore)
const composeDrawer = ref<BaseDrawer | null>(null)

watch(
  composing,
  (newVal) => {
    if (composeDrawer.value) {
      if (newVal) {
        composeDrawer.value.openDrawer()
      } else {
        composeDrawer.value.closeDrawer()
      }
    }
  }
)

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

onMounted(() => {
  // Check if user is already authenticated (has valid cookie)
  authStore.checkAuth()
})
</script>

<style>
  .compose-button {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: var(--color-bg-secondary);
    z-index: 1000;
  }
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }
</style>
