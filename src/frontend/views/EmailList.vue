<template>
  <div class="email-list-container">
    <main class="email-main">
      <base-tabs
        class="email-tabs"
        active-tab="inbox"
        sync-with-hash
      >
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
            <base-icon name="external-link" size="24px" />
          </base-button>
        </div>
        <!-- Inbox Tab -->
        <base-tab
          id="inbox"
          label="Inbox"
          icon="<base-icon name='open-email' size='24px'></base-icon>"
        >
          <div class="tab-content-wrapper">
          <div class="email-list-card">
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
                @click="showFiltersDropdown = !showFiltersDropdown"
                title="Filters"
              >
                <base-icon name="filters" size="24px" />
              </base-button>
              <base-button
                variant="ghost"
                size="sm"
                @click="toggleSortOrder"
                class="sort-button"
              >
                <base-icon name="arrow" size="24px" :class="{ 'rotate-arrow': filters.sortOrder === 'ASC' }" />
              </base-button>
            </div>

            <div v-if="emailStore.isLoadingInbox && emailStore.inboxEmails.length === 0" class="loading-state">
              <p class="loading-text">Loading emails...</p>
            </div>

            <div v-else-if="emailStore.inboxEmails.length === 0" class="empty-state">
              <p class="empty-text">No inbox emails</p>
              <base-button variant="link-primary" @click="resetInbox">
                Refresh Inbox
              </base-button>
            </div>

            <div v-else-if="filteredInboxEmails.length === 0" class="empty-state">
              <p class="empty-text">No emails match your search</p>
            </div>

            <base-list
              v-else
              ref="inboxListRef"
              class="email-list-scrollable"
              variant="divided"
              pull-action-icon="↻"
              size="md"
              @list-pulled="resetInbox"
            >
              <base-list-item
                v-for="email in filteredInboxEmails"
                :key="email.id"
                :ref="(el: any) => setInboxSwipeActions(el, email)"
                size="md"
                interactive
                no-hover
                @item-click="handleEmailClick(email)"
              >
                <div v-if="!isMobile" class="email-card-content">
                  <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                  <span class="email-sender">{{ email.sender }}</span>
                  <div class="email-badges">
                    <span v-if="!email.read" class="badge unread-badge">•</span>
                    <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                      <base-icon name="paperclip" size="10px" />
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
                        <base-icon name="paperclip" size="10px" />
                      </span>
                    </div>
                  </div>
                  <div class="mobile-row-bottom">
                    <span class="email-sender">{{ email.sender }}</span>
                    <span class="email-date">{{ formatDate(email.created_at) }}</span>
                  </div>
                </div>
              </base-list-item>
            </base-list>
          </div>

          <div class="tab-footer">
            <div class="unread-count" :style="{ visibility: filteredInboxUnreadCount > 0 ? 'visible' : 'hidden' }">
              {{ filteredInboxUnreadCount }} unread email{{ filteredInboxUnreadCount !== 1 ? 's' : '' }}
            </div>
          </div>
          </div>
        </base-tab>

        <!-- Sent Tab -->
        <base-tab
          id="sent"
          label="Sent"
          icon="<base-icon name='send' size='24px'></base-icon"
        >
          <div class="tab-content-wrapper">
          <div class="email-list-card">
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
                @click="showFiltersDropdown = !showFiltersDropdown"
                title="Filters"
              >
                <base-icon name="filters" size="24px" />
              </base-button>
              <base-button
                variant="ghost"
                size="sm"
                @click="toggleSortOrder"
                class="sort-button"
              >
                <base-icon name="arrow" size="24px" :class="{ 'rotate-arrow': filters.sortOrder === 'ASC' }" />
              </base-button>
            </div>


          <base-card v-if="emailStore.sentError" variant="elevated" padding="md" class="error-card">
            {{ emailStore.sentError }}
          </base-card>
          <div v-if="emailStore.isLoadingSent && emailStore.sentEmails.length === 0" class="loading-state">
            <p class="loading-text">Loading sent emails...</p>
          </div>

          <div v-else-if="emailStore.sentEmails.length === 0" class="empty-state">
            <p class="empty-text">No sent emails</p>
            <base-button variant="link-primary" @click="resetSent">
              Refresh Sent
            </base-button>
          </div>

          <div v-else-if="filteredSentEmails.length === 0" class="empty-state">
            <p class="empty-text">No emails match your search</p>
          </div>

          <base-list
            v-else
            ref="sentListRef"
            class="email-list-scrollable"
            variant="divided"
            size="md"
            pull-action-icon="↻"
            @list-pulled="resetSent"
          >
            <base-list-item
              v-for="email in filteredSentEmails"
              :key="email.id"
              size="md"
              interactive
              no-hover
              @item-click="handleEmailClick(email)"
            >
              <div v-if="!isMobile" class="email-card-content">
                <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                <span class="email-sender">To: {{ email.recipient }}</span>
                <div class="email-badges">
                  <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                    <base-icon name="paperclip" size="10px" />
                  </span>
                </div>
                <span class="email-date">{{ formatDate(email.created_at) }}</span>
              </div>
              <div v-else class="mobile-email-list-item">
                <div class="mobile-row-top">
                  <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                  <div class="email-badges">
                    <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                      <base-icon name="paperclip" size="10px" />
                    </span>
                  </div>
                </div>
                <div class="mobile-row-bottom">
                  <span class="email-sender">To: {{ email.recipient }}</span>
                  <span class="email-date">{{ formatDate(email.created_at) }}</span>
                </div>
              </div>
            </base-list-item>
          </base-list>
          </div>

          <div class="tab-footer">
            <div class="unread-count" style="visibility: hidden;">
              &nbsp;
            </div>
          </div>
          </div>
        </base-tab>

        <!-- Archived Tab -->
        <base-tab
          id="archived"
          label="Archived"
          icon="<base-icon name='file-cabinet' size='24px'></base-icon"
        >
          <div class="tab-content-wrapper">
          <div class="email-list-card">
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
                @click="showFiltersDropdown = !showFiltersDropdown"
                title="Filters"
              >
                <base-icon name="filters" size="24px" />
              </base-button>
              <base-button
                variant="ghost"
                size="sm"
                @click="toggleSortOrder"
                class="sort-button"
              >
                <base-icon name="arrow" size="24px" :class="{ 'rotate-arrow': filters.sortOrder === 'ASC' }" />
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
          <base-list
            v-else
            ref="archivedListRef"
            class="email-list-scrollable"
            variant="divided"
            size="md"
            pull-action-icon="↻"
            @list-pulled="resetArchived"
          >
            <base-list-item
              v-for="email in filteredArchivedEmails"
              :key="email.id"
              :ref="(el: any) => setArchivedSwipeActions(el, email)"
              size="md"
              interactive
              no-hover
              @item-click="handleEmailClick(email)"
            >
              <div v-if="!isMobile" class="email-card-content">
                <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
                <span class="email-sender">{{ email.sender }}</span>
                <div class="email-badges">
                  <span v-if="!email.read" class="badge unread-badge">•</span>
                  <span v-if="email.attachment_keys && email.attachment_keys.length > 0" class="badge attachment-badge">
                    <base-icon name="paperclip" size="10px" />
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
                      <base-icon name="paperclip" size="10px" />
                    </span>
                  </div>
                </div>
                <div class="mobile-row-bottom">
                  <span class="email-sender">{{ email.sender }}</span>
                  <span class="email-date">{{ formatDate(email.created_at) }}</span>
                </div>
              </div>
            </base-list-item>
          </base-list>
          </div>

          <div class="tab-footer">
            <div class="unread-count" style="visibility: hidden;">
              &nbsp;
            </div>
          </div>
          </div>
        </base-tab>
      </base-tabs>
      <base-drawer ref="filtersDropdown" @drawer-close="closeDropdown">
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
import { type Email } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const emailStore = useEmailStore()
const authStore = useAuthStore()

