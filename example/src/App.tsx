import FontAwesome from 'react-native-vector-icons/FontAwesome'
import React, {
  useCallback,
  useState,
  useRef,
  SetStateAction,
  useEffect,
} from 'react'
import {
  Button,
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  PermissionsAndroid,
  TextInput,
  Text,
} from 'react-native'
import RNFS from 'react-native-fs'
import AudioRecorderPlayer from 'react-native-audio-recorder-player'
// import { unzip } from 'react-native-zip-archive'
// import Sound from 'react-native-sound'
import { initWhisper } from '../../src' // whisper.rn
import type { WhisperContext } from '../../src'
import contextOpts from './context-opts'

const audioRecorderPlayer = new AudioRecorderPlayer()

if (Platform.OS === 'android') {
  // Request record audio permission
  // @ts-ignore
  PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Whisper Audio Permission',
    message: 'Whisper needs access to your microphone',
    buttonNeutral: 'Ask Me Later',
    buttonNegative: 'Cancel',
    buttonPositive: 'OK',
  })
}

type Recording = {
  name: string
  path: string
  date: string
  duration: string
  transcribedText?: string
}

const styles = StyleSheet.create({
  scrollview: { flexGrow: 1, justifyContent: 'center' },
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  buttons: { flexDirection: 'row' },
  button: {
    margin: 4,
    backgroundColor: '#182F59',
    borderRadius: 10,
    padding: 10,
  },
  buttonClear: { backgroundColor: '#888' },
  buttonText: { fontSize: 14, color: 'white', textAlign: 'center' },
  logContainer: {
    backgroundColor: 'lightgray',
    padding: 8,
    width: '95%',
    borderRadius: 8,
    marginVertical: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    borderRadius: 50,
    backgroundColor: '#fff',
    paddingLeft: 20,
    borderColor: '#ddd',
    borderWidth: 1,
    fontSize: 16,
  },
  circleButtonRight: {
    width: 50,
    height: 50,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
  },
  circleButtonLeft: {
    width: 50,
    height: 50,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
  },

  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#182F59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingsList: {
    flex: 1,
    marginBottom: 70,
  },
  recordingItem: {
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderColor: '#ddd',
    borderWidth: 1,
    width: '100%',
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#182F59',
  },
  recordingDetails: {
    fontSize: 16,
    color: 'grey',
  },
  scrollableTextBox: {
    flex: 1,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderColor: '#ddd',
    borderWidth: 1,
    width: '100%',
    marginBottom: 10,
  },
  miniPlayer: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderColor: '#ddd',
    borderWidth: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  playerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#182F59',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
  },
  outputText: {
    paddingTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#182F59',
  },
})

function toTimestamp(t: number, comma = false) {
  let msec = t * 10
  const hr = Math.floor(msec / (1000 * 60 * 60))
  msec -= hr * (1000 * 60 * 60)
  const min = Math.floor(msec / (1000 * 60))
  msec -= min * (1000 * 60)
  const sec = Math.floor(msec / 1000)
  msec -= sec * 1000

  const separator = comma ? ',' : '.'
  const timestamp = `${String(hr).padStart(2, '0')}:${String(min).padStart(
    2,
    '0',
  )}:${String(sec).padStart(2, '0')}${separator}${String(msec).padStart(
    3,
    '0',
  )}`

  return timestamp
}

const mode = process.env.NODE_ENV === 'development' ? 'debug' : 'release'

interface HomeProps {
  navigateTo: (screenName: string, index?: number | null) => void
  recordings: Recording[]
  setRecordings: React.Dispatch<SetStateAction<Recording[]>>
}

