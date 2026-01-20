<template>
  <div class="login-container">
    <base-card
      variant="elevated"
      padding="lg"
      class="login-card"
    >
      <div v-if="!authStore.otpRequested">
        <form class="login-form" @submit.prevent="handleRequestOtp">
          <div class="form-field">
            <div class="phone-input-group" role="group" aria-labelledby="phone-label">
              <base-input
                id="country-code"
                name="country-code"
                ref="countryCodeInput"
                v-model="countryCode"
                type="tel"
                placeholder="+1"
                autocomplete="tel-country-code"
                required
                class="country-code-input"
                :aria-invalid="!!countryCodeError"
                :aria-describedby="countryCodeError ? 'country-code-error' : undefined"
                aria-required="true"
              />
              <base-input
                id="phone-number"
                name="phone-number"
                ref="phoneNumberInput"
                v-model="phoneNumberDigits"
                type="tel"
                placeholder="5551234567"
                autocomplete="tel-national"
                required
                class="phone-number-input"
                :aria-invalid="!!phoneNumberError"
                :aria-describedby="phoneNumberError ? 'phone-number-error' : undefined"
                aria-required="true"
              />
            </div>
            <div v-if="countryCodeError" id="country-code-error" class="input-error" role="alert">
              {{ countryCodeError }}
            </div>
            <div v-if="phoneNumberError" id="phone-number-error" class="input-error" role="alert">
              {{ phoneNumberError }}
            </div>
            <p v-if="fullPhoneNumber && !countryCodeError && !phoneNumberError" class="phone-preview" aria-live="polite">
              Will send code to: <strong>{{ fullPhoneNumber }}</strong>
            </p>
          </div>

          <base-button @click="handleRequestOtp" variant="ghost-primary" full-width :disabled="authStore.isLoading || !isPhoneValid">
            {{ authStore.isLoading ? 'Sending...' : 'Login' }}
          </base-button>
        </form>
      </div>

      <div v-else>
        <div class="otp-section">
          <p class="otp-message">
            We've sent a 6-digit code to {{ fullPhoneNumber }}
          </p>
          <form class="otp-form">
            <div class="form-field">
              <base-input
                id="otp"
                ref="otpInput"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const countryCode = ref('+1')
const phoneNumberDigits = ref('')
const otpCode = ref('')

const countryCodeInput = ref<InstanceType<typeof BaseInput> | null>(null)
const phoneNumberInput = ref<InstanceType<typeof BaseInput> | null>(null)
const otpInput = ref<InstanceType<typeof BaseInput> | null>(null)

// Computed properties for validation
const countryCodeError = computed(() => {
  if (!countryCode.value) return 'Country code is required'
  if (!countryCode.value.startsWith('+')) return 'Must start with +'
  if (!/^\+\d{1,4}$/.test(countryCode.value)) return 'Must be + followed by 1-4 digits'
  return null
})

const phoneNumberError = computed(() => {
  if (!phoneNumberDigits.value) return 'Phone number is required'
  if (!/^\d{4,15}$/.test(phoneNumberDigits.value)) return 'Must be 4-15 digits only'
  return null
})

const fullPhoneNumber = computed(() => {
  if (!countryCode.value || !phoneNumberDigits.value) return ''
  return countryCode.value + phoneNumberDigits.value
})

const isPhoneValid = computed(() => {
  return !countryCodeError.value && !phoneNumberError.value && fullPhoneNumber.value.length > 0
})

function handleEnterKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (!authStore.otpRequested) {
      handleRequestOtp()
    } else {
      handleVerifyOtp()
    }
  }
}

// Sanitize country code input
watch(countryCode, (newVal) => {
  // Ensure it starts with + and only contains digits after that
  let clean = newVal.replace(/[^\d+]/g, '')

  // Ensure only one + at the start
  if (clean.indexOf('+') > 0) {
    clean = '+' + clean.replace(/\+/g, '')
  } else if (!clean.startsWith('+') && clean.length > 0) {
    clean = '+' + clean
  }

  // Limit to +XXXX (max 4 digit country code)
  if (clean.length > 5) {
    clean = clean.substring(0, 5)
  }

  if (clean !== newVal) {
    countryCode.value = clean
  }
})

// Sanitize phone number input
watch(phoneNumberDigits, (newVal) => {
  // Only allow digits
  const clean = newVal.replace(/\D/g, '')

  // Limit to 15 digits (international standard)
  const limited = clean.substring(0, 15)

  if (limited !== newVal) {
    phoneNumberDigits.value = limited
  }
})

onMounted(() => {
  // Focus country code input on mount
  nextTick(() => {
    if (countryCodeInput.value) {
      const inputElement = countryCodeInput.value as any
      if (inputElement.$el?.querySelector('input')) {
        inputElement.$el.querySelector('input').focus()
      }
    }
  })
  // listener for enter key to submit forms
  window.addEventListener('keydown', handleEnterKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEnterKey)
})

watch (
  () => authStore.otpRequested,
  (newVal: boolean) => {
    // Wait for DOM to update before focusing
    nextTick(() => {
      if (newVal) {
        if (otpInput.value) {
          const inputElement = otpInput.value as any
          if (inputElement.$el?.querySelector('input')) {
            inputElement.$el.querySelector('input').focus()
          }
        }
      } else {
        if (countryCodeInput.value) {
          const inputElement = countryCodeInput.value as any
          if (inputElement.$el?.querySelector('input')) {
            inputElement.$el.querySelector('input').focus()
          }
        }
      }
    })
  }
)

async function handleRequestOtp() {
  if (!isPhoneValid.value) {
    return
  }

  try {
    await authStore.requestOtp(fullPhoneNumber.value)
  } catch (error) {
    console.error('Failed to request OTP:', error)
  }
}

async function handleVerifyOtp() {
  try {
    const success = await authStore.verifyOtp(otpCode.value)
    if (success) {
      // Load session data (recipients, default recipient) after successful login
      await authStore.checkSession()
      router.push('/emails')
    }
  } catch (error) {
    console.error('Failed to verify OTP:', error)
  }
}

function handleReset() {
  authStore.resetOtpFlow()
  countryCode.value = '+1'
  phoneNumberDigits.value = ''
  otpCode.value = ''
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

.form-label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.phone-input-group {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--space-3);
  align-items: start;
}

.country-code-input {
  min-width: 0;
}

.phone-number-input {
  min-width: 0;
}

.input-error {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.phone-preview {
  margin-top: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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

  .phone-input-group {
    grid-template-columns: 100px 1fr;
    gap: var(--space-2);
  }
}
</style>
