import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { api } from '../api/client'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * Composable for managing PWA push notifications
 *
 * Handles:
 * - Permission requests
 * - Subscription creation and management
 * - Communication with backend API
 * - Multi-device support via unique subscription IDs
 */
export function usePushNotifications() {
  // Check if push notifications are supported
  const isSupported = computed(() =>
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )

  // Track current permission state
  const permission = ref<NotificationPermission>(
    isSupported.value ? Notification.permission : 'denied'
  )

  // Track subscription state
  const isSubscribed = ref(false)
  const currentSubscriptionId = ref<string | null>(
    localStorage.getItem('push_subscription_id')
  )

  /**
   * Request notification permission from the user
   * If granted, automatically subscribes to push notifications
   */
  async function requestPermission(): Promise<NotificationPermission> {
    if (!isSupported.value) {
      throw new Error('Push notifications not supported in this browser')
    }

    const result = await Notification.requestPermission()
    permission.value = result

    if (result === 'granted') {
      await subscribe()
    }

    return result
  }

  /**
   * Subscribe to push notifications
   * Creates a new subscription with the push service and registers it with our backend
   */
  async function subscribe(): Promise<void> {
    if (!isSupported.value) {
      throw new Error('Push notifications not supported')
    }

    if (permission.value !== 'granted') {
      throw new Error('Notification permission not granted')
    }

    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key not configured')
    }

    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      // Generate unique ID for this subscription (or reuse existing)
      const subscriptionId = currentSubscriptionId.value || uuidv4()

      // Extract keys from subscription
      const p256dhKey = subscription.getKey('p256dh')
      const authKey = subscription.getKey('auth')

      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get encryption keys from subscription')
      }

      // Send subscription to backend
      await api.push.subscribe({
        subscription_id: subscriptionId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(p256dhKey),
          auth: arrayBufferToBase64(authKey)
        },
        user_agent: navigator.userAgent
      })

      // Save subscription ID locally
      localStorage.setItem('push_subscription_id', subscriptionId)
      currentSubscriptionId.value = subscriptionId
      isSubscribed.value = true

      console.log('Successfully subscribed to push notifications')
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      throw error
    }
  }

  /**
   * Unsubscribe from push notifications
   * Removes the subscription from both the push service and our backend
   */
  async function unsubscribe(): Promise<void> {
    if (!currentSubscriptionId.value) {
      console.warn('No active subscription to unsubscribe from')
      return
    }

    try {
      // Unsubscribe from push manager
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        console.log('Unsubscribed from push manager')
      }

      // Remove from backend
      await api.push.unsubscribe({
        subscription_id: currentSubscriptionId.value
      })

      // Clear local state
      localStorage.removeItem('push_subscription_id')
      currentSubscriptionId.value = null
      isSubscribed.value = false

      console.log('Successfully unsubscribed from push notifications')
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error)
      throw error
    }
  }

  /**
   * Check if user is currently subscribed
   * Verifies both browser subscription and local state
   */
  async function checkSubscription(): Promise<void> {
    if (!isSupported.value) {
      isSubscribed.value = false
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      // User is subscribed if both browser subscription exists and we have a local subscription ID
      isSubscribed.value = !!subscription && !!currentSubscriptionId.value

      console.log('Subscription check:', {
        hasSubscription: !!subscription,
        hasLocalId: !!currentSubscriptionId.value,
        isSubscribed: isSubscribed.value
      })
    } catch (error) {
      console.error('Failed to check subscription:', error)
      isSubscribed.value = false
    }
  }

  /**
   * Convert URL-safe base64 string to Uint8Array
   * Required for VAPID key format conversion
   */
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  /**
   * Convert ArrayBuffer to base64 string
   * Required for sending encryption keys to backend
   */
  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  return {
    // State
    isSupported,
    permission,
    isSubscribed,
    currentSubscriptionId,

    // Actions
    requestPermission,
    subscribe,
    unsubscribe,
    checkSubscription
  }
}
