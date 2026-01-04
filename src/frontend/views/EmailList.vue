<template>
  <div class="email-list-container">
    <main class="email-main">
      <base-tabs
        active-tab="inbox"
        sync-with-hash
      >
        <!-- Sidebar Header with Filter Button -->
        <div
          v-if="!isMobile"
          slot="sidebar-header"
          class="sidebar-header-content"
        >
          <base-button
            variant="ghost"
            size="sm"
            @click="showFiltersDropdown = !showFiltersDropdown"
            title="Filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </base-button>
        </div>

        <!-- Sidebar Footer with Logout Button -->
        <div
          v-if="!isMobile"
          slot="sidebar-footer"
          class="portfolio-footer-slot"
        >
          <base-button
            v-if="authStore.isAuthenticated"
            @click="handleLogout"
            variant="ghost"
            size="sm"
            title="Logout"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </base-button>
        </div>
        <!-- Inbox Tab -->
        <base-tab
          id="inbox"
          label="Inbox"
          icon="<svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><path d=&quot;M22 12h-6l-2 3h-4l-2-3H2&quot;/><path d=&quot;M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z&quot;/></svg>"
        >

          <div class="email-list-card">
            <!-- Pull to refresh indicator -->
            <div
              v-if="isPulling && pullDistance > 0"
              class="pull-refresh-indicator"
              :style="{ height: `${pullDistance}px` }"
            >
              <div class="refresh-icon" :class="{ 'spin': pullDistance >= pullThreshold }">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </div>
            </div>

            <div v-if="emailStore.inboxError" class="error-card">
              <base-card variant="elevated" padding="md">
                {{ emailStore.inboxError }}
              </base-card>
            </div>
            <div class="email-list-header">
              <div class="search-bar-wrapper">
                <base-input
                  v-model="searchQuery"
                  placeholder="Search emails..."
                />
              </div>
              <base-button
                variant="ghost"
                size="sm"
                @click="toggleSortOrder"
                class="sort-button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'rotate-arrow': filters.sortOrder === 'ASC' }"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </base-button>
            </div>

            <div v-if="emailStore.isLoadingInbox && emailStore.inboxEmails.length === 0" class="loading-state">
              <p class="loading-text">Loading emails...</p>
            </div>
            <div
              v-else
              ref="inboxListRef"
              class="email-list-scrollable"
              @touchstart="handleTouchStart($event, inboxListRef)"
              @touchmove="handleTouchMove($event, inboxListRef)"
              @touchend="handleTouchEnd(inboxListRef, 'inbox')"
            >

            <div
              v-for="email in filteredInboxEmails"
              :key="email.id"
              class="email-list-item"
              @click="handleEmailClick(email)"
            >
              <div v-if="!isMobile" class="email-card-content">
                <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                <span class="email-sender">{{ email.sender }}</span>
                <div class="email-badges">
                  <span v-if="!email.read" class="badge unread-badge">•</span>
                  <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="10"
                      width="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </span>
                </div>
                <span class="email-date">{{ formatDate(email.created_at) }}</span>
              </div>
              <div v-else class="mobile-email-list-item">
                <div class="mobile-row-top">
                  <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                  <div class="email-badges">
                    <span v-if="!email.read" class="badge unread-badge">•</span>
                    <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="10"
                        width="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div class="mobile-row-bottom">
                  <span class="email-sender">{{ email.sender }}</span>
                  <span class="email-date">{{ formatDate(email.created_at) }}</span>
                </div>
              </div>
            </div>
            </div>
          </div>

          <div class="tab-footer">
            <div class="unread-count" :style="{ visibility: filteredInboxUnreadCount > 0 ? 'visible' : 'hidden' }">
              {{ filteredInboxUnreadCount }} unread email{{ filteredInboxUnreadCount !== 1 ? 's' : '' }}
            </div>
          </div>
        </base-tab>

        <!-- Sent Tab -->
        <base-tab
          id="sent"
          label="Sent"
          icon="<svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><line x1=&quot;22&quot; y1=&quot;2&quot; x2=&quot;11&quot; y2=&quot;13&quot;/><polygon points=&quot;22 2 15 22 11 13 2 9 22 2&quot;/></svg>"
        >

          <div class="email-list-card">
            <!-- Pull to refresh indicator -->
            <div
              v-if="isPulling && pullDistance > 0"
              class="pull-refresh-indicator"
              :style="{ height: `${pullDistance}px` }"
            >
              <div class="refresh-icon" :class="{ 'spin': pullDistance >= pullThreshold }">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </div>
            </div>

            <div class="email-list-header">
              <div class="search-bar-wrapper">
                <base-input
                  v-model="searchQuery"
                  placeholder="Search emails..."
                />
              </div>
              <base-button
                variant="ghost"
                size="sm"
                @click="toggleSortOrder"
                class="sort-button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'rotate-arrow': filters.sortOrder === 'ASC' }"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </base-button>
            </div>


          <base-card v-if="emailStore.sentError" variant="elevated" padding="md" class="error-card">
            {{ emailStore.sentError }}
          </base-card>
          <div v-if="emailStore.isLoadingSent && emailStore.sentEmails.length === 0" class="loading-state">
            <p class="loading-text">Loading sent emails...</p>
          </div>
          <div
            v-else
            ref="sentListRef"
            class="email-list-scrollable"
            @touchstart="handleTouchStart($event, sentListRef)"
            @touchmove="handleTouchMove($event, sentListRef)"
            @touchend="handleTouchEnd(sentListRef, 'sent')"
          >

            <div
              v-for="email in filteredSentEmails"
              :key="email.id"
              class="email-list-item"
              @click="handleEmailClick(email)"
            >
              <div v-if="!isMobile" class="email-card-content">
                <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                <span class="email-sender">To: {{ email.recipient }}</span>
                <div class="email-badges">
                  <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="10"
                      width="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </span>
                </div>
                <span class="email-date">{{ formatDate(email.created_at) }}</span>
              </div>
              <div v-else class="mobile-email-list-item">
                <div class="mobile-row-top">
                  <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                  <div class="email-badges">
                    <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="10"
                        width="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div class="mobile-row-bottom">
                  <span class="email-sender">To: {{ email.recipient }}</span>
                  <span class="email-date">{{ formatDate(email.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div class="tab-footer">
            <div class="unread-count" style="visibility: hidden;">
              &nbsp;
            </div>
          </div>
        </base-tab>

        <!-- Archived Tab -->
        <base-tab
          id="archived"
          label="Archived"
          icon="<svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><polyline points=&quot;21 8 21 21 3 21 3 8&quot;/><rect x=&quot;1&quot; y=&quot;3&quot; width=&quot;22&quot; height=&quot;5&quot;/><line x1=&quot;10&quot; y1=&quot;12&quot; x2=&quot;14&quot; y2=&quot;12&quot;/></svg>"
        >
          <div class="email-list-card">
            <!-- Pull to refresh indicator -->
            <div
              v-if="isPulling && pullDistance > 0"
              class="pull-refresh-indicator"
              :style="{ height: `${pullDistance}px` }"
            >
              <div class="refresh-icon" :class="{ 'spin': pullDistance >= pullThreshold }">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </div>
            </div>

            <div class="email-list-header">
              <div class="search-bar-wrapper">
                <base-input
                  v-model="searchQuery"
                  placeholder="Search emails..."
                />
              </div>
              <base-button
                variant="ghost"
                size="sm"
                @click="toggleSortOrder"
                class="sort-button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'rotate-arrow': filters.sortOrder === 'ASC' }"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </base-button>
            </div>

          <base-card v-if="emailStore.archivedError" variant="elevated" padding="md" class="error-card">
            {{ emailStore.archivedError }}
          </base-card>
<div v-if="emailStore.isLoadingArchived && emailStore.archivedEmails.length === 0" class="loading-state">
            <p class="loading-text">Loading archived emails...</p>
          </div>

          <div v-else-if="emailStore.archivedEmails.length === 0" class="empty-state">
            <p class="empty-text">No archived emails</p>
          </div>

          <div v-else-if="filteredArchivedEmails.length === 0" class="empty-state">
            <p class="empty-text">No emails match your search</p>
          </div>
          <div
            v-else
            ref="archivedListRef"
            class="email-list-scrollable"
            @touchstart="handleTouchStart($event, archivedListRef)"
            @touchmove="handleTouchMove($event, archivedListRef)"
            @touchend="handleTouchEnd(archivedListRef, 'archived')"
          >

            <div
              v-for="email in filteredArchivedEmails"
              :key="email.id"
              class="email-list-item"
              @click="handleEmailClick(email)"
            >
              <div v-if="!isMobile" class="email-card-content">
                <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                <span class="email-sender">{{ email.sender }}</span>
                <div class="email-badges">
                  <span v-if="!email.read" class="badge unread-badge">•</span>
                  <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="10"
                      width="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </span>
                </div>
                <span class="email-date">{{ formatDate(email.created_at) }}</span>
              </div>
              <div v-else class="mobile-email-list-item">
                <div class="mobile-row-top">
                  <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                  <div class="email-badges">
                    <span v-if="!email.read" class="badge unread-badge">•</span>
                    <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="10"
                        width="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div class="mobile-row-bottom">
                  <span class="email-sender">{{ email.sender }}</span>
                  <span class="email-date">{{ formatDate(email.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div class="tab-footer">
            <div class="unread-count" style="visibility: hidden;">
              &nbsp;
            </div>
          </div>
        </base-tab>
      </base-tabs>
      <base-drawer ref="filtersDropdown">
              <div class="filters-content">
                <div class="filter-row">
                  <label class="filter-label">Sender</label>
                  <base-input
                    v-model="filters.sender"
                    placeholder="Filter by sender email"
                  />
                </div>

                <div class="filter-row">
                  <base-datetime-picker
                    id="start-datetime"
                    v-model="filters.startDate"
                    label="Start Date"
                    placeholder="Select start date"
                    format="12"
                    size="md"
                  />
                </div>

                <div class="filter-row">
                  <base-datetime-picker
                    id="end-datetime"
                    v-model="filters.endDate"
                    label="End Date"
                    placeholder="Select end date"
                    format="12"
                    size="md"
                  />
                </div>

                <div class="filter-actions">
                  <base-button variant="primary" @click="applyFiltersAndClose">
                    Apply Filters
                  </base-button>
                  <base-button variant="ghost" @click="clearFilters">
                    Clear Filters
                  </base-button>
                </div>
              </div>
            </base-drawer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { BaseDrawer } from '@cal.macconnachie/web-components'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, type Email } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const emailStore = useEmailStore()
const authStore = useAuthStore()

const showFiltersDropdown = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const filtersDropdown = ref<BaseDrawer | null>(null)

// Pull to refresh state
const isPulling = ref(false)
const pullDistance = ref(0)
const pullStartY = ref(0)
const pullThreshold = 80
const inboxListRef = ref<HTMLElement | null>(null)
const sentListRef = ref<HTMLElement | null>(null)
const archivedListRef = ref<HTMLElement | null>(null)

watch(
  showFiltersDropdown,
  (newVal) => {
    if (filtersDropdown.value) {
      if (newVal) {
        filtersDropdown.value.openDrawer()
      } else {
        filtersDropdown.value.closeDrawer()
      }
    }
  }
)

// Watch for selectedRecipient changes
watch(
  () => authStore.selectedRecipient,
  async (newRecipient, oldRecipient) => {
    // Only trigger if the recipient actually changed
    if (newRecipient !== oldRecipient && oldRecipient !== null) {
      // Clear all email lists
      emailStore.clearAllEmails()
      try {
        await fetchAllMailboxes()
      } catch (error) {
        console.error('Failed to fetch emails after recipient change:', error)
      }
    }
  }
)

const searchQuery = ref('')
const filters = ref({
  sender: '',
  startDate: '',
  endDate: '',
  sortOrder: 'DESC' as 'ASC' | 'DESC',
})

// Filtered emails for each mailbox
const filteredInboxEmails = computed(() => {
  if (!searchQuery.value.trim()) {
    return emailStore.inboxEmails
  }

  const query = searchQuery.value.toLowerCase()
  return emailStore.inboxEmails.filter(email =>
    email.subject?.toLowerCase().includes(query)
  )
})

const filteredSentEmails = computed(() => {
  if (!searchQuery.value.trim()) {
    return emailStore.sentEmails
  }

  const query = searchQuery.value.toLowerCase()
  return emailStore.sentEmails.filter(email =>
    email.subject?.toLowerCase().includes(query)
  )
})

const filteredArchivedEmails = computed(() => {
  if (!searchQuery.value.trim()) {
    return emailStore.archivedEmails
  }

  const query = searchQuery.value.toLowerCase()
  return emailStore.archivedEmails.filter(email =>
    email.subject?.toLowerCase().includes(query)
  )
})

const filteredInboxUnreadCount = computed(() => {
  return filteredInboxEmails.value.filter(email => !email.read).length
})

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      // Reset selected recipient on logout
      authStore.setSelectedRecipient(null)
      // Redirect to login page
      router.push({ name: 'login' })
    }
  },
  { immediate: true }
)


// Fetch functions for each mailbox
async function fetchAllMailboxes() {
  const params: any = {
    sortOrder: filters.value.sortOrder,
  }
  if (filters.value.sender) params.sender = filters.value.sender
  if (filters.value.startDate) params.startDate = filters.value.startDate
  if (filters.value.endDate) params.endDate = filters.value.endDate

  await emailStore.fetchAllMailboxes(params)
}

// Handle messages from service worker
async function handleServiceWorkerMessage(event: MessageEvent) {
  if (event.data && event.data.type === 'NEW_EMAIL_NOTIFICATION') {
    // Extract s3_key from notification data
    const s3Key = event.data.data?.data?.s3_key

    if (!s3Key) {
      console.warn('No s3_key found in push notification data')
      return
    }

    try {
      // Fetch the specific new email
      const newEmail = await api.emails.getDetail(s3Key)

      // Add or update email in inbox store
      emailStore.addOrUpdateInboxEmail(newEmail)
    } catch (error) {
      console.error('Failed to fetch new email from notification:', error)
      // Fallback to refetching inbox only if fetch fails
      const params: any = {
        sortOrder: filters.value.sortOrder,
      }
      if (filters.value.sender) params.sender = filters.value.sender
      if (filters.value.startDate) params.startDate = filters.value.startDate
      if (filters.value.endDate) params.endDate = filters.value.endDate
      await emailStore.fetchInboxEmails(params)
    }
  }
}

function closeDrawer() {
  showFiltersDropdown.value = false
}

function onResize() {
  isMobile.value = window.innerWidth <= 768
}

// Pull to refresh handlers
function handleTouchStart(event: TouchEvent, listRef: HTMLElement | null) {
  if (!listRef) return

  const scrollTop = listRef.scrollTop
  if (scrollTop === 0) {
    pullStartY.value = event.touches[0].clientY
    isPulling.value = true
  }
}

function handleTouchMove(event: TouchEvent, listRef: HTMLElement | null) {
  if (!isPulling.value || !listRef) return

  const currentY = event.touches[0].clientY
  const distance = currentY - pullStartY.value

  if (distance > 0 && listRef.scrollTop === 0) {
    event.preventDefault()
    pullDistance.value = Math.min(distance, pullThreshold * 1.5)
  } else {
    isPulling.value = false
    pullDistance.value = 0
  }
}

async function handleTouchEnd(listRef: HTMLElement | null, mailboxType: 'inbox' | 'sent' | 'archived') {
  if (!isPulling.value) return

  if (pullDistance.value >= pullThreshold) {
    // Trigger refresh
    await refreshMailbox(mailboxType)
  }

  isPulling.value = false
  pullDistance.value = 0
  pullStartY.value = 0
}

async function refreshMailbox(mailboxType: 'inbox' | 'sent' | 'archived') {
  const params: any = {
    sortOrder: filters.value.sortOrder,
  }
  if (filters.value.sender) params.sender = filters.value.sender
  if (filters.value.startDate) params.startDate = filters.value.startDate
  if (filters.value.endDate) params.endDate = filters.value.endDate

  try {
    if (mailboxType === 'inbox') {
      await emailStore.fetchInboxEmails(params)
    } else if (mailboxType === 'sent') {
      await emailStore.fetchSentEmails({ sortOrder: params.sortOrder })
    } else if (mailboxType === 'archived') {
      await emailStore.fetchArchivedEmails(params)
    }
  } catch (error) {
    console.error(`Failed to refresh ${mailboxType}:`, error)
  }
}

onMounted(async () => {
  try {
    await fetchAllMailboxes()
  } catch (error) {
    console.error('Failed to fetch emails:', error)
  }

  await nextTick()
  filtersDropdown.value?.addEventListener('close-drawer', closeDrawer)
  window.addEventListener('resize', onResize)

  // Listen for messages from service worker
  navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)
})

onBeforeUnmount(() => {
  filtersDropdown.value?.removeEventListener('close-drawer', closeDrawer)
  window.removeEventListener('resize', onResize)
  navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
})

async function handleLogout() {
  try {
    authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

async function applyFilters() {
  try {
    await fetchAllMailboxes()
  } catch (error) {
    console.error('Failed to apply filters:', error)
  }
}

async function applyFiltersAndClose() {
  await applyFilters()
  showFiltersDropdown.value = false
}

async function clearFilters() {
  filters.value = {
    sender: '',
    startDate: '',
    endDate: '',
    sortOrder: 'DESC',
  }
  showFiltersDropdown.value = false

  try {
    await fetchAllMailboxes()
  } catch (error) {
    console.error('Failed to clear filters:', error)
  }
}

async function toggleSortOrder() {
  filters.value.sortOrder = filters.value.sortOrder === 'DESC' ? 'ASC' : 'DESC'
  await applyFilters()
}

function handleEmailClick(email: Email) {
  router.push({ name: 'email-detail', params: { s3Key: encodeURIComponent(email.s3_key) } })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffHours < 24 * 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
}
</script>

<style scoped>
.email-list-container {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  padding-top: var(--space-12);
  gap: var(--space-4);
  max-height: 100dvh;
}

.search-bar-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.filters-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: var(--space-4);
  overflow: visible;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow: visible;
}

.filter-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.filter-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.email-list-card {
  position: relative;
  overflow: visible;
}


.sidebar-header-content {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.portfolio-footer-slot {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-2);
}

.email-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  overflow: visible;
}

.sort-button svg {
  transition: transform 0.3s ease;
}

.rotate-arrow {
  transform: rotate(180deg);
}

.email-list-item {
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background-color 0.2s;
}

.email-list-item:hover {
  background-color: var(--color-bg-muted);
}

.email-list-item:last-child {
  border-bottom: none;
}

.email-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-3);
}

