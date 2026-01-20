/**
 * Detects if the user is on iOS Safari specifically (not Chrome, Firefox, etc on iOS)
 */
export function isIOSSafari(): boolean {
  const userAgent = navigator.userAgent

  // Check if it's iOS device
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)

  if (!isIOS) {
    return false
  }

  // Check if it's Safari (Safari doesn't have Chrome, CriOS, FxiOS, etc in user agent)
  const isSafari = !/(CriOS|FxiOS|OPiOS|mercury|EdgiOS)/i.test(userAgent)

  return isSafari
}

/**
 * Checks if the app is running in standalone mode (installed as PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/**
 * Check if user should be shown iOS install instructions
 * (iOS Safari + not installed as PWA)
 */
export function shouldShowIOSInstructions(): boolean {
  return isIOSSafari() && !isStandalone()
}
