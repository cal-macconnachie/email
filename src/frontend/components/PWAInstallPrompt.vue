<template>
  <div v-if="showPrompt" class="pwa-install-prompt">
    <div class="prompt-content">
      <p class="prompt-text">Install this app on your device for quick access and a better experience!</p>
      <div class="prompt-actions">
        <base-button @click="handleInstall" size="sm" variant="primary">
          Install
        </base-button>
        <base-button @click="handleDismiss" size="sm" variant="secondary">
          Not now
        </base-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePWAInstall } from '../composables/usePWAInstall'

const { isInstallable, isMobile, isStandalone, promptInstall } = usePWAInstall()

const dismissed = ref(localStorage.getItem('pwa_install_prompt_dismissed'))
const hasWaited = ref(false)

// Small delay to let the app settle before showing prompt
onMounted(() => {
  setTimeout(() => {
    hasWaited.value = true
  }, 2000)
})

// Reactive computed property that re-evaluates when conditions change
const showPrompt = computed(() => {
  // Don't show until we've waited for the app to settle
  if (!hasWaited.value) return false

  // Show prompt if:
  // - App is installable (beforeinstallprompt fired)
  // - User is on mobile
  // - App is not already installed
  // - User hasn't dismissed this prompt before
  return (
    isInstallable.value &&
    isMobile() &&
    !isStandalone() &&
    !dismissed.value
  )
})

async function handleInstall() {
  try {
    const result = await promptInstall()

    if (result.outcome === 'accepted') {
      console.log('User accepted the install prompt')
      localStorage.setItem('pwa_install_prompt_dismissed', 'true')
      dismissed.value = 'true'
    } else {
      console.log('User dismissed the install prompt')
      localStorage.setItem('pwa_install_prompt_dismissed', 'true')
      dismissed.value = 'true'
    }
  } catch (error) {
    console.error('Failed to prompt for install:', error)
    // Keep prompt visible on error so user can retry
  }
}

function handleDismiss() {
  // Remember that user dismissed the prompt
  localStorage.setItem('pwa_install_prompt_dismissed', 'true')
  dismissed.value = 'true'
}
</script>

<style scoped>
.pwa-install-prompt {
  position: fixed;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 400px;
  width: calc(100% - 2rem);
}

.prompt-content {
  background: var(--color-bg-secondary, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.08);
}

.prompt-text {
  margin: 0 0 0.75rem 0;
  font-size: 0.9375rem;
  line-height: 1.4;
  color: var(--color-text-primary, #111827);
}

.prompt-actions {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 480px) {
  .pwa-install-prompt {
    bottom: 5.5rem;
    width: calc(100% - 1rem);
  }

  .prompt-content {
    padding: 0.875rem 1rem;
  }

  .prompt-text {
    font-size: 0.875rem;
  }
}
</style>
