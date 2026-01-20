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
          <base-icon name="reply" size="16px" />
        </base-button>
        <base-button
          v-if="email.s3_key === decodedS3Key"
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
          <base-icon v-else-if="!email.archived" name="file-cabinet" size="16px" />
          <!-- Unarchive icon (box with up arrow) -->
          <base-icon v-else name="file-cabinet" size="16px" />
        </base-button>
      </div>
    </div>

    <div v-if="email?.cc && email.cc.length > 0" class="cc-info">
      <p class="cc-text"><strong>CC:</strong> {{ email.cc.join(', ') }}</p>
    </div>

    <div v-if="parsedContent.html || parsedContent.text" class="email-body">
      <div v-if="parsedContent.html" v-html="parsedContent.html"></div>
      <div v-else-if="parsedContent.text" v-html="parsedContent.text.replace(/\n/g, '<br>')"></div>
    </div>
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
          <base-icon name="paperclip" size="16px" class="attachment-icon" />
          <span class="attachment-name">{{ attachment.filename }}</span>
          <base-icon name="download" size="16px" class="download-icon" />
        </a>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import PostalMime from 'postal-mime'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Email } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useEmailStore } from '../stores/email'

const props = defineProps<{
  s3Key: string
}>()

const emailStore = useEmailStore()
const authStore = useAuthStore()
const isArchiving = ref(false)
const isLoadingBody = ref(false)
const emailContainer = ref<HTMLElement | null>(null)
let intersectionObserver: IntersectionObserver | null = null
const email = ref<Email | null>(null)
const decodedS3Key = decodeURIComponent(props.s3Key)
const parsedContent = ref<{ html?: string; text?: string }>({ html: undefined, text: undefined })

function isUserReceivedEmail(): boolean {
  if (!email.value) return false
  return authStore.selectedRecipient === email.value.recipient
}

// Fetch email body once on mount
onMounted(async () => {
  // Only fetch if we don't have a body
  await nextTick()
  email.value = emailStore.emails.find(e => e.s3_key === decodedS3Key) || null
  if (!email.value?.body) {
    isLoadingBody.value = true
    try {
      console.log('Fetching email body for', decodedS3Key)
      await emailStore.fetchEmailDetail(decodedS3Key)
      email.value = emailStore.emails.find(e => e.s3_key === decodedS3Key) || null
    } catch (error) {
      console.error('Failed to fetch email body:', error)
    } finally {
      isLoadingBody.value = false
    }
  }

  // Parse email body
  if (email.value?.body) {
    try {
      // Check if body is already HTML or raw MIME
      const isAlreadyHtml = email.value.body.trim().startsWith('<')

      if (isAlreadyHtml) {
        // Body is already HTML, directly replace cid: references
        let htmlContent = email.value.body

        // Replace cid: references with presigned URLs from email.attachments
        if (email.value.attachments && email.value.attachments.length > 0) {
          email.value.attachments.forEach(att => {
            if (att.contentId) {
              // Replace cid: references with presigned URLs
              // Handle both with and without angle brackets
              const cidPatterns = [
                new RegExp(`cid:${att.contentId}`, 'gi'),
                new RegExp(`cid:${att.contentId.replace(/^<|>$/g, '')}`, 'gi')
              ]
              cidPatterns.forEach(pattern => {
                htmlContent = htmlContent.replace(pattern, att.viewUrl)
              })
            }
          })
        }

        parsedContent.value = {
          html: htmlContent
        }
      } else {
        // Body is raw MIME, use postal-mime to parse
        const parser = new PostalMime()
        const parsed = await parser.parse(email.value.body)

        // Extract HTML or text content
        let htmlContent = parsed.html || ''
        const textContent = parsed.text || ''

        // If we have inline attachments, replace cid: references with presigned URLs
        if (parsed.attachments && parsed.attachments.length > 0 && email.value.attachments) {
          // Map postal-mime attachments to our attachment URLs using contentId
          parsed.attachments.forEach(parsedAtt => {
            if (parsedAtt.contentId && parsedAtt.related) {
              // Find matching attachment in our email.attachments by contentId
              const matchingAtt = email.value?.attachments?.find(att => {
                // Try to match by contentId (removing < > brackets if present)
                const cleanContentId = parsedAtt.contentId?.replace(/^<|>$/g, '') || ''
                return att.contentId === cleanContentId ||
                       att.contentId === parsedAtt.contentId ||
                       att.filename === parsedAtt.filename
              })

              if (matchingAtt && htmlContent) {
                // Replace cid: references with presigned URLs
                const cidPattern = new RegExp(`cid:${parsedAtt.contentId.replace(/^<|>$/g, '')}`, 'gi')
                htmlContent = htmlContent.replace(cidPattern, matchingAtt.viewUrl)
              }
            }
          })
        }

        // Store parsed content, or fall back to raw body if parsing returned nothing
        parsedContent.value = {
          html: htmlContent || undefined,
          text: textContent || undefined
        }

        // If both html and text are empty after parsing, use raw body as fallback
        if (!parsedContent.value.html && !parsedContent.value.text && email.value.body) {
          parsedContent.value = {
            text: email.value.body
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse email body:', error)
      // Fallback: treat body as plain text
      parsedContent.value = {
        text: email.value.body
      }
    }
  }

  // Set up intersection observer to mark as read when in viewport
  if (emailContainer.value) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If email is in viewport and is unread, mark as read
          if (entry.isIntersecting && email.value && !email.value.read && isUserReceivedEmail()) {
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
  min-width: 0;
  max-width: 100%;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.thread-email-meta {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.thread-email-sender {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  word-break: break-word;
  overflow-wrap: break-word;
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

.email-body :deep(table) {
  max-width: 100%;
  overflow-x: auto;
  display: block;
}

.email-body :deep(img) {
  max-width: 100%;
  height: auto;
}

.email-body :deep(pre) {
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
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
  word-break: break-word;
  overflow-wrap: break-word;
  min-width: 0;
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

@media (max-width: 768px) {
  .thread-email-actions {
    gap: var(--space-3);
  }

  .attachment-item {
    min-height: 44px;
  }
}
</style>