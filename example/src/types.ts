export type AppScreen = 'Home' | 'Recording' | 'Settings'

export interface Recording {
  name: string
  path: string
  recordedAt: number
  duration: string
  transcribedText?: string
}
