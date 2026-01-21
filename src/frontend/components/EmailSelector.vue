<template>
  <div class="email-selector" v-if="authStore.recipients.length > 0">
    <button
      class="selector-button"
      @click="toggleDropdown"
      :title="currentEmail"
    >
      <div class="email-avatar">
        {{ emailInitials }}
      </div>
    </button>

    <!-- Desktop Dropdown -->
    <transition name="dropdown">
      <div v-if="isOpen && !isMobile" class="dropdown-menu">
        <div class="dropdown-content">
          <button
            v-for="email in authStore.recipients"
            :key="email"
            class="dropdown-item"
            :class="{ 'active': email === currentEmail }"
            @click="selectEmail(email)"
          >
            <div class="item-avatar">
              {{ getInitials(email) }}
            </div>
            <span class="item-email">{{ email }}</span>
            <svg
              v-if="email === currentEmail"
              class="check-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          <div class="theme-toggle-wrapper">
            <theme-toggle size="sm"/>
          </div>
        </div>
      </div>
    </transition>

    <!-- Mobile Drawer -->
    <base-drawer ref="mobileDrawer" @drawer-close="closeDrawdown">
      <div class="drawer-content">
        <h3 class="drawer-title">Select Email</h3>
        <button
          v-for="email in authStore.recipients"
          :key="email"
          class="dropdown-item"
          :class="{ 'active': email === currentEmail }"
          @click="selectEmail(email)"
        >
          <div class="item-avatar">
            {{ getInitials(email) }}
          </div>
          <span class="item-email">{{ email }}</span>
          <svg
            v-if="email === currentEmail"
            class="check-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <div class="theme-toggle-wrapper">
          <theme-toggle size="sm"/>
        </div>
      </div>
    </base-drawer>
  </div>
</template>

<script setup lang="ts">
import { BaseDrawer, ThemeToggle } from '@cal.macconnachie/web-components'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const isOpen = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const mobileDrawer = ref<BaseDrawer | null>(null)

const currentEmail = computed(() => authStore.selectedRecipient || authStore.defaultRecipient || '')

const emailInitials = computed(() => {
  return getInitials(currentEmail.value)
})

function getInitials(email: string): string {
  if (!email) return '?'
  const parts = email.split('@')[0].split('.')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

function toggleDropdown() {
  if (isMobile.value) {
    mobileDrawer.value?.openDrawer()
  } else {
    isOpen.value = !isOpen.value
  }
}

function closeDrawdown() {
  isOpen.value = false
}

function selectEmail(email: string) {
  authStore.setSelectedRecipient(email)
  if (isMobile.value) {
    mobileDrawer.value?.closeDrawer()
  } else {
    closeDrawdown()
  }
}

function handleResize() {
  isMobile.value = window.innerWidth <= 768
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.email-selector') && !isMobile.value) {
    closeDrawdown()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.email-selector {
  position: relative;
  color: inherit;
  border-radius: 50%;
}

.selector-button {
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.selector-button:hover .email-avatar {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.email-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: all 0.2s;
  color: inherit;
}

/* Dropdown Menu */
.dropdown-menu {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 250px;
  max-width: 320px;
  z-index: 1001;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.dropdown-content {
  max-height: 400px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: left;
}

.dropdown-item:hover {
  background: var(--color-bg-muted);
}

.dropdown-item.active {
  background: var(--color-bg-muted);
}

.item-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--color-bg-muted);
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.item-email {
  flex: 1;
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.theme-toggle-wrapper {
  padding: var(--space-3);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: center;
}

/* Drawer Content */
.drawer-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}

.drawer-title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .selector-button {
    width: 40px;
    height: 40px;
  }

  .email-avatar {
    width: 40px;
    height: 40px;
    font-size: var(--font-size-sm);
  }
  .email-selector {
    box-shadow: var(--shadow-md);
  }
}
</style>