function Home({ navigateTo, recordings, setRecordings }: HomeProps) {
  const [isRecording, setIsRecording] = useState(false)
  const recordingDuration = useRef(0)
  const timer = useRef<NodeJS.Timeout | null>(null)

  const onStartRecord = async () => {
    const dirPath = `${RNFS.DocumentDirectoryPath}/whisper`
    const isDirExist = await RNFS.exists(dirPath)
    if (!isDirExist) {
      await RNFS.mkdir(dirPath)
    }
    const fileName = `recording${recordings.length}.mp3`
    const path = `${dirPath}/${fileName}`

    const result = await audioRecorderPlayer.startRecorder(path)
    setIsRecording(true)

    // Start the timer
    recordingDuration.current = 0
    timer.current = setInterval(() => {
      recordingDuration.current += 1
    }, 1000)

    console.log(result)
  }

  const onStopRecord = async () => {
    const result = await audioRecorderPlayer.stopRecorder()
    setIsRecording(false)

    const path = `${RNFS.DocumentDirectoryPath}/whisper/recording${recordings.length}.mp3`

    // Stop the timer
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }

    const newRecording: Recording = {
      name: `Recording ${recordings.length}`,
      path,
      date: new Date().toLocaleDateString(),
      duration: recordingDuration.current.toString(),
      transcribedText: '', // Set to empty string
    }

    setRecordings((prevRecordings) => [...prevRecordings, newRecording])
    recordingDuration.current = 0
    console.log(result)
  }

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      onStopRecord()
    } else {
      onStartRecord()
    }
  }, [isRecording])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TextInput style={styles.searchInput} placeholder="Search recordings" />
        <TouchableOpacity style={styles.circleButtonRight}>
          <FontAwesome name="upload" size={25} color="#182F59" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.circleButtonRight}
          onPress={() => navigateTo('Settings')}
        >
          <FontAwesome name="gear" size={25} color="#182F59" />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.recordingsList}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {recordings.map((recording, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => navigateTo('Recording', index)}
            style={styles.recordingItem}
          >
            <View style={styles.recordingHeader}>
              <Text style={styles.recordingName}>{recording.name}</Text>
              <FontAwesome name="ellipsis-v" size={20} color="#182F59" />
            </View>
            <Text style={styles.recordingDetails}>
              {'Date: '}
              {recording.date}
              {' | Duration: '}
              {recording.duration}
              {' seconds'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.micButton} onPress={handleMicPress}>
          <FontAwesome
            name={isRecording ? 'stop' : 'microphone'}
            size={25}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

interface RecordingProps {
  navigateTo: (screenName: string, index: number | null) => void
  recordings: Array<Recording>
  setRecordings: React.Dispatch<SetStateAction<Recording[]>>
  selectedRecordingIndex: number | null
  whisperContext: WhisperContext | null
}

function Recording({
  navigateTo,
  recordings,
  setRecordings,
  selectedRecordingIndex,
  whisperContext,
}: RecordingProps) {
  const [stopTranscribe, setStopTranscribe] = useState<{
    stop: () => void
  } | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)

  if (selectedRecordingIndex === null) {
    return null
  }
  const selectedRecording = recordings[selectedRecordingIndex]
  if (!selectedRecording) {
    return null
  }

  const onPlayRecord = async () => {
    if (selectedRecording.path) {
      const fileExists = await RNFS.exists(selectedRecording.path)
      if (!fileExists) {
        console.log(`File does not exist at path: ${selectedRecording.path}`)
        return
      }

      const result = await audioRecorderPlayer.startPlayer(
        selectedRecording.path,
      )
      console.log(result)
    }
  }

  const onPauseRecord = async () => {
    const result = await audioRecorderPlayer.pausePlayer()
    console.log(result)
  }

  const updateSelectedRecordingTranscribedText = (transcribedText: string) => {
    const updatedRecordings = recordings.map((recording, index) => {
      if (index === selectedRecordingIndex) {
        return { ...recording, transcribedText }
      }
      return recording
    })
    setRecordings(updatedRecordings)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.circleButtonLeft}
          onPress={() => navigateTo('Home', null)}
        >
          <FontAwesome name="arrow-left" size={25} color="#182F59" />
        </TouchableOpacity>
        <Text style={styles.recordingName}>{selectedRecording.name}</Text>
        <TouchableOpacity style={styles.circleButtonRight}>
          <FontAwesome name="gear" size={25} color="#182F59" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollableTextBox}>
        <TouchableOpacity
          style={styles.button}
          disabled={!!stopTranscribe?.stop}
          onPress={async () => {
            if (!whisperContext) return console.log('No context')

            console.log('Start transcribing...')
            const startTime = Date.now()
            const { stop, promise } = whisperContext.transcribe(
              selectedRecording.path,
              {
                maxLen: 1,
                tokenTimestamps: true,
                onProgress: (cur) => {
                  console.log(`Transcribing progress: ${cur}%`)
                },
                language: 'en',
              },
            )
            setStopTranscribe({ stop })
            const { result, segments } = await promise
            const endTime = Date.now()
            setStopTranscribe(null)
            console.log(
              `Transcribed result: ${result}\n` +
                `Transcribed in ${endTime - startTime}ms in ${mode} mode` +
                `\n` +
                `Segments:` +
                `\n${segments
                  .map(
                    (segment) =>
                      `[${toTimestamp(segment.t0)} --> ${toTimestamp(
                        segment.t1,
                      )}]  ${segment.text}`,
                  )
                  .join('\n')}`,
            )
            const transcribedText = `${result}`
            updateSelectedRecordingTranscribedText(transcribedText)
            console.log('Finished transcribing')
          }}
        >
          <Text style={styles.buttonText}>Transcribe File</Text>
        </TouchableOpacity>
        <Text style={styles.outputText}>
          {selectedRecording.transcribedText}
        </Text>
      </ScrollView>
      <View style={styles.miniPlayer}>
        <TouchableOpacity
          style={styles.playerButton}
          onPress={() => {
            setIsPlaying(!isPlaying)
            isPlaying ? onPauseRecord() : onPlayRecord()
          }}
        >
          <FontAwesome
            name={isPlaying ? 'pause' : 'play'}
            size={25}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function Settings({
  navigateTo,
}: {
  navigateTo: (screenName: string) => void
}) {
  return (
    <SafeAreaView style={styles.container}>
      <Text>Settings</Text>
      <Button title="Back" onPress={() => navigateTo('Home')} />
    </SafeAreaView>
  )
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home')
  const [recordings, setRecordings] = useState<Array<Recording>>([])
  const [selectedRecordingIndex, setSelectedRecordingIndex] = useState<
    number | null
  >(null)
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null,
  )

  useEffect(() => {
    const initializeAsset = async () => {
      if (whisperContext) {
        console.log('Found previous context')
        await whisperContext.release()
        setWhisperContext(null)
        console.log('Released previous context')
      }
      console.log('Initialize context...')
      const startTime = Date.now()
      const ctx = await initWhisper({
        filePath: require('../assets/ggml-tiny.bin'),
        ...contextOpts,
      })
      const endTime = Date.now()
      console.log('Loaded model, ID:', ctx.id)
      console.log('Loaded model in', endTime - startTime, `ms`)
      setWhisperContext(ctx)
    }

    initializeAsset()
  }, [])

  const navigateTo = (screenName: string, index: number | null = null) => {
    setCurrentScreen(screenName)
    setSelectedRecordingIndex(index)
  }

  return (
    <View style={{ flex: 1 }}>
      {currentScreen === 'Home' && (
        <Home
          navigateTo={navigateTo}
          recordings={recordings}
          setRecordings={setRecordings}
        />
      )}
      {currentScreen === 'Settings' && <Settings navigateTo={navigateTo} />}
      {currentScreen === 'Recording' && (
        <Recording
          navigateTo={navigateTo}
          recordings={recordings}
          setRecordings={setRecordings}
          selectedRecordingIndex={selectedRecordingIndex}
          whisperContext={whisperContext} // Pass whisperContext as a prop
        />
      )}
    </View>
  )
}
