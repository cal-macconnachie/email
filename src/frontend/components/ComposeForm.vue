<template>
  <div class="compose-container" ref="composeContainer">
    <form class="compose-form" @keydown="handleKeydown">
      <div class="form-field">
        <base-select
          ref="toInput"
          id="to"
          v-model="emailStore.formDataTo"
          label="To"
          placeholder="recipient@example.com"
          searchable
          multiple
          creatable
          size="md"
          required
          :disabled="emailStore.isLoading"
          :options="emailAddressOptions"
        />
      </div>

      <!-- CC/BCC Toggle Button -->
      <div v-if="!showCcBcc && emailStore.formDataCc.length === 0 && emailStore.formDataBcc.length === 0" class="form-field">
        <button
          type="button"
          @click="showCcBcc = true"
          class="cc-bcc-toggle"
          :disabled="emailStore.isLoading"
        >
          <span>+ CC/BCC</span>
        </button>
      </div>

      <!-- CC/BCC Fields (collapsible) -->
      <transition name="slide-fade">
        <div v-if="showCcBcc || emailStore.formDataCc.length > 0 || emailStore.formDataBcc.length > 0" class="cc-bcc-container">
          <div class="form-field">
            <base-select
              id="cc"
              v-model="emailStore.formDataCc"
              label="CC (optional)"
              placeholder="cc@example.com"
              searchable
              multiple
              creatable
              size="md"
              :disabled="emailStore.isLoading"
              :options="emailAddressOptions"
            />
          </div>

          <div class="form-field">
            <base-select
              id="bcc"
              v-model="emailStore.formDataBcc"
              label="BCC (optional)"
              placeholder="bcc@example.com"
              searchable
              multiple
              creatable
              size="md"
              :disabled="emailStore.isLoading"
              :options="emailAddressOptions"
            />
          </div>
        </div>
      </transition>

      <div class="form-field">
        <base-input
          id="subject"
          v-model="emailStore.formDataSubject"
          type="text"
          label="Subject"
          placeholder="Email subject"
          required
          :disabled="emailStore.isLoading"
        />
      </div>

      <div class="form-field form-field-textarea">
        <base-textarea
          id="body"
          v-model="emailStore.formDataBody"
          label="Message"
          :rows="8"
          placeholder="Write your message..."
          required
          :disabled="emailStore.isLoading"
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
          :disabled="emailStore.isLoading"
          style="display: none;"
        />
        <base-button
          type="button"
          variant="ghost-secondary"
          size="sm"
          @click="fileInput?.click()"
          :disabled="emailStore.isLoading || hasUploadingAttachments"
        >
          <base-icon name="paperclip" size="16px" style="margin-right: 8px;" />
          Add Attachments
        </base-button>

        <transition-group name="list" tag="div" v-if="emailStore.attachments.length > 0" class="attachments-list">
          <div
            v-for="attachment in emailStore.attachments"
            :key="attachment.key"
            class="attachment-item"
            :class="{ 'attachment-uploading': attachment.uploading }"
          >
            <base-icon name="paperclip" size="16px" class="attachment-icon" />
            <span class="attachment-name">{{ attachment.filename }}</span>
            <span class="attachment-size">({{ formatFileSize(attachment.size) }})</span>
            <span v-if="attachment.uploading" class="attachment-status">
              <span class="uploading-spinner"></span>
              Uploading...
            </span>
            <button
              v-else
              type="button"
              @click="handleRemoveAttachment(attachment.key)"
              class="remove-button"
              :disabled="emailStore.isLoading"
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
        </transition-group>
      </div>

      <div v-if="emailStore.error" class="error-message" role="alert">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="16"
          width="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          style="margin-right: 8px; flex-shrink: 0;"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        {{ emailStore.error }}
      </div>

      <div class="form-actions">
        <base-button
          type="button"
          variant="ghost-secondary"
          @click="handleCancel"
          :disabled="emailStore.isLoading"
        >
          Cancel
        </base-button>

        <base-button
          type="button"
          variant="ghost-primary"
          :disabled="emailStore.isLoading || hasUploadingAttachments || !isFormValid"
          @click="handleSend"
        >
          {{ emailStore.isLoading ? 'Sending...' : 'Send' }}
        </base-button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEmailStore } from '../stores/email'
import { api } from '../api/client'

const router = useRouter()
const route = useRoute()
const emailStore = useEmailStore()
const composeContainer = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const toInput = ref<HTMLInputElement | null>(null)
const showCcBcc = ref(false)

// Track touch start position for scroll handling
let touchStartY = 0
let scrollStartTop = 0

// Computed properties for better UX
const hasUploadingAttachments = computed(() =>
  emailStore.attachments.some(a => a.uploading)
)

const isFormValid = computed(() => {
  const hasTo = emailStore.formDataTo.length > 0
  const hasSubject = emailStore.formDataSubject.trim().length > 0
  const hasBody = emailStore.formDataBody.trim().length > 0
  return hasTo && hasSubject && hasBody
})

// Extract unique email addresses from all emails for autocomplete
const emailAddressOptions = computed(() => {
  const uniqueEmails = new Set<string>()

  // Add all senders and recipients from emails
  emailStore.emails.forEach(email => {
    if (email.sender) {
      uniqueEmails.add(email.sender)
    }
    if (email.recipient) {
      uniqueEmails.add(email.recipient)
    }
  })

  // Convert to array, sort alphabetically, and format for base-select
  return Array.from(uniqueEmails)
    .sort()
    .map(email => ({
      value: email,
      label: email
    }))
})

