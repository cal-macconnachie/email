<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm">
      <div class="container py-4">
        <base-button @click="handleCancel" variant="secondary">← Cancel</base-button>
      </div>
    </header>

    <main class="container py-6">
      <base-card class="max-w-4xl mx-auto">
        <h1 class="text-2xl font-bold mb-6">Compose Email</h1>

        <form>
          <div class="mb-4">
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

          <div class="mb-4">
            <base-input
              id="cc"
              v-model="formData.cc"
              type="text"
              label="CC (optional)"
              placeholder="cc@example.com"
            />
          </div>

          <div class="mb-4">
            <base-input
              id="bcc"
              v-model="formData.bcc"
              type="text"
              label="BCC (optional)"
              placeholder="bcc@example.com"
            />
          </div>

          <div class="mb-4">
            <base-input
              id="subject"
              v-model="formData.subject"
              type="text"
              label="Subject"
              placeholder="Email subject"
              required
            />
          </div>

          <div class="mb-6">
            <base-textarea
              id="body"
              v-model="formData.body"
              label="Message"
              :rows="12"
              placeholder="Write your message..."
              required
            />
          </div>

          <div v-if="emailStore.error" class="mb-4 p-3 bg-red-50 text-red-700 rounded">
            {{ emailStore.error }}
          </div>

          <div class="flex justify-between items-center">
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

