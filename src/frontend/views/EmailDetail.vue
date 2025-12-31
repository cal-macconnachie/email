<template>
  <div class="email-detail-container">
    <header class="email-detail-header">
      <div class="header-content">
        <base-button @click="router.back()" variant="ghost-secondary" class="back-button">←</base-button>

        <div v-if="emailStore.currentEmail" class="email-header-info">
          <div class="email-header-main">
            <h1 class="email-title">{{ emailStore.currentEmail.subject || '(No subject)' }}</h1>
            <div class="email-meta">
              <p class="meta-item"><strong>From:</strong> {{ emailStore.currentEmail.sender }}</p>
              <p class="meta-item"><strong>To:</strong> {{ emailStore.currentEmail.recipient }}</p>
              <p class="meta-item"><strong>Date:</strong> {{ formatFullDate(emailStore.currentEmail.created_at) }}</p>
            </div>
          </div>

          <div class="email-header-actions">
            <base-button @click="handleToggleArchive" variant="ghost-secondary">
              {{ emailStore.currentEmail.archived ? 'Unarchive' : 'Archive' }}
            </base-button>
            <base-button @click="handleReply" variant="ghost-primary">Reply</base-button>
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

      <base-card v-else-if="emailStore.currentEmail" variant="elevated" padding="lg">
        <div v-if="emailStore.currentEmail.cc && emailStore.currentEmail.cc.length > 0" class="cc-info">
          <p class="cc-text"><strong>CC:</strong> {{ emailStore.currentEmail.cc.join(', ') }}</p>
        </div>

        <div class="email-body" v-html="parsedBody.content"></div>

        <div v-if="emailStore.currentEmail.attachment_keys && emailStore.currentEmail.attachment_keys.length > 0" class="attachments-section">
          <h3 class="section-title">Attachments ({{ emailStore.currentEmail.attachment_keys.length }})</h3>
          <div class="attachments-list">
            <div
              v-for="(key, index) in emailStore.currentEmail.attachment_keys"
              :key="key"
              class="attachment-item"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="16"
                width="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="attachment-icon"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span class="attachment-name">{{ getFilename(key) }}</span>
            </div>
          </div>
        </div>

        <div v-if="emailStore.currentEmail.thread_id && threadEmails.length > 1" class="thread-section">
          <h3 class="section-title">Thread ({{ threadEmails.length }} messages)</h3>
          <div class="thread-list">
            <div
              v-for="email in threadEmails"
              :key="email.id"
              class="thread-item"
              :class="{ 'thread-item-active': email.id === emailStore.currentEmail.id }"
              @click="handleThreadEmailClick(email)"
            >
              <div class="thread-item-content">
                <div class="thread-item-info">
                  <p class="thread-subject">{{ email.subject || '(No subject)' }}</p>
                  <p class="thread-sender">{{ email.sender }}</p>
                </div>
                <p class="thread-date">{{ formatDate(email.created_at) }}</p>
              </div>
            </div>
          </div>
        </div>
      </base-card>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Email } from '../api/client'
import { useEmailStore } from '../stores/email'

const props = defineProps<{
  s3Key: string
}>()

const router = useRouter()
const route = useRoute()
const emailStore = useEmailStore()
const threadEmails = ref<Email[]>([])
const parsedBody = ref<{ isHtml: boolean; content: string }>({ isHtml: false, content: '' })

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
      // Fetch from API if not cached
      await emailStore.fetchEmailDetail(decodedKey)
    }

    if (emailStore.currentEmail) {
      // Parse the email body
      parsedBody.value = parseEmailBody(emailStore.currentEmail.body)

      if (!emailStore.currentEmail.read) {
        await emailStore.markAsRead(emailStore.currentEmail.timestamp)
      }

      if (emailStore.currentEmail.thread_id) {
        threadEmails.value = await emailStore.fetchThread(emailStore.currentEmail.thread_id, false)
      }
    }
  } catch (error) {
    console.error('Failed to fetch email:', error)
  }
})

async function handleToggleArchive() {
  if (!emailStore.currentEmail) return
  try {
    await emailStore.toggleArchived(emailStore.currentEmail.timestamp)
  } catch (error) {
    console.error('Failed to toggle archive:', error)
  }
}

function handleReply() {
  if (!emailStore.currentEmail) return

  router.push({
    name: 'compose',
    query: {
      replyTo: emailStore.currentEmail.sender,
      subject: `Re: ${emailStore.currentEmail.subject || ''}`,
      inReplyTo: emailStore.currentEmail.message_id,
      references: emailStore.currentEmail.references?.join(',') || '',
    },
  })
}

function handleThreadEmailClick(email: Email) {
  router.push({ name: 'email-detail', params: { s3Key: encodeURIComponent(email.s3_key) } })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getFilename(key: string): string {
  return key.split('/').pop() || key
}

function parseEmailBody(rawBody: string): { isHtml: boolean; content: string } {
  if (!rawBody) return { isHtml: false, content: '' }

  // Check if the body contains MIME headers
  const headerEndIndex = rawBody.search(/\r?\n\r?\n/)

  if (headerEndIndex === -1) {
    // No headers found, treat as plain text or HTML based on content
    const isHtml = /<[a-z][\s\S]*>/i.test(rawBody)
    return {
      isHtml,
      content: isHtml ? rawBody : rawBody.replace(/\r?\n/g, '<br>')
    }
  }

  // Extract headers and body
  const headerSection = rawBody.substring(0, headerEndIndex)
  let bodyContent = rawBody.substring(headerEndIndex).trim()

  // Parse headers
  const headers: Record<string, string> = {}
  const headerLines = headerSection.split(/\r?\n/)

  for (const line of headerLines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase()
      const value = line.substring(colonIndex + 1).trim()
      headers[key] = value
    }
  }

  // Get content type and encoding
  const contentType = headers['content-type'] || ''
  const transferEncoding = headers['content-transfer-encoding'] || ''
  const isHtml = contentType.toLowerCase().includes('text/html')

  // Decode based on Content-Transfer-Encoding
  if (transferEncoding.toLowerCase() === 'quoted-printable') {
    bodyContent = decodeQuotedPrintable(bodyContent)
  } else if (transferEncoding.toLowerCase() === 'base64') {
    try {
      bodyContent = atob(bodyContent.replace(/\s/g, ''))
    } catch (e) {
      console.error('Failed to decode base64:', e)
    }
  }

  // If it's plain text, convert newlines to <br>
  if (!isHtml) {
    bodyContent = bodyContent.replace(/\r?\n/g, '<br>')
  }

  return { isHtml, content: bodyContent }
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
</script>

<style scoped>
.email-detail-container {
  min-height: 100vh;
  background-color: var(--color-bg-secondary);
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

.cc-info {
  margin-bottom: var(--space-4);
}

.cc-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.email-body {
  line-height: var(--line-height-relaxed);
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.attachments-section {
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border);
}

.section-title {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background-color: var(--color-bg-muted);
  border-radius: var(--radius-md);
}

.attachment-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.attachment-name {
  flex: 1;
  font-size: var(--font-size-sm);
}

.thread-section {
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border);
}

.thread-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.thread-item {
  padding: var(--space-3);
  background-color: var(--color-bg-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.thread-item:hover {
  background-color: var(--color-bg-secondary);
}

.thread-item-active {
  background-color: var(--color-primary-light);
}

.thread-item-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}

.thread-item-info {
  flex: 1;
}

.thread-subject {
  margin: 0 0 var(--space-1) 0;
  font-weight: var(--font-weight-medium);
}

.thread-sender {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.thread-date {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .email-detail-main {
    padding: var(--space-4);
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
}
</style>
