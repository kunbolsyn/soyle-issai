export function toTimestamp(t: number, comma = false) {
  let msec = t * 10
  const hr = Math.floor(msec / (1000 * 60 * 60))
  msec -= hr * (1000 * 60 * 60)
  const min = Math.floor(msec / (1000 * 60))
  msec -= min * (1000 * 60)
  const sec = Math.floor(msec / 1000)
  msec -= sec * 1000

  const separator = comma ? ',' : '.'
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(
    2,
    '0',
  )}:${String(sec).padStart(2, '0')}${separator}${String(msec).padStart(
    3,
    '0',
  )}`
}

export function formatRecordingTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatRecordingDuration(duration: string | number) {
  const totalSeconds = Math.max(0, Math.floor(Number(duration) || 0))
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}`
}

export function getAudioLevel(data: string) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let bits = 0
  let value = 0
  let byteIndex = 0
  let lowByte = 0
  let sumSquares = 0
  let sampleCount = 0
  let isFinished = false

  data.split('').forEach((character) => {
    if (isFinished) return
    if (character === '=') {
      isFinished = true
      return
    }
    const digit = alphabet.indexOf(character)
    if (digit < 0) return
    value = value * 64 + digit
    bits += 6
    if (bits >= 8) {
      bits -= 8
      const divisor = 2 ** bits
      const byte = Math.floor(value / divisor)
      value -= byte * divisor
      if (byteIndex % 2 === 0) {
        lowByte = byte
      } else {
        let sample = lowByte + byte * 256
        if (sample >= 32768) sample -= 65536
        sumSquares += (sample / 32768) ** 2
        sampleCount += 1
      }
      byteIndex += 1
    }
  })

  return sampleCount === 0
    ? 0
    : Math.min(1, Math.sqrt(sumSquares / sampleCount) * 10)
}

export const transcriptionMode = __DEV__ ? 'debug' : 'release'