const showFiltersDropdown = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const filtersDropdown = ref<BaseDrawer | null>(null)

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

const closeDropdown = () => {
  showFiltersDropdown.value = false
}
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
      const newEmail = await emailStore.fetchEmailDetail(s3Key)

      // Add or update email in inbox store
      if (newEmail) emailStore.addOrUpdateInboxEmail(newEmail)
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

async function handleToggleRead(email: Email) {
  try {
    await emailStore.toggleRead(email.timestamp)
  } catch (error) {
    console.error('Failed to toggle read status:', error)
  }
}

async function handleArchive(email: Email) {
  try {
    await emailStore.toggleArchived(email.timestamp)
  } catch (error) {
    console.error('Failed to archive email:', error)
  }
}

async function handleUnarchive(email: Email) {
  try {
    await emailStore.toggleArchived(email.timestamp)
  } catch (error) {
    console.error('Failed to unarchive email:', error)
  }
}

function setInboxSwipeActions(el: any, email: Email) {
  if (!el) return

  el.leftSwipeAction = {
    icon: 'open-email',
    color: 'transparent',
    iconColor: 'var(--color-primary)',
    callback: () => handleToggleRead(email)
  }

  el.rightSwipeAction = {
    icon: 'file-cabinet',
    color: 'transparent',
    iconColor: 'var(--color-error)',
    callback: () => handleArchive(email)
  }
}

