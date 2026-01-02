<template>
  <div id="app" class="min-h-screen">
    <div v-if="authStore.isAuthenticated" class="compose-button">
      <base-button @click="emailStore.composing = true" variant="link-primary" size="sm" class="compose-plus">+</base-button>
    </div>
    <div class="theme-toggle">
      <theme-toggle size="sm"/>
    </div>
    <router-view />
    <base-drawer ref="composeDrawer" size="lg" @drawer-close="emailStore.composing = false">
      <ComposeDrawer />
    </base-drawer>
    <NotificationPrompt v-if="authStore.isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
import { BaseDrawer } from '@cal.macconnachie/web-components'
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch } from 'vue'
import ComposeDrawer from './components/ComposeForm.vue'
import NotificationPrompt from './components/NotificationPrompt.vue'
import { usePushNotifications } from './composables/usePushNotifications'
import { useAuthStore } from './stores/auth'
import { useEmailStore } from './stores/email'

const authStore = useAuthStore()
const emailStore = useEmailStore()
const { composing } = storeToRefs(emailStore)
const composeDrawer = ref<BaseDrawer | null>(null)
const { checkSubscription } = usePushNotifications()

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

onMounted(async () => {
  // Check if user is already authenticated (has valid cookie)
  authStore.checkAuth()

  // Check push notification subscription status after auth check
  if (authStore.isAuthenticated) {
    await checkSubscription()
  }
})
</script>

<style>
  .compose-button {
    position: fixed;
    bottom: 2rem;
    right: 1rem;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: var(--color-bg-muted);
    box-shadow: var(--shadow-md);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .compose-plus {
    font-size: 2.5rem;
    line-height: 1;
    padding: 0;
    margin: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-1px);
  }
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }
</style>
