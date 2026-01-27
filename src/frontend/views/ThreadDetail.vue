<template>
  <div class="email-detail-container">
    <header class="email-detail-header">
      <div class="header-content">
        <base-button @click="router.push('/emails')" variant="link-secondary" class="back-button">←</base-button>

        <div v-if="emailStore.currentEmail" class="email-header-info">
          <div class="email-header-main">
            <h1 class="email-title">{{ emailStore.currentEmail.subject || '(No subject)' }}</h1>
          </div>
        </div>
      </div>
    </header>

    <main class="email-detail-main">
      <base-card v-if="emailStore.error" variant="elevated" padding="md" class="error-card">
        {{ emailStore.error }}
      </base-card>
      <div v-if="emailStore.isLoading" class="loading-state">
        <p class="loading-text">Loading email...</p>
      </div>

      <div v-else-if="threadEmails.length > 0" class="thread-container">
        <div
          v-for="email in threadEmails"
          :key="email.id"
          :ref="email.s3_key === props.s3Key ? 'targetEmailCard' : undefined"
          class="thread-email-card"
          :class="{
            'thread-email-active': email.s3_key === decodeURIComponent(props.s3Key),
            'odd-numbered-email': threadEmails.indexOf(email) % 2 === 1
            }"
        >
          <email-view :email="email" :s3-key="email.s3_key" />
      </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Email } from '../api/client'
import EmailView from '../components/EmailView.vue'
import { useEmailStore } from '../stores/email'

const props = defineProps<{
  s3Key: string
}>()

const router = useRouter()
const emailStore = useEmailStore()
const threadEmails = ref<Email[]>([])
const targetEmailCard = ref<HTMLElement[]>([])

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 500
): Promise<T> {
  let lastError: Error
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError!
}

onMounted(async () => {
  const decodedKey = decodeURIComponent(props.s3Key)

  try {
    // Step 1: Fetch the email detail with retry logic
    // This is especially important when opening from notification with empty store
    const targetEmail = await retryWithBackoff(async () => {
      // First try to find in store
      let email = emailStore.emails.find(e => e.s3_key === decodedKey)

      if (!email) {
        console.log('Target email not found in store, fetching detail...', decodedKey)
        // Fetch with retry
        email = await emailStore.fetchEmailDetail(decodedKey)

        // Double-check it's in the store after fetching
        if (!email) {
          await nextTick()
          email = emailStore.emails.find(e => e.s3_key === decodedKey)
        }

        if (!email) {
          throw new Error('Email not found after fetch')
        }
      }

      return email
    })

    emailStore.currentEmail = targetEmail

    // Step 2: Fetch thread with retry logic
    try {
      if (targetEmail.thread_id) {
        const threadList = await retryWithBackoff(async () => {
          return await emailStore.fetchThread(targetEmail.thread_id, true)
        })

        threadEmails.value = threadList.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      } else {
        threadEmails.value = [targetEmail]
      }
    } catch (threadError) {
      console.error('Failed to fetch thread, showing single email:', threadError)
      // Fallback: show just the target email if thread fetch fails
      threadEmails.value = [targetEmail]
    }

    // Step 3: Scroll to target after render
    await nextTick()
    // Give EmailView components time to render
    setTimeout(() => {
      if (targetEmailCard.value && targetEmailCard.value.length > 0) {
        const isMobile = window.innerWidth <= 768
        targetEmailCard.value[0].scrollIntoView({
          behavior: 'smooth',
          block: isMobile ? 'start' : 'center'
        })
      }
    }, 300)
  } catch (error) {
    console.error('Failed to load email:', error)
    emailStore.error = error instanceof Error ? error.message : 'Failed to load email. Please try again.'
  }
})
</script>

<style scoped>
.email-detail-container {
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-secondary);
  touch-action: pan-y;
  overscroll-behavior-y: contain;
  align-items: center;
}

.email-detail-header {
  width: 100vw;
  flex-shrink: 0;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-6);
  padding-right: var(--space-12);
}

.back-button {
  margin-bottom: var(--space-4);
}

.email-header-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.email-header-main {
  flex: 1;
}

.email-title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  word-break: break-word;
  overflow-wrap: break-word;
}

.email-meta {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.meta-item {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.email-header-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.email-detail-main {
  max-width: 1600px;
  padding: var(--space-6);
  width: 100vw;
  flex: 1;
}

.thread-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.thread-email-card {
  scroll-margin-top: var(--space-20);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  transition: all 0.3s ease;
  min-height: fit-content;
}

.loading-state {
  text-align: center;
  padding: var(--space-12);
}

.loading-text {
  margin: 0;
  color: var(--color-text-secondary);
}

.error-card {
  background-color: var(--color-error-bg);
  color: var(--color-error);
}

.odd-numbered-email {
  background-color: var(--color-bg-muted);
}

@media (max-width: 768px) {
  .email-detail-container {
    margin-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  }
  .email-detail-main {
    padding: var(--space-4);
    padding-bottom: var(--space-8);
  }

  .header-content {
    padding: var(--space-3) var(--space-4);
    padding-right: var(--space-12);
  }

  .email-header-info {
    flex-direction: column;
  }

  .email-meta {
    flex-direction: column;
    gap: var(--space-2);
  }

  .email-header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .thread-email-card {
    scroll-margin-top: var(--space-8);
  }
}
</style>
