import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const phoneNumber = ref<string | null>(null)
  const recipients = ref<string[]>([])
  const defaultRecipient = ref<string | null>(null)
  const selectedRecipient = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // OTP flow state
  const otpSession = ref<string | null>(null)
  const otpRequested = ref(false)

  async function requestOtp(phone: string) {
    isLoading.value = true
    error.value = null
    try {
      if (phone.trim() === '') {
        error.value = 'Phone number is required'
        return
      }
      const response = await api.auth.requestOtp(phone)
      otpSession.value = response.session
      otpRequested.value = true
      phoneNumber.value = phone
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : (err as { error?: string }).error
      error.value = errMessage ?? 'Failed to request OTP'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function verifyOtp(otpCode: string) {
    if (!phoneNumber.value || !otpSession.value) {
      error.value = 'Invalid OTP session'
      return false
    }

    isLoading.value = true
    error.value = null
    try {
      await api.auth.verifyOtp(phoneNumber.value, otpCode, otpSession.value)
      isAuthenticated.value = true
      otpRequested.value = false
      otpSession.value = null
      return true
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : (err as { error?: string }).error
      error.value = errMessage ?? 'Invalid OTP code'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true
    error.value = null
    try {
      await api.auth.logout()
      isAuthenticated.value = false
      phoneNumber.value = null
      selectedRecipient.value = null
      otpSession.value = null
      otpRequested.value = false
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : (err as { error?: string }).error
      error.value = errMessage ?? 'Logout failed'
    } finally {
      isLoading.value = false
    }
  }

  function checkAuth() {
    // Note: We can't check HttpOnly cookies from JavaScript (they're not in document.cookie)
    // This is intentional for security. The authentication state is managed by the store
    // and verified server-side on each API request. We only update isAuthenticated here
    // if we have no auth state yet - otherwise trust the store state.
    // The real check happens server-side when making authenticated requests.

    // Do nothing if already authenticated - trust the store state
    if (isAuthenticated.value) {
      return
    }

    // If we have a phone number in state, we might be authenticated
    // The refresh token flow will verify this
  }

  async function refreshToken() {
    // RefreshToken is HttpOnly so we can't check it from JavaScript
    // Just try to refresh - the server will tell us if there's no valid refresh token

    try {
      await api.auth.refresh()
      isAuthenticated.value = true
      return true
    } catch (err) {
      // Refresh token is invalid, expired, or doesn't exist
      console.log('Token refresh failed:', err)
      isAuthenticated.value = false
      return false
    }
  }

  async function checkSession() {
    try {
      const { recipients: apiRecipients, default_recipient } = await api.auth.getSession()
      recipients.value = apiRecipients
      defaultRecipient.value = default_recipient
      // Initialize selectedRecipient to defaultRecipient if not already set
      if (!selectedRecipient.value && default_recipient) {
        selectedRecipient.value = default_recipient
      }
      isAuthenticated.value = true
      return true
    } catch {
      isAuthenticated.value = false
      return false
    }
  }

  function resetOtpFlow() {
    otpRequested.value = false
    otpSession.value = null
    error.value = null
  }

  function setSelectedRecipient(recipient: string | null) {
    if (recipient !== null && !recipients.value.includes(recipient)) {
      throw new Error('Recipient not in list')
    }
    selectedRecipient.value = recipient
  }

  return {
    isAuthenticated,
    phoneNumber,
    isLoading,
    error,
    otpRequested,
    recipients,
    defaultRecipient,
    requestOtp,
    verifyOtp,
    logout,
    checkAuth,
    refreshToken,
    resetOtpFlow,
    checkSession,
    selectedRecipient,
    setSelectedRecipient,
  }
})
