<template>
  <div v-if="showPrompt" class="notification-prompt">
    <div class="prompt-content">
      <p class="prompt-text">Enable notifications to get alerts for new emails?</p>
      <div class="prompt-actions">
        <base-button @click="handleEnable" size="sm" variant="primary">
          Enable
        </base-button>
        <base-button @click="handleDismiss" size="sm" variant="secondary">
          Not now
        </base-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePushNotifications } from '../composables/usePushNotifications'

const { isSupported, permission, requestPermission } = usePushNotifications()

const showPrompt = ref(false)

onMounted(() => {
  // Show prompt if:
  // - Push notifications are supported
  // - Permission hasn't been decided yet ('default')
  // - User hasn't dismissed this prompt before
  const dismissed = localStorage.getItem('notification_prompt_dismissed')

  showPrompt.value =
    isSupported.value &&
    permission.value === 'default' &&
    !dismissed
})

async function handleEnable() {
  try {
    await requestPermission()
    showPrompt.value = false
  } catch (error) {
    console.error('Failed to enable notifications:', error)
    // Keep prompt visible on error so user can retry
  }
}

function handleDismiss() {
  // Remember that user dismissed the prompt
  localStorage.setItem('notification_prompt_dismissed', 'true')
  showPrompt.value = false
}
</script>

<style scoped>
.notification-prompt {
  position: fixed;
  bottom: 4rem;
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
  .notification-prompt {
    bottom: 4rem;
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
