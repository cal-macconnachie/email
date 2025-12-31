import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, type Email } from '../api/client'

export const useEmailStore = defineStore('email', () => {
  const emails = ref<Email[]>([])
  const currentEmail = ref<Email | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastEvaluatedKey = ref<Record<string, unknown> | undefined>(undefined)

  const unreadCount = computed(() => emails.value.filter(email => !email.read).length)
  const threads = computed(() => {
    const threadMap = new Map<string, Email[]>()
    emails.value.forEach(email => {
      if (!threadMap.has(email.thread_id)) {
        threadMap.set(email.thread_id, [])
      }
      threadMap.get(email.thread_id)!.push(email)
    })
    return threadMap
  })

  async function fetchEmails(params?: { sender?: string; startDate?: string; endDate?: string; limit?: number }) {
    isLoading.value = true
    error.value = null
    try {
      const response = await api.emails.list(params)
      emails.value = response.emails
      lastEvaluatedKey.value = response.lastEvaluatedKey
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch emails'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchEmailDetail(s3Key: string) {
    isLoading.value = true
    error.value = null
    try {
      const email = await api.emails.getDetail(s3Key)
      currentEmail.value = email

      // Update in the emails list if it exists
      const index = emails.value.findIndex(e => e.s3_key === s3Key)
      if (index !== -1) {
        emails.value[index] = email
      }

      return email
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch email detail'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function sendEmail(email: {
    to: string[]
    subject: string
    body: string
    cc?: string[]
    bcc?: string[]
    replyTo?: string[]
    inReplyTo?: string
    references?: string[]
    attachmentKeys?: string[]
  }) {
    isLoading.value = true
    error.value = null
    try {
      const response = await api.emails.send(email)
      // Refresh email list after sending
      await fetchEmails()
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to send email'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function markAsRead(timestamp: string) {
    try {
      await api.emails.update(timestamp, { read: true })
      // Update local state
      const email = emails.value.find(e => e.timestamp === timestamp)
      if (email) {
        email.read = true
      }
      if (currentEmail.value && currentEmail.value.timestamp === timestamp) {
        currentEmail.value.read = true
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to mark as read'
      throw err
    }
  }

  async function toggleArchived(timestamp: string) {
    try {
      const email = emails.value.find(e => e.timestamp === timestamp)
      if (!email) return

      await api.emails.update(timestamp, { archived: !email.archived })
      email.archived = !email.archived

      if (currentEmail.value && currentEmail.value.timestamp === timestamp) {
        currentEmail.value.archived = !currentEmail.value.archived
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to toggle archive'
      throw err
    }
  }

  async function fetchThread(threadId: string, includeBody = false) {
    isLoading.value = true
    error.value = null
    try {
      const response = await api.emails.getThread(threadId, includeBody)
      return response.emails
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch thread'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function clearCurrentEmail() {
    currentEmail.value = null
  }

  return {
    emails,
    currentEmail,
    isLoading,
    error,
    unreadCount,
    threads,
    fetchEmails,
    fetchEmailDetail,
    sendEmail,
    markAsRead,
    toggleArchived,
    fetchThread,
    clearCurrentEmail,
  }
})
