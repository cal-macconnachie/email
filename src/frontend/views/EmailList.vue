<template>
  <div class="email-list-container">
    <div class="search-section">
      <base-card variant="elevated" padding="md">
        <div class="search-header">
          <label class="search-label">Search</label>
        </div>
        <base-input
          v-model="searchQuery"
          placeholder="subject..."
        />
      </base-card>
    </div>

    <div class="filters-section">
      <base-card variant="elevated" padding="md">
        <div class="filters-header">
          <h3 class="filters-title">Filters</h3>
          <base-button
            variant="ghost"
            size="sm"
            @click="toggleFiltersExpanded"
          >
            {{ filtersExpanded ? 'Hide' : 'Show' }}
          </base-button>
        </div>

        <div v-if="filtersExpanded" class="filters-content">
          <div class="filter-row">
            <label class="filter-label">Sender</label>
            <base-input
              v-model="filters.sender"
              placeholder="Filter by sender email"
            />
          </div>

          <div class="filter-row">
            <label class="filter-label">Start Date</label>
            <base-date-time-picker
              v-model="filters.startDate"
              placeholder="Select start date"
            />
          </div>

          <div class="filter-row">
            <label class="filter-label">End Date</label>
            <base-date-time-picker
              v-model="filters.endDate"
              placeholder="Select end date"
            />
          </div>

          <div class="filter-row">
            <label class="filter-label">Sort Order</label>
            <div class="sort-order-toggle">
              <base-button
                :variant="filters.sortOrder === 'DESC' ? 'primary' : 'ghost'"
                size="sm"
                @click="filters.sortOrder = 'DESC'"
              >
                Newest First
              </base-button>
              <base-button
                :variant="filters.sortOrder === 'ASC' ? 'primary' : 'ghost'"
                size="sm"
                @click="filters.sortOrder = 'ASC'"
              >
                Oldest First
              </base-button>
            </div>
          </div>

          <div class="filter-actions">
            <base-button variant="primary" @click="applyFilters">
              Apply Filters
            </base-button>
            <base-button variant="ghost" @click="clearFilters">
              Clear Filters
            </base-button>
          </div>
        </div>
      </base-card>
    </div>

    <main class="email-main">
      <div v-if="emailStore.isLoading && emailStore.emails.length === 0" class="loading-state">
        <p class="loading-text">Loading emails...</p>
      </div>

      <base-card v-else-if="emailStore.error" variant="elevated" padding="md" class="error-card">
        {{ emailStore.error }}
      </base-card>

      <div v-else-if="emailStore.emails.length === 0" class="empty-state">
        <p class="empty-text">No emails yet</p>
        <router-link to="/compose">
          <base-button variant="ghost-primary">Send your first email</base-button>
        </router-link>
      </div>

      <div v-else-if="filteredEmails.length === 0" class="empty-state">
        <p class="empty-text">No emails match your search</p>
      </div>

      <base-card v-else
          variant="elevated"
          padding="sm">
        <div
          v-for="email in filteredEmails"
          :key="email.id"
          class="email-list-item"
          hoverable
          @click="handleEmailClick(email)"
        >
          <div class="email-card-content">
            <span class="email-subject">{{ email.subject || '(No subject)' }}</span>
            <span class="email-sender">{{ email.sender }}</span>
            <div class="email-badges">
              <span v-if="!email.read" class="badge unread-badge">•</span>
              <span v-if="email.archived" class="badge archived-badge">A</span>
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
        </div>
      </base-card>

      <div v-if="filteredUnreadCount > 0" class="unread-count">
        {{ filteredUnreadCount }} unread email{{ filteredUnreadCount !== 1 ? 's' : '' }}
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Email } from '../api/client'
import { useEmailStore } from '../stores/email'

const router = useRouter()
const emailStore = useEmailStore()

const filtersExpanded = ref(false)
const searchQuery = ref('')
const filters = ref({
  sender: '',
  startDate: '',
  endDate: '',
  sortOrder: 'DESC' as 'ASC' | 'DESC',
})

const filteredEmails = computed(() => {
  if (!searchQuery.value.trim()) {
    return emailStore.emails
  }

  const query = searchQuery.value.toLowerCase()
  return emailStore.emails.filter(email =>
    email.subject?.toLowerCase().includes(query)
  )
})

const filteredUnreadCount = computed(() => {
  return filteredEmails.value.filter(email => !email.read).length
})

function fetchEmails() {
  emailStore.fetchEmails()
}

const fetchingInterval = ref<NodeJS.Timeout | null>(null)

onMounted(async () => {
  try {
    await emailStore.fetchEmails()
  } catch (error) {
    console.error('Failed to fetch emails:', error)
  }
  // set up timer to fetch emails every 60 seconds
  fetchingInterval.value = setInterval(fetchEmails, 60000)
})

onBeforeUnmount(() => {
  // clear interval when component is unmounted
  if (fetchingInterval.value !== null) {
    clearInterval(fetchingInterval.value)
  }
})

function toggleFiltersExpanded() {
  filtersExpanded.value = !filtersExpanded.value
}

async function applyFilters() {
  try {
    const params: any = {}

    if (filters.value.sender) {
      params.sender = filters.value.sender
    }
    if (filters.value.startDate) {
      params.startDate = filters.value.startDate
    }
    if (filters.value.endDate) {
      params.endDate = filters.value.endDate
    }
    if (filters.value.sortOrder) {
      params.sortOrder = filters.value.sortOrder
    }

    await emailStore.fetchEmails(params)
  } catch (error) {
    console.error('Failed to apply filters:', error)
  }
}

async function clearFilters() {
  filters.value = {
    sender: '',
    startDate: '',
    endDate: '',
    sortOrder: 'DESC',
  }

  try {
    await emailStore.fetchEmails()
  } catch (error) {
    console.error('Failed to clear filters:', error)
  }
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
}

.search-section {
  width: 100%;
}

.search-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.search-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.search-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.filters-section {
  width: 100%;
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.filters-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.filters-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.sort-order-toggle {
  display: flex;
  gap: var(--space-2);
}

.filter-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.compose-button {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-fixed);
}

.email-header {
  margin-bottom: var(--space-6);
}

.header-content {
  display: flex;
  justify-content: space-between;
  padding-right: var(--space-12);
}

.inbox-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.refresh-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.refresh-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  animation: pulse 2s ease-in-out infinite;
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

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.email-main {
  display: flex;
  flex-direction: column;
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

.email-list {
  display: flex;
  flex-direction: column;
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
  min-width: 0;
}

.email-sender {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
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
</style>
