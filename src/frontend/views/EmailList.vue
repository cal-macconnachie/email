<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm">
      <div class="container py-4 flex justify-between items-center">
        <h1 class="text-2xl font-bold">Inbox</h1>
        <div class="flex gap-3">
          <router-link to="/compose">
            <base-button variant="primary">Compose</base-button>
          </router-link>
          <base-button @click="handleLogout" variant="secondary">Logout</base-button>
        </div>
      </div>
    </header>

    <main class="container py-6">
      <div v-if="emailStore.isLoading" class="text-center py-12">
        <p class="text-gray-600">Loading emails...</p>
      </div>

      <base-card v-else-if="emailStore.error" class="bg-red-50 text-red-700">
        {{ emailStore.error }}
      </base-card>

      <div v-else-if="emailStore.emails.length === 0" class="text-center py-12">
        <p class="text-gray-600 mb-4">No emails yet</p>
        <router-link to="/compose">
          <base-button variant="primary">Send your first email</base-button>
        </router-link>
      </div>

      <div v-else class="space-y-2">
        <base-card
          v-for="email in emailStore.emails"
          :key="email.id"
          class="email-item hover:shadow-md transition-shadow cursor-pointer"
          :class="{ 'font-bold': !email.read }"
          @click="handleEmailClick(email)"
          hoverable
        >
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1">
              <p class="text-sm text-gray-600">{{ email.sender }}</p>
              <h3 class="text-lg">{{ email.subject || '(No subject)' }}</h3>
            </div>
            <div class="text-sm text-gray-500">
              {{ formatDate(email.created_at) }}
            </div>
          </div>

          <div class="flex justify-between items-center">
            <div class="flex gap-2">
              <span v-if="!email.read" class="badge badge-primary">Unread</span>
              <span v-if="email.archived" class="badge badge-secondary">Archived</span>
              <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge badge-secondary">
                📎 {{ email.attachment_keys.length }}
              </span>
            </div>
          </div>
        </base-card>
      </div>

      <div v-if="emailStore.unreadCount > 0" class="mt-6 text-center text-sm text-gray-600">
        {{ emailStore.unreadCount }} unread email{{ emailStore.unreadCount !== 1 ? 's' : '' }}
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Email } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const emailStore = useEmailStore()
const authStore = useAuthStore()

onMounted(async () => {
  try {
    await emailStore.fetchEmails()
  } catch (error) {
    console.error('Failed to fetch emails:', error)
  }
})

function handleEmailClick(email: Email) {
  router.push({ name: 'email-detail', params: { s3Key: encodeURIComponent(email.s3_key) } })
}

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffHours < 24 * 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}
</script>

