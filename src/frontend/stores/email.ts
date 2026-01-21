import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, type Email } from '../api/client'
import { useAuthStore } from './auth'

export const useEmailStore = defineStore('email', () => {
  const currentEmail = ref<Email | null>(null)
  const currentUserEmail = ref<string | null>(null)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)
  const lastEvaluatedKey = ref<Record<string, unknown> | undefined>(undefined)
  const fetchedThreads = ref<Set<string>>(new Set())

  // Separate email lists for each mailbox
  const inboxEmails = ref<Email[]>([])
  const sentEmails = ref<Email[]>([])
  const archivedEmails = ref<Email[]>([])

  const emails = computed(() => [...inboxEmails.value, ...sentEmails.value, ...archivedEmails.value])

  // Loading and error states for each mailbox
  const isLoadingInbox = ref(false)
  const isLoadingSent = ref(false)
  const isLoadingArchived = ref(false)
  const inboxError = ref<string | null>(null)
  const sentError = ref<string | null>(null)
  const archivedError = ref<string | null>(null)

  const formData = ref({
    to: [] as string[],
    cc: [] as string[],
    bcc: [] as string[],
    subject: '',
    body: '',
  })

  const replyData = ref<{
    inReplyTo?: string
    references?: string[]
  }>({})

  const attachments = ref<Array<{
    key: string
    filename: string
    size: number
    uploading: boolean
  }>>([])

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
      lastEvaluatedKey.value = response.lastEvaluatedKey

      // Set current user email from first email's recipient (if not already set)
      if (!currentUserEmail.value && response.emails.length > 0) {
        currentUserEmail.value = response.emails[0].recipient
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch emails'
      throw err
    } finally {
      isLoading.value = false
      isRefreshing.value = false
    }
  }

  async function fetchInboxEmails(params?: { sender?: string; startDate?: string; endDate?: string; sortOrder?: 'ASC' | 'DESC' }) {
    isLoadingInbox.value = true
    inboxError.value = null
    try {
      const authStore = useAuthStore()
      const recipient = authStore.selectedRecipient || authStore.defaultRecipient
      const response = await api.emails.list({
        ...params,
        mailbox: 'inbox',
        recipient: recipient || undefined,
      })
      // Replace inbox emails but preserve any that have bodies loaded
      const existingEmailsWithBodies = inboxEmails.value.filter(e => e.body)
      inboxEmails.value = response.emails
      // Merge back any emails that had bodies loaded
      existingEmailsWithBodies.forEach(existingEmail => {
        const emailInResponse = inboxEmails.value.find(e => e.s3_key === existingEmail.s3_key)
        if (emailInResponse && !emailInResponse.body) {
          Object.assign(emailInResponse, existingEmail)
        }
      })
    } catch (err) {
      inboxError.value = err instanceof Error ? err.message : 'Failed to fetch inbox emails'
      throw err
    } finally {
      isLoadingInbox.value = false
    }
  }

  async function fetchSentEmails(params?: { sortOrder?: 'ASC' | 'DESC' }) {
    isLoadingSent.value = true
    sentError.value = null
    try {
      const authStore = useAuthStore()
      const recipient = authStore.selectedRecipient || authStore.defaultRecipient
      const response = await api.emails.list({
        ...params,
        mailbox: 'sent',
        recipient: recipient || undefined,
      })
      // Replace sent emails but preserve any that have bodies loaded
      const existingEmailsWithBodies = sentEmails.value.filter(e => e.body)
      sentEmails.value = response.emails
      // Merge back any emails that had bodies loaded
      existingEmailsWithBodies.forEach(existingEmail => {
        const emailInResponse = sentEmails.value.find(e => e.s3_key === existingEmail.s3_key)
        if (emailInResponse && !emailInResponse.body) {
          Object.assign(emailInResponse, existingEmail)
        }
      })
    } catch (err) {
      sentError.value = err instanceof Error ? err.message : 'Failed to fetch sent emails'
      throw err
    } finally {
      isLoadingSent.value = false
    }
  }

  async function fetchArchivedEmails(params?: { sender?: string; startDate?: string; endDate?: string; sortOrder?: 'ASC' | 'DESC' }) {
    isLoadingArchived.value = true
    archivedError.value = null
    try {
      const authStore = useAuthStore()
      const recipient = authStore.selectedRecipient || authStore.defaultRecipient
      const response = await api.emails.list({
        ...params,
        mailbox: 'archived',
        recipient: recipient || undefined,
      })
      // Replace archived emails but preserve any that have bodies loaded
      const existingEmailsWithBodies = archivedEmails.value.filter(e => e.body)
      archivedEmails.value = response.emails
      // Merge back any emails that had bodies loaded
      existingEmailsWithBodies.forEach(existingEmail => {
        const emailInResponse = archivedEmails.value.find(e => e.s3_key === existingEmail.s3_key)
        if (emailInResponse && !emailInResponse.body) {
          Object.assign(emailInResponse, existingEmail)
        }
      })
    } catch (err) {
      archivedError.value = err instanceof Error ? err.message : 'Failed to fetch archived emails'
      throw err
    } finally {
      isLoadingArchived.value = false
    }
  }

  async function fetchAllMailboxes(params?: { sender?: string; startDate?: string; endDate?: string; sortOrder?: 'ASC' | 'DESC' }) {
    await Promise.all([
      fetchInboxEmails(params),
      fetchSentEmails({ sortOrder: params?.sortOrder }),
      fetchArchivedEmails(params)
    ])
  }

  async function fetchEmailDetail(s3Key: string) {
    if (isLoading.value) {
      return
    }
    isLoading.value = true
    error.value = null
    try {
      const email = await api.emails.getDetail(s3Key)

      addEmailsToStore([email])

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
      const authStore = useAuthStore()
      const sendFrom = authStore.selectedRecipient || authStore.defaultRecipient
      const response = await api.emails.send({
        ...email,
        sendFrom: sendFrom || undefined,
      })
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
    // Don't try to mark sent emails as read
    const email = emails.value.find(e => e.timestamp === timestamp) || currentEmail.value
    if (email && currentUserEmail.value && email.sender === currentUserEmail.value) {
      // This is a sent email, don't try to update it
      return
    }

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

      const newArchivedStatus = !email.archived
      await api.emails.update(timestamp, { archived: newArchivedStatus })
      email.archived = newArchivedStatus

      // Move email between mailboxes
      if (newArchivedStatus) {
        // Moving to archived
        const inboxIndex = inboxEmails.value.findIndex(e => e.timestamp === timestamp)
        if (inboxIndex !== -1) {
          inboxEmails.value.splice(inboxIndex, 1)
          archivedEmails.value.unshift(email)
        }
      } else {
        // Moving to inbox
        const archivedIndex = archivedEmails.value.findIndex(e => e.timestamp === timestamp)
        if (archivedIndex !== -1) {
          archivedEmails.value.splice(archivedIndex, 1)
          inboxEmails.value.unshift(email)
        }
      }

      if (currentEmail.value && currentEmail.value.timestamp === timestamp) {
        currentEmail.value.archived = newArchivedStatus
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to toggle archive'
      throw err
    }
  }

  async function toggleRead(timestamp: string) {
    try {
      const email = emails.value.find(e => e.timestamp === timestamp)
      if (!email) return

      // Don't try to mark sent emails as read
      if (currentUserEmail.value && email.sender === currentUserEmail.value) {
        return
      }

      const newReadStatus = !email.read
      await api.emails.update(timestamp, { read: newReadStatus })
      email.read = newReadStatus

      if (currentEmail.value && currentEmail.value.timestamp === timestamp) {
        currentEmail.value.read = newReadStatus
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to toggle read status'
      throw err
    }
  }

  async function fetchThread(threadId: string, includeBody = false) {
    isLoading.value = true
    error.value = null
    if (fetchedThreads.value.has(threadId)) {
      isLoading.value = false
      return emails.value.filter(email => email.thread_id === threadId)
    }
    try {
      const response = await api.emails.getThread(threadId, includeBody)
      addEmailsToStore(response.emails)
      fetchedThreads.value.add(threadId)
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
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      body: '',
    }
    replyData.value = {}
    attachments.value = []
    composing.value = false
  }

  function addAttachment(key: string, filename: string, size: number) {
    attachments.value.push({ key, filename, size, uploading: false })
  }

  function removeAttachment(key: string) {
    const index = attachments.value.findIndex(a => a.key === key)
    if (index !== -1) {
      attachments.value.splice(index, 1)
    }
  }

  function setAttachmentUploading(key: string, uploading: boolean) {
    const attachment = attachments.value.find(a => a.key === key)
    if (attachment) {
      attachment.uploading = uploading
    }
  }

  function prepareReply(email: Email) {
    formData.value.to = [email.sender]
    formData.value.subject = `Re: ${email.subject || ''}`
    replyData.value.inReplyTo = email.message_id
    replyData.value.references = email.references || []
    composing.value = true
  }

  function addOrUpdateInboxEmail(email: Email) {
    const existingIndex = inboxEmails.value.findIndex(e => e.s3_key === email.s3_key)
    if (existingIndex === -1) {
      inboxEmails.value.unshift(email)
    } else {
      inboxEmails.value[existingIndex] = email
    }
  }

  function clearAllEmails() {
    inboxEmails.value = []
    sentEmails.value = []
    archivedEmails.value = []
    currentEmail.value = null
  }

  function addEmailsToStore(newEmails: Email[]) {
    newEmails.forEach(email => {
      // Set currentUserEmail if not already set - use the recipient as the current user
      if (!currentUserEmail.value) {
        currentUserEmail.value = email.recipient
      }

      const emailInStore = emails.value.find(e => e.s3_key === email.s3_key)
      const emailArchived = email.archived
      const emailSentByUser = currentUserEmail.value ? email.sender === currentUserEmail.value : false
      const emailReceivedByUser = currentUserEmail.value ? email.recipient === currentUserEmail.value : false

      if (emailInStore) {
        // Update existing email
        Object.assign(emailInStore, email)
      }
      if (!emailInStore) {
        // add to correct mailbox
        if (emailArchived) {
          archivedEmails.value.push(email)
        } else if (emailSentByUser) {
          sentEmails.value.push(email)
        } else if (emailReceivedByUser) {
          inboxEmails.value.push(email)
        }
      }
    })
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
    attachments,
    composing,
    // Mailbox-specific state
    inboxEmails,
    sentEmails,
    archivedEmails,
    isLoadingInbox,
    isLoadingSent,
    isLoadingArchived,
    inboxError,
    sentError,
    archivedError,
    // Functions
    fetchEmails,
    fetchInboxEmails,
    fetchSentEmails,
    fetchArchivedEmails,
    fetchAllMailboxes,
    fetchEmailDetail,
    sendEmail,
    markAsRead,
    toggleArchived,
    toggleRead,
    fetchThread,
    clearCurrentEmail,
    resetCompose,
    prepareReply,
    addAttachment,
    removeAttachment,
    setAttachmentUploading,
    addOrUpdateInboxEmail,
    clearAllEmails,
  }
})
