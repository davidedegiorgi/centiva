interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null

function notifyInstallStateChanged(): void {
  window.dispatchEvent(new Event('centiva:install-state'))
}

export function isRunningStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }

  return window.matchMedia('(display-mode: standalone)').matches
    || navigatorWithStandalone.standalone === true
}

export function canInstallApp(): boolean {
  return deferredInstallPrompt !== null
}

export function subscribeToInstallState(listener: () => void): () => void {
  window.addEventListener('centiva:install-state', listener)

  return () => window.removeEventListener('centiva:install-state', listener)
}

export async function requestAppInstallation(): Promise<boolean> {
  if (!deferredInstallPrompt) return false

  const prompt = deferredInstallPrompt
  await prompt.prompt()
  const choice = await prompt.userChoice

  if (choice.outcome === 'accepted') {
    deferredInstallPrompt = null
    notifyInstallStateChanged()
    return true
  }

  return false
}

export function initializePwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event as BeforeInstallPromptEvent
    notifyInstallStateChanged()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    notifyInstallStateChanged()
  })

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js')
    })
  }
}
