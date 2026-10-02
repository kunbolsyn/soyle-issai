import React, { useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import RNFS from 'react-native-fs'
import DocumentPicker from 'react-native-document-picker'
import { convertAudioFile, initWhisper } from '../../src'
import type { WhisperContext } from '../../src'
import contextOpts from './context-opts'
import ScreenTransition from './ScreenTransition'
import HomeScreen from './screens/HomeScreen'
import RecordingScreen from './screens/RecordingScreen'
import SettingsScreen from './screens/SettingsScreen'
import type { AppScreen, Recording } from './types'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('Home')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedRecordingIndex, setSelectedRecordingIndex] = useState<
    number | null
  >(null)
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null,
  )
  const [isImportingAudio, setIsImportingAudio] = useState(false)

  const navigateTo = (screenName: AppScreen, index: number | null = null) => {
    setCurrentScreen(screenName)
    setSelectedRecordingIndex(index)
  }

  const onImportAudio = async () => {
    setIsImportingAudio(true)
    try {
      const selectedFile = await DocumentPicker.pickSingle({
        type: DocumentPicker.types.audio,
        copyTo: 'cachesDirectory',
      })
      if (!selectedFile.fileCopyUri) {
        throw new Error(selectedFile.copyError || 'Could not access that file.')
      }

      const recordingsDirectory = `${RNFS.DocumentDirectoryPath}/whisper`
      if (!(await RNFS.exists(recordingsDirectory))) {
        await RNFS.mkdir(recordingsDirectory)
      }
      const outputPath = `${recordingsDirectory}/import-${Date.now()}.wav`
      const duration = await convertAudioFile(
        selectedFile.fileCopyUri,
        outputPath,
      )
      const sourceName = selectedFile.name || 'Imported audio'
      const displayName = sourceName.replace(/\.[^.]+$/, '')

      setRecordings((previousRecordings) => [
        ...previousRecordings,
        {
          name: displayName,
          path: outputPath,
          recordedAt: Date.now(),
          duration: Math.round(duration).toString(),
          transcribedText: '',
        },
      ])
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to import this audio.'
        Alert.alert('Audio import failed', message)
      }
    } finally {
      setIsImportingAudio(false)
    }
  }

  useEffect(() => {
    const initializeWhisper = async () => {
      console.log('Initialize context...')
      const startTime = Date.now()
      const context = await initWhisper({
        filePath: require('../assets/ggml-tiny.bin'),
        ...contextOpts,
      })
      console.log('Loaded model, ID:', context.id)
      console.log('Loaded model in', Date.now() - startTime, 'ms')
      setWhisperContext(context)
    }

    void initializeWhisper()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {currentScreen === 'Home' && (
        <ScreenTransition key="Home">
          <HomeScreen
            navigateTo={navigateTo}
            recordings={recordings}
            setRecordings={setRecordings}
            isImportingAudio={isImportingAudio}
            onImportAudio={() => void onImportAudio()}
          />
        </ScreenTransition>
      )}
      {currentScreen === 'Settings' && (
        <ScreenTransition key="Settings">
          <SettingsScreen navigateTo={navigateTo} />
        </ScreenTransition>
      )}
      {currentScreen === 'Recording' && (
        <ScreenTransition key="Recording">
          <RecordingScreen
            navigateTo={navigateTo}
            recordings={recordings}
            setRecordings={setRecordings}
            selectedRecordingIndex={selectedRecordingIndex}
            whisperContext={whisperContext}
          />
        </ScreenTransition>
      )}
    </View>
  )
}
