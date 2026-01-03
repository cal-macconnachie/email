<template>
  <div id="app" class="min-h-screen">
    <div v-if="authStore.isAuthenticated" class="compose-button">
      <base-button @click="emailStore.composing = true" variant="link-primary" size="sm" class="compose-plus">+</base-button>
    </div>
    <div class="top-right-controls">
        <theme-toggle size="sm"/>
      <email-selector v-if="authStore.isAuthenticated" />
      <!-- <div class="theme-toggle">
        <theme-toggle size="sm"/>
      </div> -->
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
import { useRouter } from 'vue-router'
import ComposeDrawer from './components/ComposeForm.vue'
import EmailSelector from './components/EmailSelector.vue'
import NotificationPrompt from './components/NotificationPrompt.vue'
import { usePushNotifications } from './composables/usePushNotifications'
import { useAuthStore } from './stores/auth'
import { useEmailStore } from './stores/email'

const router = useRouter()
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

// Watch for selectedRecipient changes and redirect to list if not already there
watch(
  () => authStore.selectedRecipient,
  async (newRecipient, oldRecipient) => {
    // Only trigger if the recipient actually changed
    if (newRecipient !== oldRecipient && oldRecipient !== null) {
      // Redirect to list page if not already there
      if (router.currentRoute.value.name !== 'emails') {
        try {
          await router.push({ name: 'emails' })
        } catch (err) {
          // Ignore navigation errors (e.g., navigating to the same location)
          console.debug('Navigation skipped:', err)
        }
      }
    }
  }
)

// Check session immediately when app loads (before mount)
const sessionCheckPromise = authStore.checkSession()

onMounted(async () => {
  // Wait for session check to complete if it hasn't already
  await sessionCheckPromise
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
  .top-right-controls {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
  }
</style>
