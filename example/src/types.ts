export type AppScreen = 'Home' | 'Recording' | 'Settings'
export type AppearancePreference = 'light' | 'dark' | 'system'

export interface Recording {
  name: string
  path: string
  recordedAt: number
  duration: string
  transcribedText?: string
}