// Handle touch events to prevent drawer close when scrolling
function handleTouchStart(event: TouchEvent) {
  if (composeContainer.value) {
    touchStartY = event.touches[0].clientY
    scrollStartTop = composeContainer.value.scrollTop
  }
}

function handleTouchMove(event: TouchEvent) {
  if (!composeContainer.value) return

  const touchY = event.touches[0].clientY
  const touchDelta = touchY - touchStartY
  const scrollTop = composeContainer.value.scrollTop

  // Only allow drawer close gesture if:
  // 1. Currently at the top (scrollTop === 0)
  // 2. Touch started at the top (scrollStartTop === 0)
  // 3. User is pulling down (touchDelta > 0)
  if (scrollTop === 0 && touchDelta > 0 && scrollStartTop === 0) {
    // Allow drawer close gesture - don't stop propagation
    return
  }

  // In all other cases, prevent the drawer from receiving the event
  // This includes:
  // - Scrolling within content (scrollTop > 0)
  // - Scrolling down (touchDelta < 0)
  // - At top but touch didn't start at top (scrollStartTop > 0)
  event.stopPropagation()
}

onMounted(() => {
  // Pre-fill form if replying to an email
  if (route.query.replyTo) {
    emailStore.formDataTo = [route.query.replyTo as string]
  }
  if (route.query.subject) {
    emailStore.formDataSubject = route.query.subject as string
  }
  if (route.query.inReplyTo) {
    emailStore.replyData.inReplyTo = route.query.inReplyTo as string
  }

  // Build references array for proper threading
  if (route.query.references) {
    const refsString = route.query.references as string
    emailStore.replyData.references = refsString ? refsString.split(',') : []
  } else {
    emailStore.replyData.references = []
  }

  // Always add the inReplyTo to references for proper threading (if it exists and not already included)
  if (emailStore.replyData.inReplyTo && !emailStore.replyData.references.includes(emailStore.replyData.inReplyTo)) {
    emailStore.replyData.references.push(emailStore.replyData.inReplyTo)
  }

  // Show CC/BCC if they have values (e.g., from query params)
  if (emailStore.formDataCc.length > 0 || emailStore.formDataBcc.length > 0) {
    showCcBcc.value = true
  }

  // Focus the To field for better UX
  nextTick(() => {
    if (toInput.value && emailStore.formDataTo.length === 0) {
      const inputElement = toInput.value as any
      if (inputElement.$el?.querySelector('input')) {
        inputElement.$el.querySelector('input').focus()
      }
    }
  })

  // Add touch event listeners to prevent drawer close when scrolling
  if (composeContainer.value) {
    composeContainer.value.addEventListener('touchstart', handleTouchStart, { passive: true })
    composeContainer.value.addEventListener('touchmove', handleTouchMove, { passive: false })
  }
})

onUnmounted(() => {
  // Clean up touch event listeners
  if (composeContainer.value) {
    composeContainer.value.removeEventListener('touchstart', handleTouchStart)
    composeContainer.value.removeEventListener('touchmove', handleTouchMove)
  }
})

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  // Cmd/Ctrl + Enter to send
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    if (!emailStore.isLoading && !hasUploadingAttachments.value && isFormValid.value) {
      handleSend()
    }
  }

  // Escape to close
  if (event.key === 'Escape' && !emailStore.isLoading) {
    event.preventDefault()
    handleCancel()
  }
}

async function handleSend() {
  // Prevent sending if already loading or uploading
  if (emailStore.isLoading || hasUploadingAttachments.value) {
    return
  }

  // Clear any previous errors
  emailStore.error = null

  try {
    const emailData = {
      to: emailStore.formDataTo,
      subject: emailStore.formDataSubject,
      body: emailStore.formDataBody,
      cc: emailStore.formDataCc.length > 0 ? emailStore.formDataCc : undefined,
      bcc: emailStore.formDataBcc.length > 0 ? emailStore.formDataBcc : undefined,
      inReplyTo: emailStore.replyData.inReplyTo,
      references: emailStore.replyData.references,
      attachmentKeys: emailStore.attachments.map(a => a.key),
    }

    await emailStore.sendEmail(emailData)

    // Reset form and close drawer after successful send
    emailStore.resetCompose()
    showCcBcc.value = false

    // Navigate to emails list
    router.push('/emails')
  } catch (error) {
    console.error('Failed to send email:', error)
    // Error is already set in the store by sendEmail
  }
}

function handleCancel() {
  // Reset form and close drawer
  emailStore.resetCompose()
  showCcBcc.value = false
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
  overscroll-behavior-y: contain;
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

/* CC/BCC Toggle Button */
.cc-bcc-toggle {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: var(--space-2) 0;
  text-align: left;
  transition: color 0.2s ease;
}

.cc-bcc-toggle:hover:not(:disabled) {
  color: var(--color-text);
}

.cc-bcc-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cc-bcc-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Slide fade transition for CC/BCC */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* List transitions for attachments */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-move {
  transition: transform 0.3s ease;
}

.error-message {
  display: flex;
  align-items: center;
  padding: var(--space-3);
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-error-border);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-actions {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-4);
  gap: var(--space-3);
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
  padding: var(--space-2) var(--space-3);
  background-color: var(--color-bg-muted);
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease;
}

.attachment-item.attachment-uploading {
  opacity: 0.7;
  background-color: var(--color-bg-secondary);
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
  min-width: 0;
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
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.uploading-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-text-secondary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.remove-button:hover:not(:disabled) {
  background-color: var(--color-bg-tertiary);
  color: var(--color-error);
}

.remove-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
