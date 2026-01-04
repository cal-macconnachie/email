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
      <div v-if="emailStore.isLoading" class="loading-state">
        <p class="loading-text">Loading email...</p>
      </div>

      <base-card v-else-if="emailStore.error" variant="elevated" padding="md" class="error-card">
        {{ emailStore.error }}
      </base-card>

      <div v-else-if="threadEmails.length > 0" class="thread-container">
        <base-card
          v-for="email in threadEmails"
          :key="email.id"
          :ref="email.s3_key === props.s3Key ? 'targetEmailCard' : undefined"
          variant="elevated"
          padding="lg"
          class="thread-email-card"
          :class="{ 'thread-email-active': email.s3_key === decodeURIComponent(props.s3Key) }"
        >
          <email-view :email="email" :s3-key="props.s3Key" />
        </base-card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Email } from '../api/client'
import { useEmailStore } from '../stores/email'
import EmailView from '../components/EmailView.vue'

const props = defineProps<{
  s3Key: string
}>()

const router = useRouter()
const emailStore = useEmailStore()
const threadEmails = ref<Email[]>([])
const targetEmailCard = ref<HTMLElement[]>([])

onMounted(async () => {
  try {
    const decodedKey = decodeURIComponent(props.s3Key)

    // Check if we already have this email cached with body
    const cachedEmail = emailStore.currentEmail?.s3_key === decodedKey && emailStore.currentEmail?.body
      ? emailStore.currentEmail
      : emailStore.emails.find(e => e.s3_key === decodedKey && e.body)

    if (cachedEmail) {
      // Use cached email
      emailStore.currentEmail = cachedEmail
    } else {
      // Fetch from API if not cached (this will also fetch thread relations)
      await emailStore.fetchEmailDetail(decodedKey)
    }

    if (emailStore.currentEmail) {
      // Load thread emails from the response or the store
      if (emailStore.currentEmail.thread_id) {
        if (emailStore.currentEmail.threadEmails && emailStore.currentEmail.threadEmails.length > 0) {
          // Use thread emails from the detail response, enhanced with cached data from store
          threadEmails.value = emailStore.currentEmail.threadEmails.map(threadEmail => {
            // Check if this is the current email being viewed (which has the body)
            if (emailStore.currentEmail && threadEmail.s3_key === emailStore.currentEmail.s3_key && emailStore.currentEmail.body) {
              return emailStore.currentEmail
            }
            // Check if we have a cached version with body
            const cachedVersion = emailStore.emails.find(e => e.s3_key === threadEmail.s3_key && e.body)
            return cachedVersion || threadEmail
          })
        } else {
          // Fallback to fetching thread separately if not included in response
          threadEmails.value = await emailStore.fetchThread(emailStore.currentEmail.thread_id, false)
        }

        // Ensure the current email is in the thread (in case it wasn't included)
        if (!threadEmails.value.some(e => e.s3_key === emailStore.currentEmail?.s3_key)) {
          threadEmails.value.push(emailStore.currentEmail)
          threadEmails.value.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        } else {
          // Update the existing entry with the full body if needed
          const index = threadEmails.value.findIndex(e => e.s3_key === emailStore.currentEmail?.s3_key)
          if (index !== -1 && emailStore.currentEmail.body) {
            threadEmails.value[index] = emailStore.currentEmail
          }
        }

        // Note: EmailView component will handle fetching bodies for emails that don't have them
      } else {
        // Single email, not part of a thread
        threadEmails.value = [emailStore.currentEmail]
      }

      // Mark the target email as read
      const targetEmail = threadEmails.value.find(e => e.s3_key === decodedKey)
      if (targetEmail && !targetEmail.read) {
        await emailStore.markAsRead(targetEmail.timestamp)
      }

      // Scroll to the target email after rendering and content loading
      // We need to wait for EmailView components to fetch and render their bodies
      await nextTick()
      // Add a small delay to ensure content is fully loaded before scrolling
      setTimeout(() => {
        if (targetEmailCard.value && targetEmailCard.value.length > 0) {
          // Use 'start' on mobile for better positioning, 'center' on desktop
          const isMobile = window.innerWidth <= 768
          targetEmailCard.value[0].scrollIntoView({
            behavior: 'smooth',
            block: isMobile ? 'start' : 'center'
          })
        }
      }, 300)
    }
  } catch (error) {
    console.error('Failed to fetch email:', error)
  }
})
</script>

<style scoped>
.email-detail-container {
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-secondary);
}

.email-detail-header {
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
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.thread-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.thread-email-card {
  scroll-margin-top: var(--space-20);
  transition: all 0.3s ease;
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

@media (max-width: 768px) {
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
