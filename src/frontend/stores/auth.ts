import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const phoneNumber = ref<string | null>(null)
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
    // Check if we have a valid cookie by attempting to access a protected resource
    // This is a simple check - in a production app you might want to call a /me endpoint
    isAuthenticated.value = document.cookie.includes('AccessToken')
  }

  async function refreshToken() {
    // Only attempt refresh if we have a refresh token but no access token
    if (!document.cookie.includes('RefreshToken')) {
      isAuthenticated.value = false
      return false
    }

    try {
      await api.auth.refresh()
      isAuthenticated.value = true
      return true
    } catch (err) {
      // Refresh token is invalid or expired
      console.log('Token refresh failed:', err)
      isAuthenticated.value = false
      return false
    }
  }

  function resetOtpFlow() {
    otpRequested.value = false
    otpSession.value = null
    error.value = null
  }

  return {
    isAuthenticated,
    phoneNumber,
    isLoading,
    error,
    otpRequested,
    requestOtp,
    verifyOtp,
    logout,
    checkAuth,
    refreshToken,
    resetOtpFlow,
  }
})
