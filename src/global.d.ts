declare module 'spatial-navigation-js'

interface ElectronBridge {
  readonly isElectron: true
  getSettings(): Promise<{
    customUrl: string
    pipShortcut: string
    discordEnabled: boolean
    cloudflareDns: boolean
    hardwareAcceleration: boolean
    volumeBoost: number
  }>
  saveSettings(data: {
    customUrl?: string
    pipShortcut?: string
    discordEnabled?: boolean
    cloudflareDns?: boolean
    hardwareAcceleration?: boolean
    volumeBoost?: number
  }): void
  getAppVersion(): Promise<string>
  checkForUpdates(): Promise<'available' | 'not-available' | 'error'>
}

interface Window {
  __electronBridge?: ElectronBridge
}
