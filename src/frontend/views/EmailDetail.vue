<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm">
      <div class="container py-4">
        <base-button @click="router.back()" variant="secondary" class="mb-4">← Back</base-button>

        <div v-if="emailStore.currentEmail" class="flex justify-between items-start">
          <div class="flex-1">
            <h1 class="text-2xl font-bold mb-2">{{ emailStore.currentEmail.subject || '(No subject)' }}</h1>
            <div class="flex gap-4 text-sm text-gray-600">
              <p><strong>From:</strong> {{ emailStore.currentEmail.sender }}</p>
              <p><strong>To:</strong> {{ emailStore.currentEmail.recipient }}</p>
              <p><strong>Date:</strong> {{ formatFullDate(emailStore.currentEmail.created_at) }}</p>
            </div>
          </div>

          <div class="flex gap-2">
            <base-button @click="handleToggleArchive" variant="secondary">
              {{ emailStore.currentEmail.archived ? 'Unarchive' : 'Archive' }}
            </base-button>
            <base-button @click="handleReply" variant="primary">Reply</base-button>
          </div>
        </div>
      </div>
    </header>

    <main class="container py-6">
      <div v-if="emailStore.isLoading" class="text-center py-12">
        <p class="text-gray-600">Loading email...</p>
      </div>

      <base-card v-else-if="emailStore.error" class="bg-red-50 text-red-700">
        {{ emailStore.error }}
      </base-card>

      <base-card v-else-if="emailStore.currentEmail">
        <div v-if="emailStore.currentEmail.cc" class="mb-4">
          <p class="text-sm text-gray-600"><strong>CC:</strong> {{ emailStore.currentEmail.cc.join(', ') }}</p>
        </div>

        <div class="email-body prose max-w-none" v-html="emailStore.currentEmail.body"></div>

        <div v-if="emailStore.currentEmail.attachment_keys && emailStore.currentEmail.attachment_keys.length > 0" class="mt-6 pt-6 border-t">
          <h3 class="text-lg font-semibold mb-3">Attachments ({{ emailStore.currentEmail.attachment_keys.length }})</h3>
          <div class="space-y-2">
            <div
              v-for="(key, index) in emailStore.currentEmail.attachment_keys"
              :key="key"
              class="flex items-center gap-2 p-2 bg-gray-100 rounded"
            >
              <span>📎</span>
              <span class="flex-1">{{ getFilename(key) }}</span>
            </div>
          </div>
        </div>

        <div v-if="emailStore.currentEmail.thread_id && threadEmails.length > 1" class="mt-6 pt-6 border-t">
          <h3 class="text-lg font-semibold mb-3">Thread ({{ threadEmails.length }} messages)</h3>
          <div class="space-y-2">
            <div
              v-for="email in threadEmails"
              :key="email.id"
              class="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
              :class="{ 'bg-blue-50': email.id === emailStore.currentEmail.id }"
              @click="handleThreadEmailClick(email)"
            >
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-medium">{{ email.subject || '(No subject)' }}</p>
                  <p class="text-sm text-gray-600">{{ email.sender }}</p>
                </div>
                <p class="text-sm text-gray-500">{{ formatDate(email.created_at) }}</p>
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

onMounted(async () => {
  try {
    const decodedKey = decodeURIComponent(props.s3Key)
    await emailStore.fetchEmailDetail(decodedKey)

    if (emailStore.currentEmail && !emailStore.currentEmail.read) {
      await emailStore.markAsRead(emailStore.currentEmail.timestamp)
    }

    if (emailStore.currentEmail?.thread_id) {
      threadEmails.value = await emailStore.fetchThread(emailStore.currentEmail.thread_id, false)
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
</script>

