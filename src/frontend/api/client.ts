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
  },

  emails: {
    async list(params?: { sender?: string; startDate?: string; endDate?: string; limit?: number }): Promise<ListEmailsResponse> {
      const queryParams = new URLSearchParams()
      if (params?.sender) queryParams.append('sender', params.sender)
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.limit) queryParams.append('limit', params.limit.toString())

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
    }): Promise<{ message: string; messageId: string; recipients: string[] }> {
      const response = await fetch(`${API_BASE}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: email.to,
          from: '', // Will be injected by auth middleware
          subject: email.subject,
          body: email.body,
          cc: email.cc,
          bcc: email.bcc,
          replyTo: email.replyTo,
          inReplyTo: email.inReplyTo,
          references: email.references,
          attachmentKeys: email.attachmentKeys,
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
}

export type { Email, ListEmailsResponse }
