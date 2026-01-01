<template>
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
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const route = useRoute()
const emailStore = useEmailStore()

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
</script>

<style scoped>
.compose-container {
  min-height: 100vh;
  background-color: var(--color-bg-secondary);
}

.compose-header {
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
  overflow-y: auto;
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
