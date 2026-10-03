export type AppScreen = 'Home' | 'Recording' | 'Settings'
export type AppearancePreference = 'light' | 'dark' | 'system'
export type AppLanguage = 'en' | 'kk'

export interface Recording {
  name: string
  path: string
  recordedAt: number
  duration: string
  transcribedText?: string
}
