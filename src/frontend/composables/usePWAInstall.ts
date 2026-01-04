import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
  const isInstallable = ref(false)

  const isMobile = () => {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  const isStandalone = () => {
    // Check if app is already installed/running as PWA
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    )
  }

  const setupInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault()
      deferredPrompt.value = e as BeforeInstallPromptEvent
      isInstallable.value = true
    })

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed')
      deferredPrompt.value = null
      isInstallable.value = false
    })
  }

  const promptInstall = async () => {
    if (!deferredPrompt.value) {
      return { outcome: 'dismissed' as const }
    }

    await deferredPrompt.value.prompt()
    const choiceResult = await deferredPrompt.value.userChoice

    deferredPrompt.value = null
    isInstallable.value = false

    return choiceResult
  }

  onMounted(() => {
    setupInstallPrompt()
  })

  return {
    isInstallable,
    isMobile,
    isStandalone,
    promptInstall,
    setupInstallPrompt
  }
}
