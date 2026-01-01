import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, type Email } from '../api/client'

export const useEmailStore = defineStore('email', () => {
  const emails = ref<Email[]>([])
  const currentEmail = ref<Email | null>(null)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)
  const lastEvaluatedKey = ref<Record<string, unknown> | undefined>(undefined)

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

  const composing = ref(false)

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

  async function fetchEmails(params?: { sender?: string; startDate?: string; endDate?: string; limit?: number; sortOrder?: 'ASC' | 'DESC' }) {
    // Determine if this is initial load or background refresh
    const hasExistingEmails = emails.value.length > 0

    if (hasExistingEmails) {
      isRefreshing.value = true
    } else {
      isLoading.value = true
    }

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
      isRefreshing.value = false
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

      // If threadEmails are provided, merge them with existing emails in the store
      if (email.threadEmails && email.threadEmails.length > 0) {
        email.threadEmails.forEach(threadEmail => {
          const existingIndex = emails.value.findIndex(e => e.s3_key === threadEmail.s3_key)
          if (existingIndex !== -1) {
            // Update existing email with thread email data, but preserve body if it exists
            emails.value[existingIndex] = {
              ...threadEmail,
              body: emails.value[existingIndex].body || threadEmail.body,
            }
          } else {
            // Add new thread email to the list
            emails.value.push(threadEmail)
          }
        })
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

  function resetCompose() {
    formData.value = {
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
    }
    replyData.value = {}
    composing.value = false
  }

  function prepareReply(email: Email) {
    formData.value.to = email.sender
    formData.value.subject = `Re: ${email.subject || ''}`
    replyData.value.inReplyTo = email.message_id
    replyData.value.references = email.references || []
    composing.value = true
  }

  return {
    emails,
    currentEmail,
    isLoading,
    isRefreshing,
    error,
    unreadCount,
    threads,
    formData,
    replyData,
    composing,
    fetchEmails,
    fetchEmailDetail,
    sendEmail,
    markAsRead,
    toggleArchived,
    fetchThread,
    clearCurrentEmail,
    resetCompose,
    prepareReply,
  }
})
