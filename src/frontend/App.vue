<template>
  <div id="app" class="min-h-screen">
    <div class="compose-button">
      <base-button v-if="authStore.isAuthenticated" @click="emailStore.composing = true" variant="link-primary" size="sm">+</base-button>
    </div>
    <div class="theme-toggle">
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
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background-color: var(--color-bg-muted);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }
</style>