function setArchivedSwipeActions(el: any, email: Email) {
  if (!el) return

  el.leftSwipeAction = {
    icon: 'open-email',
    color: 'transparent',
    iconColor: 'var(--color-primary)',
    callback: () => handleToggleRead(email)
  }

  el.rightSwipeAction = {
    icon: 'file-cabinet',
    color: 'transparent',
    iconColor: 'var(--color-success)',
    callback: () => handleUnarchive(email)
  }
}

async function resetInbox() {
  const params: any = {
    sortOrder: filters.value.sortOrder,
  }
  if (filters.value.sender) params.sender = filters.value.sender
  if (filters.value.startDate) params.startDate = filters.value.startDate
  if (filters.value.endDate) params.endDate = filters.value.endDate

  await emailStore.fetchInboxEmails(params, true)
}

async function resetSent() {
  const params: any = {
    sortOrder: filters.value.sortOrder,
  }
  if (filters.value.sender) params.sender = filters.value.sender
  if (filters.value.startDate) params.startDate = filters.value.startDate
  if (filters.value.endDate) params.endDate = filters.value.endDate

  await emailStore.fetchSentEmails(params, true)
}

async function resetArchived() {
  const params: any = {
    sortOrder: filters.value.sortOrder,
  }
  if (filters.value.sender) params.sender = filters.value.sender
  if (filters.value.startDate) params.startDate = filters.value.startDate
  if (filters.value.endDate) params.endDate = filters.value.endDate

  await emailStore.fetchArchivedEmails(params, true)
}
</script>

<style scoped>
.email-list-container {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  padding-top: var(--space-12);
  padding-bottom: 0;
  gap: var(--space-4);
  height: 100dvh;
  overflow: hidden;
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
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
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
  flex-shrink: 0;
}

.sort-button svg {
  transition: transform 0.3s ease;
}

.rotate-arrow {
  transform: rotate(180deg);
}

/* Ensure list items have proper minimum height */
base-list-item {
  min-height: 44px;
}

.email-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-3);
  min-height: 0;
}

/* Remove bottom padding from base-tabs to reach viewport bottom */
.email-tabs {
  padding-bottom: 0 !important;
  flex: 1;
}

/* Tab content wrapper fills base-tab and uses flex layout */
.tab-content-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.tab-footer {
  flex-shrink: 0;
}

.loading-state {
  text-align: center;
  padding: var(--space-8);
  flex-shrink: 0;
}

.loading-text {
  margin: 0;
  opacity: 0.7;
}

.error-card {
  color: var(--color-error);
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  flex-shrink: 0;
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
  min-width: 0;
  overflow: hidden;
  padding: var(--space-2) 0;
}

.email-subject {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 2 1 0;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.email-sender {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 0;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  word-break: break-word;
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
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
  padding: var(--space-2) 0;
}

.mobile-row-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
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

.email-list-scrollable {
  flex: 1;
  min-height: 0;
  max-height: 100%;
  -webkit-overflow-scrolling: touch;
  --list-item-bg: var(--color-bg-secondary);
  /* This is the ONLY scrolling element - base-list handles overflow */
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.tabs-content {
  padding-bottom: 0!important;
}

/* mobile */
@media (max-width: 768px) {
  .email-list-container {
    padding: var(--space-4);
    padding-top: var(--space-4);
    padding-bottom: 0;
  }

  .email-list-card {
    max-height: none;
  }

  .mobile-email-list-item .email-subject {
    flex: 1;
    -webkit-line-clamp: 3;
  }

  .mobile-email-list-item .email-sender {
    white-space: normal;
    -webkit-line-clamp: 2;
  }
  .email-main {
    gap: 0;
  }

}
</style>

<style>
/* Unscoped styles to override web component shadow DOM */
@media (max-width: 768px) {
  .tabs-sidebar {
    width: calc(100% - 60px) !important;
  }
}
</style>
