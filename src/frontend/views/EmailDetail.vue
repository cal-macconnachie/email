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
        <div
          v-for="email in threadEmails"
          :key="email.id"
          :ref="email.s3_key === props.s3Key ? 'targetEmailCard' : undefined"
          class="thread-email-card"
          :class="{ 'thread-email-active': email.s3_key === decodeURIComponent(props.s3Key) }"
        >
          <email-view :email="email" :s3-key="props.s3Key" />
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

onMounted(async () => {
  try {
    const decodedKey = decodeURIComponent(props.s3Key)

    // Find the target email in the store (from inbox/list view)
    let targetEmail = emailStore.emails.find(e => e.s3_key === decodedKey)

    if (!targetEmail) {
      // If not in store, fetch just the metadata to get thread_id
      // This should NOT fetch the body, only metadata
      await emailStore.fetchEmailDetail(decodedKey)
      targetEmail = emailStore.currentEmail || undefined
    } else {
      emailStore.currentEmail = targetEmail
    }

    if (targetEmail) {
      // Load thread emails (metadata only, no bodies)
      if (targetEmail.thread_id) {
        // Fetch the full thread list (metadata only)
        // The false parameter should indicate "don't fetch bodies"
        threadEmails.value = await emailStore.fetchThread(targetEmail.thread_id, false)

        // Ensure the thread is sorted by date
        threadEmails.value.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      } else {
        // Single email, not part of a thread
        threadEmails.value = [targetEmail]
      }

      // Note: EmailView component will mark emails as read when they enter the viewport

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
