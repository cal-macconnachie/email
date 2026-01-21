const API_BASE = 'https://macconnachie.com/api'

interface RequestOtpResponse {
  session: string
  message: string
}

interface VerifyOtpResponse {
  message: string
  user: {
    phone_number: string
  }
}

interface AttachmentUrl {
  key: string
  filename: string
  viewUrl: string
  downloadUrl: string
  contentId?: string
}

interface Email {
  id: string
  recipient: string
  sender: string
  subject: string
  body?: string
  cc?: string[]
  bcc?: string[]
  timestamp: string
  created_at: string
  read: boolean
  archived: boolean
  thread_id: string
  message_id: string
  in_reply_to?: string
  references?: string[]
  s3_key: string
  attachment_keys?: string[]
  attachments?: AttachmentUrl[]
  threadEmails?: Email[]
}

interface ListEmailsResponse {
  emails: Email[]
  lastEvaluatedKey?: Record<string, unknown>
  count: number
}

export const api = {
  auth: {
    async requestOtp(phoneNumber: string): Promise<RequestOtpResponse> {
      const response = await fetch(`${API_BASE}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error((json.message ?? json.error) ?? 'Failed to request OTP')
      return json
    },

    async verifyOtp(phoneNumber: string, otpCode: string, session: string): Promise<VerifyOtpResponse> {
      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone_number: phoneNumber,
          otp_code: otpCode,
          session,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error((json.message ?? json.error) ?? 'Invalid OTP code')
      return json
    },

    async logout(): Promise<void> {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await response.json()
      if (!response.ok) throw new Error((json.message ?? json.error) ?? 'Logout failed')
    },

    async refresh(): Promise<{ message: string }> {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await response.json()
      if (!response.ok) throw new Error((json.message ?? json.error) ?? 'Token refresh failed')
      return json
    },

    async getSession(): Promise<{
      message: string
      phone_number: string
      recipients: string[]
      default_recipient: string
    }> {
      const response = await fetch(`${API_BASE}/auth/session`, {
        credentials: 'include',
      })
      const json = await response.json()
      if (!response.ok) throw new Error((json.message ?? json.error) ?? 'Failed to get session')
      return json
    }
  },

  emails: {
    async list(params?: { sender?: string; startDate?: string; endDate?: string; limit?: number; sortOrder?: 'ASC' | 'DESC'; mailbox?: 'inbox' | 'sent' | 'archived'; recipient?: string; lastEvaluatedKey?: Record<string, unknown> }): Promise<ListEmailsResponse> {
      // If we have a lastEvaluatedKey, send all params in the body via POST
      if (params?.lastEvaluatedKey) {
        const response = await fetch(`${API_BASE}/emails/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(params),
        })
        if (!response.ok) throw new Error('Failed to fetch emails')
        return response.json()
      }

      // Otherwise use GET with query params
      const queryParams = new URLSearchParams()
      if (params?.sender) queryParams.append('sender', params.sender)
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder)
      if (params?.mailbox) queryParams.append('mailbox', params.mailbox)
      if (params?.recipient) queryParams.append('recipient', params.recipient)

      const response = await fetch(`${API_BASE}/emails/list?${queryParams}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch emails')
      return response.json()
    },

    async getDetail(s3Key: string): Promise<Email> {
      const response = await fetch(`${API_BASE}/emails/detail?s3_key=${encodeURIComponent(s3Key)}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch email detail')
      return response.json()
    },

    async send(email: {
      to: string[]
      subject: string
      body: string
      cc?: string[]
      bcc?: string[]
      replyTo?: string[]
      inReplyTo?: string
      references?: string[]
      attachmentKeys?: string[]
      sendFrom?: string
    }): Promise<{ message: string; messageId: string; recipients: string[] }> {
      const response = await fetch(`${API_BASE}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          body: email.body,
          cc: email.cc,
          bcc: email.bcc,
          replyTo: email.replyTo,
          inReplyTo: email.inReplyTo,
          references: email.references,
          attachmentKeys: email.attachmentKeys,
          sendFrom: email.sendFrom,
        }),
      })
      if (!response.ok) throw new Error('Failed to send email')
      return response.json()
    },

    async update(timestamp: string, updates: { read?: boolean; archived?: boolean }): Promise<void> {
      const response = await fetch(`${API_BASE}/emails/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          timestamp,
          ...updates,
        }),
      })
      if (!response.ok) throw new Error('Failed to update email')
    },

    async getThread(threadId: string, includeBody = false): Promise<{ thread_id: string; emails: Email[]; count: number }> {
      const response = await fetch(`${API_BASE}/emails/thread?thread_id=${threadId}&include_body=${includeBody}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch thread')
      return response.json()
    },
  },

  attachments: {
    async getUploadUrl(filename: string, contentType: string): Promise<{ uploadUrl: string; attachmentKey: string; attachmentId: string }> {
      const response = await fetch(`${API_BASE}/attachments/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename, contentType }),
      })
      if (!response.ok) throw new Error('Failed to get upload URL')
      return response.json()
    },
  },

  push: {
    async subscribe(data: {
      subscription_id: string
      endpoint: string
      keys: { p256dh: string; auth: string }
      user_agent?: string
    }): Promise<{ message: string; subscription_id: string }> {
      const response = await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to subscribe to push notifications')
      return response.json()
    },

    async unsubscribe(data: {
      subscription_id: string
    }): Promise<{ message: string; subscription_id: string }> {
      const response = await fetch(`${API_BASE}/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to unsubscribe from push notifications')
      return response.json()
    }
  },
}

export type { Email, ListEmailsResponse }
