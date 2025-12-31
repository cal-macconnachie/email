<template>
  <div class="compose-container">
    <header class="compose-header">
      <div class="header-content">
        <base-button @click="handleCancel" variant="secondary">← Cancel</base-button>
      </div>
    </header>

    <main class="compose-main">
      <base-card variant="elevated" padding="lg" class="compose-card">
        <h1 class="compose-title">Compose Email</h1>

        <form class="compose-form">
          <div class="form-field">
            <base-input
              id="to"
              v-model="formData.to"
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
              v-model="formData.cc"
              type="text"
              label="CC (optional)"
              placeholder="cc@example.com"
            />
          </div>

          <div class="form-field">
            <base-input
              id="bcc"
              v-model="formData.bcc"
              type="text"
              label="BCC (optional)"
              placeholder="bcc@example.com"
            />
          </div>

          <div class="form-field">
            <base-input
              id="subject"
              v-model="formData.subject"
              type="text"
              label="Subject"
              placeholder="Email subject"
              required
            />
          </div>

          <div class="form-field form-field-textarea">
            <base-textarea
              id="body"
              v-model="formData.body"
              label="Message"
              :rows="12"
              placeholder="Write your message..."
              required
            />
          </div>

          <div v-if="emailStore.error" class="error-message">
            {{ emailStore.error }}
          </div>

          <div class="form-actions">
            <base-button
              type="button"
              variant="secondary"
              @click="handleCancel"
            >
              Cancel
            </base-button>

            <base-button
              variant="primary"
              :disabled="emailStore.isLoading"
              @click="handleSend"
            >
              {{ emailStore.isLoading ? 'Sending...' : 'Send' }}
            </base-button>
          </div>
        </form>
      </base-card>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const route = useRoute()
const emailStore = useEmailStore()

const formData = ref({
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: '',
})

const replyData = ref<{
  inReplyTo?: string
  references?: string[]
}>({})

onMounted(() => {
  // Pre-fill form if replying to an email
  if (route.query.replyTo) {
    formData.value.to = route.query.replyTo as string
  }
  if (route.query.subject) {
    formData.value.subject = route.query.subject as string
  }
  if (route.query.inReplyTo) {
    replyData.value.inReplyTo = route.query.inReplyTo as string
  }
  if (route.query.references) {
    const refsString = route.query.references as string
    replyData.value.references = refsString ? refsString.split(',') : []
    // Add the inReplyTo to references for proper threading
    if (replyData.value.inReplyTo) {
      replyData.value.references.push(replyData.value.inReplyTo)
    }
  }
})

async function handleSend() {
  try {
    const emailData = {
      to: formData.value.to.split(',').map(e => e.trim()).filter(e => e),
      subject: formData.value.subject,
      body: formData.value.body,
      cc: formData.value.cc ? formData.value.cc.split(',').map(e => e.trim()).filter(e => e) : undefined,
      bcc: formData.value.bcc ? formData.value.bcc.split(',').map(e => e.trim()).filter(e => e) : undefined,
      inReplyTo: replyData.value.inReplyTo,
      references: replyData.value.references,
    }

    await emailStore.sendEmail(emailData)
    router.push('/emails')
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

function handleCancel() {
  if (confirm('Discard this email?')) {
    router.back()
  }
}
</script>

<style scoped>
.compose-container {
  min-height: 100vh;
  background-color: var(--color-bg-secondary);
}

.compose-header {
  background-color: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-6);
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
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-4);
}

@media (max-width: 768px) {
  .compose-main {
    padding: var(--space-4);
  }

  .header-content {
    padding: var(--space-3) var(--space-4);
  }
}
</style>
