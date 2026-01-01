<template>
  <div class="email-list-container">

    <main class="email-main">
      <div v-if="emailStore.isLoading && emailStore.emails.length === 0" class="loading-state">
        <p class="loading-text">Loading emails...</p>
      </div>

      <base-card v-else-if="emailStore.error" variant="elevated" padding="md" class="error-card">
        {{ emailStore.error }}
      </base-card>

      <div v-else-if="emailStore.emails.length === 0" class="empty-state">
        <p class="empty-text">No emails yet</p>
        <router-link to="/compose">
          <base-button variant="ghost-primary">Send your first email</base-button>
        </router-link>
      </div>

      <base-card v-else
          variant="elevated"
          padding="sm">
        <div
          v-for="email in emailStore.emails"
          :key="email.id"
          class="email-list-item"
          hoverable
          @click="handleEmailClick(email)"
        >
          <div class="email-card-content">
            <div class="email-info">
              <div class="email-details">
                <p class="email-sender">{{ email.sender }}</p>
                <h3 class="email-subject">{{ email.subject || '(No subject)' }}</h3>
              </div>
              <div class="email-badges">
                <span v-if="!email.read" class="badge unread-badge">Unread</span>
                <span v-if="email.archived" class="badge archived-badge">Archived</span>
                <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="12"
                    width="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  {{ email.attachment_keys.length }}
                </span>
              </div>
            </div>
            <div class="email-date">
              {{ formatDate(email.created_at) }}
            </div>
          </div>
        </div>
      </base-card>

      <div v-if="emailStore.unreadCount > 0" class="unread-count">
        {{ emailStore.unreadCount }} unread email{{ emailStore.unreadCount !== 1 ? 's' : '' }}
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Email } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const emailStore = useEmailStore()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    await emailStore.fetchEmails()
  } catch (error) {
    console.error('Failed to fetch emails:', error)
  }
})

function navigateToCompose() {
  router.push('/compose')
}

function handleEmailClick(email: Email) {
  router.push({ name: 'email-detail', params: { s3Key: encodeURIComponent(email.s3_key) } })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffHours < 24 * 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}
</script>

<style scoped>
.email-list-container {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  padding-top: var(--space-12);
}

.compose-button {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-fixed);
}

.email-header {
  margin-bottom: var(--space-6);
}

.header-content {
  display: flex;
  justify-content: space-between;
  padding-right: var(--space-12);
}

.inbox-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.refresh-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.refresh-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  animation: pulse 2s ease-in-out infinite;
}
.email-list-item {
  padding: var(--space-2) var(--space-1);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background-color 0.2s;
}

.email-list-item:hover {
  background-color: var(--color-bg-muted);
}

.email-list-item:last-child {
  border-bottom: none;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.email-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.loading-state {
  text-align: center;
  padding: var(--space-8);
}

.loading-text {
  margin: 0;
  opacity: 0.7;
}

.error-card {
  color: var(--color-error);
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
}

.empty-text {
  margin: 0 0 var(--space-4) 0;
  opacity: 0.7;
}

.email-list {
  display: flex;
  flex-direction: column;
}

.email-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}

.email-info {
  flex: 1;
  min-width: 0;
}

.email-details {
  margin-bottom: var(--space-1);
}

.email-sender {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  opacity: 0.7;
}

.email-subject {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email-badges {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-xs);
  border-radius: var(--radius-base);
  font-weight: var(--font-weight-medium);
}

.unread-badge {
  background-color: var(--color-info-bg);
  color: var(--color-info);
}

.archived-badge {
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
}

.attachment-badge {
  background-color: var(--color-metered-bg);
  color: var(--color-metered);
}

.email-date {
  font-size: var(--font-size-sm);
  opacity: 0.7;
  white-space: nowrap;
  flex-shrink: 0;
}

.unread-count {
  margin-top: var(--space-2);
  padding: var(--space-2);
  text-align: center;
  font-size: var(--font-size-sm);
  opacity: 0.7;
}
</style>
