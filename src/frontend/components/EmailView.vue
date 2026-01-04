<template>
  <div ref="emailContainer" class="email-container">
    <div v-if="email != null" class="thread-email-header">
      <div class="thread-email-meta">
        <p class="thread-email-sender"><strong>From:</strong> {{ email.sender }}</p>
        <p class="thread-email-date">{{ formatFullDate(email.created_at) }}</p>
      </div>
      <div class="thread-email-actions">
        <base-button
          @click="handleReply(email)"
          variant="ghost-secondary"
          size="sm"
          title="Reply"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 14l-5-5 5-5"/>
            <path d="M4 9h10.5a5.5 5.5 0 010 11H12"/>
          </svg>
        </base-button>
        <base-button
          v-if="email.s3_key === decodeURIComponent(s3Key)"
          @click="handleToggleArchive(email)"
          variant="ghost-secondary"
          size="sm"
          :disabled="isArchiving"
          :title="isArchiving ? (email.archived ? 'Unarchiving...' : 'Archiving...') : (email.archived ? 'Unarchive' : 'Archive')"
        >
          <!-- Loading spinner -->
          <svg
            v-if="isArchiving"
            class="archive-spinner"
            xmlns="http://www.w3.org/2000/svg"
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <!-- Archive icon (box with down arrow) -->
          <svg
            v-else-if="!email.archived"
            xmlns="http://www.w3.org/2000/svg"
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="21 8 21 21 3 21 3 8"></polyline>
            <rect x="1" y="3" width="22" height="5"></rect>
            <line x1="10" y1="12" x2="14" y2="12"></line>
          </svg>
          <!-- Unarchive icon (box with up arrow) -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="21 8 21 21 3 21 3 8"></polyline>
            <rect x="1" y="3" width="22" height="5"></rect>
            <polyline points="10 12 12 10 14 12"></polyline>
          </svg>
        </base-button>
      </div>
    </div>

    <div v-if="email?.cc && email.cc.length > 0" class="cc-info">
      <p class="cc-text"><strong>CC:</strong> {{ email.cc.join(', ') }}</p>
    </div>

    <div v-if="email?.body" class="email-body" v-html="parseEmailBody(email.body, email.attachments).content"></div>
    <div v-else class="email-body-loading">
      <p>{{ isLoadingBody ? 'Loading email content...' : 'No content available' }}</p>
    </div>

    <div v-if="email?.attachments && email.attachments.length > 0" class="attachments-section">
      <h3 class="section-title">Attachments ({{ email.attachments.length }})</h3>
      <div class="attachments-list">
        <a
          v-for="attachment in email.attachments"
          :key="attachment.key"
          :href="attachment.downloadUrl"
          :download="attachment.filename"
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
          <span class="attachment-name">{{ attachment.filename }}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="download-icon"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Email } from '../api/client'
import { useEmailStore } from '../stores/email'

const props = defineProps<{
  s3Key: string
}>()

const emailStore = useEmailStore()
const isArchiving = ref(false)
const isLoadingBody = ref(false)
const emailContainer = ref<HTMLElement | null>(null)
let intersectionObserver: IntersectionObserver | null = null
const email = ref<Email | null>(null)

// Fetch email body once on mount
onMounted(async () => {
  // Only fetch if we don't have a body
  email.value = emailStore.emails.find(e => e.s3_key === decodeURIComponent(props.s3Key)) || null
  if (!email.value?.body) {
    isLoadingBody.value = true
    try {
      await emailStore.fetchEmailDetail(props.s3Key)
      email.value = emailStore.emails.find(e => e.s3_key === decodeURIComponent(props.s3Key)) || null
    } catch (error) {
      console.error('Failed to fetch email body:', error)
    } finally {
      isLoadingBody.value = false
    }
  }

  // Set up intersection observer to mark as read when in viewport
  if (emailContainer.value) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If email is in viewport and is unread, mark as read
          if (entry.isIntersecting && email.value && !email.value.read ) {
            emailStore.markAsRead(email.value.timestamp)
          }
        })
      },
      {
        // Trigger when at least 50% of the email is visible
        threshold: 0.5,
        rootMargin: '0px'
      }
    )

    intersectionObserver.observe(emailContainer.value)
  }
})

// Clean up intersection observer
onUnmounted(() => {
  if (intersectionObserver && emailContainer.value) {
    intersectionObserver.unobserve(emailContainer.value)
    intersectionObserver.disconnect()
  }
})

function handleReply(email: Email) {
  emailStore.prepareReply(email)
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function parseEmailBody(rawBody: string, attachments?: Array<{ key: string; filename: string; viewUrl: string; downloadUrl: string; contentId?: string }>): { isHtml: boolean; content: string } {
  if (!rawBody) return { isHtml: false, content: '' }

  // Check if the body contains MIME headers
  const headerEndIndex = rawBody.search(/\r?\n\r?\n/)

  if (headerEndIndex === -1) {
    // No headers found, treat as plain text or HTML based on content
    const isHtml = /<[a-z][\s\S]*>/i.test(rawBody)
    let content = isHtml ? rawBody : rawBody.replace(/\r?\n/g, '<br>')

    // Replace inline attachment references with actual URLs
    if (attachments && attachments.length > 0) {
      content = replaceInlineAttachments(content, attachments)
    }

    return { isHtml, content }
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

  // Replace inline attachment references with actual URLs
  if (attachments && attachments.length > 0) {
    bodyContent = replaceInlineAttachments(bodyContent, attachments)
  }

  return { isHtml, content: bodyContent }
}
async function handleToggleArchive(email: Email) {
  if (isArchiving.value) return

  isArchiving.value = true
  try {
    await emailStore.toggleArchived(email.timestamp)
    // The email will be updated in the store, parent component will handle re-rendering
  } catch (error) {
    console.error('Failed to toggle archive:', error)
  } finally {
    isArchiving.value = false
  }
}

function replaceInlineAttachments(content: string, attachments: Array<{ key: string; filename: string; viewUrl: string; downloadUrl: string; contentId?: string }>): string {
  // Replace cid: references with actual presigned URLs
  // Pattern: src="cid:filename" or src='cid:filename'
  return content.replace(/src=["']cid:([^"']+)["']/gi, (match, cid) => {
    // Try to find the attachment by matching the Content-ID first
    const attachment = attachments.find(att => {
      // First try to match by Content-ID (most reliable)
      if (att.contentId === cid) {
        return true
      }
      // Fallback: try matching against filename or key
      return att.filename === cid || att.key.includes(cid)
    })

    if (attachment) {
      return `src="${attachment.viewUrl}"`
    }

    // If no match found, return original
    return match
  })
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
</script>

<style scoped>
.email-container {
  width: 100%;
}

.thread-email-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.thread-email-meta {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.thread-email-sender {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.thread-email-date {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.thread-email-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
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
  overflow-x: auto;
  overflow-y: hidden;
}

.email-body-loading {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
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
  text-decoration: none;
  color: var(--color-text);
  transition: background-color 0.2s ease;
}

.attachment-item:hover {
  background-color: var(--color-bg-tertiary);
}

.attachment-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.attachment-name {
  flex: 1;
  font-size: var(--font-size-sm);
}

.download-icon {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.archive-spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>