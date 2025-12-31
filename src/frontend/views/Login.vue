<template>
  <div class="login-container">
  <base-card
    padding="lg"
  >
      <div v-if="!authStore.otpRequested">
        <form>
          <div class="mb-6">
            <base-input
              id="phone"
              ref="phoneNumberInput"
              v-model="phoneNumber"
              type="tel"
              label="Phone Number"
              placeholder="+15551234567"
              required
            />
          </div>

          <base-button @click="handleRequestOtp" variant="primary" full-width :disabled="authStore.isLoading">
            {{ authStore.isLoading ? 'Sending...' : 'Login' }}
          </base-button>
        </form>
      </div>

      <div v-else>
        <div class="mb-6">
          <p class="text-sm text-gray-600 mb-4">
            We've sent a 6-digit code to {{ phoneNumber }}
          </p>
          <form>
            <div class="mb-6">
              <base-input
                id="otp"
                v-model="otpCode"
                type="text"
                label="Verification Code"
                placeholder="000000"
                required
                class="text-center text-2xl tracking-widest"
              />
            </div>

            <base-button @click="handleVerifyOtp" variant="primary" full-width :disabled="authStore.isLoading" class="mb-3">
              {{ authStore.isLoading ? 'Verifying...' : 'Verify' }}
            </base-button>

            <base-button type="button" variant="secondary" full-width @click="handleReset">
              Use different number
            </base-button>
          </form>
        </div>
      </div>

      <div v-if="authStore.error" class="error-message">
        {{ authStore.error }}
      </div>
  </base-card>
  </div>
</template>

<script setup lang="ts">
import { BaseInput } from '@cal.macconnachie/web-components'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const phoneNumber = ref('')
const otpCode = ref('')

async function handleRequestOtp() {
  try {
    await authStore.requestOtp(phoneNumber.value)
  } catch (error) {
    console.error('Failed to request OTP:', error)
  }
}

async function handleVerifyOtp() {
  try {
    const success = await authStore.verifyOtp(otpCode.value)
    if (success) {
      router.push('/emails')
    }
  } catch (error) {
    console.error('Failed to verify OTP:', error)
  }
}

function handleReset() {
  authStore.resetOtpFlow()
  phoneNumber.value = ''
  otpCode.value = ''
}

function sanitizePhoneNumber(input: string): string {
  // replace all non numbers or + character with empty string
  return input.replace(/[^\d+]/g, '')
}
</script>
<style scoped>
  .mb-6 {
    margin-bottom: 2rem;
  }
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }
  .error-message {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border-radius: var(--radius-md);
  }
</style>
