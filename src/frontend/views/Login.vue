<template>
  <div class="login-container">
    <base-card
      variant="elevated"
      padding="lg"
      class="login-card"
    >
      <div v-if="!authStore.otpRequested">
        <form class="login-form">
          <div class="form-field">
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

          <base-button @click="handleRequestOtp" variant="ghost-primary" full-width :disabled="authStore.isLoading">
            {{ authStore.isLoading ? 'Sending...' : 'Login' }}
          </base-button>
        </form>
      </div>

      <div v-else>
        <div class="otp-section">
          <p class="otp-message">
            We've sent a 6-digit code to {{ phoneNumber }}
          </p>
          <form class="otp-form">
            <div class="form-field">
              <base-input
                id="otp"
                v-model="otpCode"
                type="text"
                label="Verification Code"
                placeholder="000000"
                required
                class="otp-input"
              />
            </div>

            <base-button @click="handleVerifyOtp" variant="ghost-primary" full-width :disabled="authStore.isLoading" class="verify-button">
              {{ authStore.isLoading ? 'Verifying...' : 'Verify' }}
            </base-button>

            <base-button type="button" variant="ghost-secondary" full-width @click="handleReset">
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
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg-secondary);
  padding: var(--space-4);
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-form,
.otp-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-field {
  margin-bottom: var(--space-6);
}

.otp-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.otp-message {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.otp-input {
  text-align: center;
  font-size: var(--font-size-2xl);
  letter-spacing: 0.1em;
}

.verify-button {
  margin-bottom: var(--space-3);
}

.error-message {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-error-border);
}

@media (max-width: 480px) {
  .login-container {
    padding: var(--space-2);
  }
}
</style>
