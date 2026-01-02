<template>
  <div class="compose-container" ref="composeContainer" @touchstart="handleTouchStart" @touchmove="handleTouchMove">
    <form class="compose-form">
      <div class="form-field">
        <base-input
          id="to"
          v-model="emailStore.formData.to"
          type="email"
          label="To"
          placeholder="recipient@example.com"
          required
          hint="For multiple recipients, separate with commas"
        />
      </div>

      <div class="form-field">
        <base-input
          id="cc"
          v-model="emailStore.formData.cc"
          type="text"
          label="CC (optional)"
          placeholder="cc@example.com"
        />
      </div>

      <div class="form-field">
        <base-input
          id="bcc"
          v-model="emailStore.formData.bcc"
          type="text"
          label="BCC (optional)"
          placeholder="bcc@example.com"
        />
      </div>

      <div class="form-field">
        <base-input
          id="subject"
          v-model="emailStore.formData.subject"
          type="text"
          label="Subject"
          placeholder="Email subject"
          required
        />
      </div>

      <div class="form-field form-field-textarea">
        <base-textarea
          id="body"
          v-model="emailStore.formData.body"
          label="Message"
          :rows="8"
          placeholder="Write your message..."
          required
        />
      </div>

      <div class="form-field">
        <label class="attachment-label">Attachments</label>
        <input
          ref="fileInput"
          type="file"
          multiple
          @change="handleFileSelect"
          class="file-input"
          style="display: none;"
        />
        <base-button
          type="button"
          variant="ghost-secondary"
          size="sm"
          @click="fileInput?.click()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="16"
            width="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            style="margin-right: 8px;"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          Add Attachments
        </base-button>

        <div v-if="emailStore.attachments.length > 0" class="attachments-list">
          <div
            v-for="attachment in emailStore.attachments"
            :key="attachment.key"
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
            <span class="attachment-size">({{ formatFileSize(attachment.size) }})</span>
            <span v-if="attachment.uploading" class="attachment-status">Uploading...</span>
            <button
              v-else
              type="button"
              @click="handleRemoveAttachment(attachment.key)"
              class="remove-button"
              title="Remove attachment"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="16"
                width="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="emailStore.error" class="error-message">
        {{ emailStore.error }}
      </div>

      <div class="form-actions">
        <base-button
          type="button"
          variant="ghost-secondary"
          @click="handleCancel"
        >
          Cancel
        </base-button>

        <base-button
          variant="ghost-primary"
          :disabled="emailStore.isLoading"
          @click="handleSend"
        >
          {{ emailStore.isLoading ? 'Sending...' : 'Send' }}
        </base-button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEmailStore } from '../stores/email'
import { api } from '../api/client'

const router = useRouter()
const route = useRoute()
const emailStore = useEmailStore()
const composeContainer = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

let touchStartY = 0
let scrollTopAtTouchStart = 0

onMounted(() => {
  // Pre-fill form if replying to an email
  if (route.query.replyTo) {
    emailStore.formData.to = route.query.replyTo as string
  }
  if (route.query.subject) {
    emailStore.formData.subject = route.query.subject as string
  }
  if (route.query.inReplyTo) {
    emailStore.replyData.inReplyTo = route.query.inReplyTo as string
  }
  if (route.query.references) {
    const refsString = route.query.references as string
    emailStore.replyData.references = refsString ? refsString.split(',') : []
    // Add the inReplyTo to references for proper threading
    if (emailStore.replyData.inReplyTo) {
      emailStore.replyData.references.push(emailStore.replyData.inReplyTo)
    }
  }
})

function handleTouchStart(event: TouchEvent) {
  if (!composeContainer.value) return
  touchStartY = event.touches[0].clientY
  scrollTopAtTouchStart = composeContainer.value.scrollTop
}

function handleTouchMove(event: TouchEvent) {
  if (!composeContainer.value) return

  const touchY = event.touches[0].clientY
  const touchDeltaY = touchY - touchStartY
  const currentScrollTop = composeContainer.value.scrollTop

  // If user is scrolling down (touchDeltaY > 0) and we're not at the top,
  // or scrolling up (touchDeltaY < 0) and we're not at the bottom,
  // then stop the event from propagating to prevent drawer close
  const isScrollingDown = touchDeltaY > 0
  const isAtTop = currentScrollTop === 0
  const isAtBottom = currentScrollTop + composeContainer.value.clientHeight >= composeContainer.value.scrollHeight

  // Prevent drawer close when:
  // - Scrolling up (regardless of position)
  // - Scrolling down when not at the top
  if (!isScrollingDown || !isAtTop) {
    event.stopPropagation()
  }
}

async function handleSend() {
  try {
    const emailData = {
      to: emailStore.formData.to.split(',').map(e => e.trim()).filter(e => e),
      subject: emailStore.formData.subject,
      body: emailStore.formData.body,
      cc: emailStore.formData.cc ? emailStore.formData.cc.split(',').map(e => e.trim()).filter(e => e) : undefined,
      bcc: emailStore.formData.bcc ? emailStore.formData.bcc.split(',').map(e => e.trim()).filter(e => e) : undefined,
      inReplyTo: emailStore.replyData.inReplyTo,
      references: emailStore.replyData.references,
      attachmentKeys: emailStore.attachments.map(a => a.key),
    }

    await emailStore.sendEmail(emailData)
    router.push('/emails')
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

function handleCancel() {
  emailStore.resetCompose()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    try {
      // Get presigned upload URL
      const { uploadUrl, attachmentKey } = await api.attachments.getUploadUrl(
        file.name,
        file.type || 'application/octet-stream'
      )

      // Add to store with uploading state
      emailStore.addAttachment(attachmentKey, file.name, file.size)
      emailStore.setAttachmentUploading(attachmentKey, true)

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      })

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload ${file.name}`)
      }

      // Mark as uploaded
      emailStore.setAttachmentUploading(attachmentKey, false)
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error)
      emailStore.error = `Failed to upload ${file.name}`
    }
  }

  // Reset file input
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function handleRemoveAttachment(key: string) {
  emailStore.removeAttachment(key)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
</script>

<style scoped>
.compose-container {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  height: 100%;
  margin: var(--space-4);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-6);
  padding-right: var(--space-12);
}

.compose-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
}

.compose-card {
  max-width: 800px;
  margin: 0 auto;
}

.compose-title {
  margin: 0 0 var(--space-6) 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.compose-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-2);
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-field-textarea {
  margin-bottom: var(--space-2);
}

.error-message {
  padding: var(--space-3);
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-error-border);
}

.form-actions {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-4);
}

.attachment-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.attachments-list {
  margin-top: var(--space-3);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.attachment-status {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

.remove-button {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.remove-button:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-error);
}

@media (max-width: 768px) {
  .compose-main {
    padding: var(--space-4);
  }

  .header-content {
    padding: var(--space-3) var(--space-4);
    padding-right: var(--space-12);
  }
}
</style>
