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
          <div class="thread-email-header">
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
                v-if="email.s3_key === decodeURIComponent(props.s3Key)"
                @click="handleToggleArchive(email)"
                variant="ghost-secondary"
                size="sm"
                :title="email.archived ? 'Unarchive' : 'Archive'"
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
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
              </base-button>
            </div>
          </div>

          <div v-if="email.cc && email.cc.length > 0" class="cc-info">
            <p class="cc-text"><strong>CC:</strong> {{ email.cc.join(', ') }}</p>
          </div>

          <div v-if="email.body" class="email-body" v-html="parseEmailBody(email.body, email.attachments).content"></div>
          <div v-else class="email-body-loading">
            <p>Loading email content...</p>
          </div>

          <div v-if="email.attachments && email.attachments.length > 0" class="attachments-section">
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

        // Fetch bodies for thread emails that don't have them yet
        const emailsWithoutBodies = threadEmails.value.filter(email => !email.body)
        await Promise.all(
          emailsWithoutBodies.map(async (email) => {
            try {
              await emailStore.fetchEmailDetail(email.s3_key)
              // Update the thread email with the fetched body
              const updatedEmail = emailStore.emails.find(e => e.s3_key === email.s3_key)
              if (updatedEmail) {
                const index = threadEmails.value.findIndex(e => e.s3_key === email.s3_key)
                if (index !== -1) {
                  threadEmails.value[index] = updatedEmail
                }
              }
            } catch (error) {
              console.error(`Failed to fetch body for email ${email.s3_key}:`, error)
            }
          })
        )
      } else {
        // Single email, not part of a thread
        threadEmails.value = [emailStore.currentEmail]
      }

      // Mark the target email as read
      const targetEmail = threadEmails.value.find(e => e.s3_key === decodedKey)
      if (targetEmail && !targetEmail.read) {
        await emailStore.markAsRead(targetEmail.timestamp)
      }

      // Scroll to the target email after rendering
      await nextTick()
      if (targetEmailCard.value && targetEmailCard.value.length > 0) {
        targetEmailCard.value[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  } catch (error) {
    console.error('Failed to fetch email:', error)
  }
})

async function handleToggleArchive(email: Email) {
  try {
    await emailStore.toggleArchived(email.timestamp)
    // Update the local thread emails
    const index = threadEmails.value.findIndex(e => e.timestamp === email.timestamp)
    if (index !== -1) {
      threadEmails.value[index].archived = !threadEmails.value[index].archived
    }
  } catch (error) {
    console.error('Failed to toggle archive:', error)
  }
}

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

.thread-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.thread-email-card {
  scroll-margin-top: var(--space-20);
  transition: all 0.3s ease;
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

.email-body-loading {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
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
  overflow-x: auto;
  overflow-y: hidden;
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