.loading-state {
  text-align: center;
  padding: var(--space-8);
}

.loading-text {
  margin: 0;
  opacity: 0.7;
}

.error-card {
  color: var(--color-error);
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
}

.empty-text {
  margin: 0 0 var(--space-4) 0;
  opacity: 0.7;
}

.email-card-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  overflow: hidden;
}

.email-subject {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  flex-shrink: 0;
  min-width: 0;
}

.email-sender {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email-badges {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  flex-shrink: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  line-height: 1;
}

.unread-badge {
  color: var(--color-info);
  font-size: var(--font-size-base);
}

.archived-badge {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.attachment-badge {
  color: var(--color-metered);
}

.email-date {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.unread-count {
  margin-top: var(--space-2);
  padding: var(--space-2);
  text-align: center;
  font-size: var(--font-size-sm);
  opacity: 0.7;
}

.mobile-email-list-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mobile-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.mobile-row-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  opacity: 0.7;
}
@media (max-width: 768px) {
  .sidebar-header-content {
    /* alight to the left */
    justify-content: flex-start;
    padding-left: var(--space-2);
  }
}

/* Pull to refresh styles */
.pull-refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: height 0.2s ease;
}

.refresh-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: transform 0.3s ease;
}

.refresh-icon.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.email-list-scrollable {
  overflow-y: auto;
  max-height: 100dvh;
  -webkit-overflow-scrolling: touch;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

/* mobile */
@media (max-width: 768px) {
  .email-list-container {
    padding: var(--space-4);
    padding-top: var(--space-10);
    margin-top: var(--space-8);
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
  }

  .email-list-scrollable {
    max-height: calc(100dvh - 250px);
    padding-bottom: var(--space-6);
  }
}
</style>
