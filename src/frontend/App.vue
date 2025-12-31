<template>
  <div id="app" class="min-h-screen">

    <div class="theme-toggle"><theme-toggle /></div>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  // Check if user is already authenticated (has valid cookie)
  authStore.checkAuth()
})
</script>

<style>
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }
</style>
