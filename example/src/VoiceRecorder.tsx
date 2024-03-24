import React, { useState } from 'react'
import { Button, View } from 'react-native'
import AudioRecorderPlayer from 'react-native-audio-recorder-player'
import RNFS from 'react-native-fs'

const audioRecorderPlayer = new AudioRecorderPlayer()

interface VoiceRecorderProps {
  onRecorded: (path: string) => void
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecorded }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null)

  const onStartRecord = async () => {
    const dirPath = `${RNFS.DocumentDirectoryPath}/whisper`
    const isDirExist = await RNFS.exists(dirPath)
    if (!isDirExist) {
      await RNFS.mkdir(dirPath)
    }
    const path = `${dirPath}/recorded_audio.mp4`

    const result = await audioRecorderPlayer.startRecorder(path)
    setIsRecording(true)
    console.log(result)
  }

  const onStopRecord = async () => {
    const result = await audioRecorderPlayer.stopRecorder()
    setIsRecording(false)
    const path = `${RNFS.DocumentDirectoryPath}/whisper/recorded_audio.mp4`
    onRecorded(path)
    setRecordedFilePath(path)
    console.log(result)
  }

  const onPlayRecord = async () => {
    if (recordedFilePath) {
      const fileExists = await RNFS.exists(recordedFilePath)
      if (!fileExists) {
        console.log(`File does not exist at path: ${recordedFilePath}`)
        return
      }

      const result = await audioRecorderPlayer.startPlayer(recordedFilePath)
      console.log(result)
    }
  }

  return (
    <View>
      <Button
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={isRecording ? onStopRecord : onStartRecord}
      />
      <Button
        title="Play Recording"
        onPress={onPlayRecord}
        disabled={isRecording || !recordedFilePath}
      />
    </View>
  )
}

export default VoiceRecorder
