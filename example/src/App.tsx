import FontAwesome from 'react-native-vector-icons/FontAwesome'
import React, { useCallback, useState, useRef } from 'react'
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

const audioRecorderPlayer = new AudioRecorderPlayer()

// import { unzip } from 'react-native-zip-archive'
// import Sound from 'react-native-sound'
// import { initWhisper, libVersion, AudioSessionIos } from '../../src' // whisper.rn
// import type { WhisperContext } from '../../src'
// import contextOpts from './context-opts'
// const sampleFile = require('../assets/jfk.wav')

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
  buttons: { flexDirection: 'row' },
  button: { margin: 4, backgroundColor: '#333', borderRadius: 4, padding: 8 },
  buttonClear: { backgroundColor: '#888' },
  buttonText: { fontSize: 14, color: 'white', textAlign: 'center' },
  logContainer: {
    backgroundColor: 'lightgray',
    padding: 8,
    width: '95%',
    borderRadius: 8,
    marginVertical: 8,
  },
  logText: { fontSize: 12, color: '#333' },

  // My styles
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
  circleButton: {
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
    marginTop: 10,
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
})

// function toTimestamp(t: number, comma = false) {
//   let msec = t * 10
//   const hr = Math.floor(msec / (1000 * 60 * 60))
//   msec -= hr * (1000 * 60 * 60)
//   const min = Math.floor(msec / (1000 * 60))
//   msec -= min * (1000 * 60)
//   const sec = Math.floor(msec / 1000)
//   msec -= sec * 1000

//   const separator = comma ? ',' : '.'
//   const timestamp = `${String(hr).padStart(2, '0')}:${String(min).padStart(
//     2,
//     '0',
//   )}:${String(sec).padStart(2, '0')}${separator}${String(msec).padStart(
//     3,
//     '0',
//   )}`

//   return timestamp
// }

// const mode = process.env.NODE_ENV === 'development' ? 'debug' : 'release'

const fileDir = `${RNFS.DocumentDirectoryPath}/whisper`

console.log('[App] fileDir', fileDir)

// const recordFile = `${fileDir}/realtime.wav`

// const modelHost = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

// const createDir = async (log: any) => {
//   if (!(await RNFS.exists(fileDir))) {
//     log('Create dir', fileDir)
//     await RNFS.mkdir(fileDir)
//   }
// }

// const filterPath = (path: string) =>
//   path.replace(RNFS.DocumentDirectoryPath, '<DocumentDir>')

function Home({ navigateTo }: { navigateTo: (screenName: string) => void }) {
  // const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
  //   null,
  // )
  // const [logs, setLogs] = useState([`whisper.cpp version: ${libVersion}`])
  // const [transcibeResult, setTranscibeResult] = useState<string | null>(null)
  // const [stopTranscribe, setStopTranscribe] = useState<{
  //   stop: () => void
  // } | null>(null)
  // const [recordedFilePath, setRecordedFilePath] = useState<string | null>(null)

  // const log = useCallback((...messages: any[]) => {
  //   setLogs((prev) => [...prev, messages.join(' ')])
  // }, [])

  // const progress = useCallback(
  //   ({
  //     contentLength,
  //     bytesWritten,
  //   }: {
  //     contentLength: number
  //     bytesWritten: number
  //   }) => {
  //     const written = bytesWritten >= 0 ? bytesWritten : 0
  //     log(`Download progress: ${Math.round((written / contentLength) * 100)}%`)
  //   },
  //   [log],
  // )

  const [selectedRecordingIndex, setSelectedRecordingIndex] = useState<
    number | null
  >(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<Array<Recording>>([])
  const recordingDuration = useRef(0)
  const timer = useRef<NodeJS.Timeout | null>(null)

  const onStartRecord = async () => {
    const dirPath = `${RNFS.DocumentDirectoryPath}/whisper`
    const isDirExist = await RNFS.exists(dirPath)
    if (!isDirExist) {
      await RNFS.mkdir(dirPath)
    }
    const fileName = `recording${recordings.length + 1}.mp3`
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
      name: `Recording ${recordings.length + 1}`,
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

  const handleRecordingPress = (index: number) => {
    if (selectedRecordingIndex === index) {
      setSelectedRecordingIndex(null) // Deselect if already selected
    } else {
      setSelectedRecordingIndex(index) // Select the new index
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TextInput style={styles.searchInput} placeholder="Search recordings" />
        <TouchableOpacity style={styles.circleButton}>
          <FontAwesome name="upload" size={25} color="#182F59" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => navigateTo('Settings')}
        >
          <FontAwesome name="gear" size={25} color="#182F59" />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...styles.scrollview,
          justifyContent: 'flex-start',
        }}
        style={styles.recordingsList}
        showsVerticalScrollIndicator={false}
      >
        {recordings.map((recording, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleRecordingPress(index)}
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
            {recording.transcribedText && (
              <Text style={styles.recordingDetails}>
                {recording.transcribedText}
              </Text>
            )}
            {selectedRecordingIndex === index && (
              <Text style={styles.recordingDetails}>Selected</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.micButton, { zIndex: 1 }]}
          onPress={handleMicPress}
        >
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

  const navigateTo = (screenName: string) => {
    setCurrentScreen(screenName)
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.scrollview}
    >
      {currentScreen === 'Home' && <Home navigateTo={navigateTo} />}
      {currentScreen === 'Settings' && <Settings navigateTo={navigateTo} />}
    </ScrollView>
  )
}
//   <ScrollView
//     contentInsetAdjustmentBehavior="automatic"
//     contentContainerStyle={styles.scrollview}
//   >
//     <SafeAreaView style={styles.container}>
//       <View style={styles.topBar}>
//         <TextInput
//           style={styles.searchInput}
//           placeholder="Search recordings"
//         />
//         <TouchableOpacity style={styles.circleButton}>
//           <FontAwesome name="upload" size={25} color="#182F59" />
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.circleButton}>
//           <FontAwesome name="gear" size={25} color="#182F59" />
//         </TouchableOpacity>
//       </View>
//       <ScrollView style={styles.recordingsList}>
//         {recordings.map((recording, index) => (
//           <Text key={index}>{recording}</Text>
//         ))}
//       </ScrollView>
//       <View style={styles.bottomBar}>
//         <TouchableOpacity
//           style={[styles.micButton, { zIndex: 1 }]}
//           onPress={handleMicPress}
//         >
//           <FontAwesome
//             name={isRecording ? 'stop' : 'microphone'}
//             size={25}
//             color="#FFFFFF"
//           />
//         </TouchableOpacity>
//       </View>
//       {/* <View style={styles.buttons}>
//         <VoiceRecorder onRecorded={setRecordedFilePath} />
//       </View>
//       <View style={styles.buttons}>
//         <TouchableOpacity
//           style={styles.button}
//           onPress={async () => {
//             if (whisperContext) {
//               log('Found previous context')
//               await whisperContext.release()
//               setWhisperContext(null)
//               log('Released previous context')
//             }
//             log('Initialize context...')
//             const startTime = Date.now()
//             const ctx = await initWhisper({
//               filePath: require('../assets/ggml-tiny.en.bin'),
//               ...contextOpts,
//             })
//             const endTime = Date.now()
//             log('Loaded model, ID:', ctx.id)
//             log('Loaded model in', endTime - startTime, `ms in ${mode} mode`)
//             setWhisperContext(ctx)
//           }}
//         >
//           <Text style={styles.buttonText}>Initialize (Use Asset)</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.button}
//           onPress={async () => {
//             if (whisperContext) {
//               log('Found previous context')
//               await whisperContext.release()
//               setWhisperContext(null)
//               log('Released previous context')
//             }
//             await createDir(log)
//             const modelFilePath = `${fileDir}/ggml-base.bin`
//             if (await RNFS.exists(modelFilePath)) {
//               log('Model already exists:')
//               log(filterPath(modelFilePath))
//             } else {
//               log('Start Download Model to:')
//               log(filterPath(modelFilePath))
//               await RNFS.downloadFile({
//                 fromUrl: `${modelHost}/ggml-base.bin`,
//                 toFile: modelFilePath,
//                 progressInterval: 1000,
//                 begin: () => {},
//                 progress,
//               }).promise
//               log('Downloaded model file:')
//               log(filterPath(modelFilePath))
//             }

//             // If you don't want to enable Core ML, you can remove this
//             const coremlModelFilePath = `${fileDir}/ggml-base-encoder.mlmodelc.zip`
//             if (
//               Platform.OS === 'ios' &&
//               (await RNFS.exists(coremlModelFilePath))
//             ) {
//               log('Core ML Model already exists:')
//               log(filterPath(coremlModelFilePath))
//             } else if (Platform.OS === 'ios') {
//               log('Start Download Core ML Model to:')
//               log(filterPath(coremlModelFilePath))
//               await RNFS.downloadFile({
//                 fromUrl: `${modelHost}/ggml-base-encoder.mlmodelc.zip`,
//                 toFile: coremlModelFilePath,
//                 progressInterval: 1000,
//                 begin: () => {},
//                 progress,
//               }).promise
//               log('Downloaded Core ML Model model file:')
//               log(filterPath(modelFilePath))
//               await unzip(coremlModelFilePath, fileDir)
//               log('Unzipped Core ML Model model successfully.')
//             }

//             log('Initialize context...')
//             const startTime = Date.now()
//             const ctx = await initWhisper({ filePath: modelFilePath })
//             const endTime = Date.now()
//             log('Loaded model, ID:', ctx.id)
//             log('Loaded model in', endTime - startTime, `ms in ${mode} mode`)
//             setWhisperContext(ctx)
//           }}
//         >
//           <Text style={styles.buttonText}>Initialize (Download)</Text>
//         </TouchableOpacity>
//       </View>
//       <View style={styles.buttons}>
//         <TouchableOpacity
//           style={styles.button}
//           disabled={!!stopTranscribe?.stop}
//           onPress={async () => {
//             if (!whisperContext) return log('No context')

//             log('Start transcribing...')
//             const startTime = Date.now()
//             const { stop, promise } = whisperContext.transcribe(sampleFile, {
//               maxLen: 1,
//               tokenTimestamps: true,
//               onProgress: (cur) => {
//                 log(`Transcribing progress: ${cur}%`)
//               },
//               language: 'en',
//               // prompt: 'HELLO WORLD',
//               // onNewSegments: (segments) => {
//               //   console.log('New segments:', segments)
//               // },
//             })
//             setStopTranscribe({ stop })
//             const { result, segments } = await promise
//             const endTime = Date.now()
//             setStopTranscribe(null)
//             setTranscibeResult(
//               `Transcribed result: ${result}\n` +
//                 `Transcribed in ${endTime - startTime}ms in ${mode} mode` +
//                 `\n` +
//                 `Segments:` +
//                 `\n${segments
//                   .map(
//                     (segment) =>
//                       `[${toTimestamp(segment.t0)} --> ${toTimestamp(
//                         segment.t1,
//                       )}]  ${segment.text}`,
//                   )
//                   .join('\n')}`,
//             )
//             log('Finished transcribing')
//           }}
//         >
//           <Text style={styles.buttonText}>Transcribe File</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.button}
//           disabled={!!stopTranscribe?.stop || !recordedFilePath}
//           onPress={async () => {
//             if (!whisperContext || !recordedFilePath)
//               return log('No context or no recorded file')

//             log('Start transcribing...')
//             const startTime = Date.now()
//             const { stop, promise } = whisperContext.transcribe(
//               recordedFilePath,
//               {
//                 maxLen: 1,
//                 tokenTimestamps: true,
//                 onProgress: (cur) => {
//                   log(`Transcribing progress: ${cur}%`)
//                 },
//                 language: 'en',
//                 // prompt: 'HELLO WORLD',
//                 // onNewSegments: (segments) => {
//                 //   console.log('New segments:', segments)
//                 // },
//               },
//             )
//             setStopTranscribe({ stop })
//             const { result, segments } = await promise
//             const endTime = Date.now()
//             setStopTranscribe(null)
//             setTranscibeResult(
//               `Transcribed result: ${result}\n` +
//                 `Transcribed in ${endTime - startTime}ms in ${mode} mode` +
//                 `\n` +
//                 `Segments:` +
//                 `\n${segments
//                   .map(
//                     (segment) =>
//                       `[${toTimestamp(segment.t0)} --> ${toTimestamp(
//                         segment.t1,
//                       )}]  ${segment.text}`,
//                   )
//                   .join('\n')}`,
//             )
//             log('Finished transcribing')
//           }}
//         >
//           <Text style={styles.buttonText}>Transcribe Recorded File</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[
//             styles.button,
//             stopTranscribe?.stop ? styles.buttonClear : null,
//           ]}
//           onPress={async () => {
//             if (!whisperContext) return log('No context')
//             if (stopTranscribe?.stop) {
//               const t0 = Date.now()
//               await stopTranscribe?.stop()
//               const t1 = Date.now()
//               log('Stopped transcribing in', t1 - t0, 'ms')
//               setStopTranscribe(null)
//               return
//             }
//             log('Start realtime transcribing...')
//             try {
//               await createDir(log)
//               const { stop, subscribe } =
//                 await whisperContext.transcribeRealtime({
//                   maxLen: 1,
//                   language: 'en',
//                   // Enable beam search (may be slower than greedy but more accurate)
//                   // beamSize: 2,
//                   // Record duration in seconds
//                   realtimeAudioSec: 60,
//                   // Slice audio into 25 (or < 30) sec chunks for better performance
//                   realtimeAudioSliceSec: 25,
//                   // Save audio on stop
//                   audioOutputPath: recordFile,
//                   // iOS Audio Session
//                   audioSessionOnStartIos: {
//                     category: AudioSessionIos.Category.PlayAndRecord,
//                     options: [
//                       AudioSessionIos.CategoryOption.MixWithOthers,
//                       AudioSessionIos.CategoryOption.AllowBluetooth,
//                     ],
//                     mode: AudioSessionIos.Mode.Default,
//                   },
//                   audioSessionOnStopIos: 'restore', // Or an AudioSessionSettingIos
//                   // Voice Activity Detection - Start transcribing when speech is detected
//                   // useVad: true,
//                 })
//               setStopTranscribe({ stop })
//               subscribe((evt) => {
//                 const { isCapturing, data, processTime, recordingTime } = evt
//                 setTranscibeResult(
//                   `Realtime transcribing: ${isCapturing ? 'ON' : 'OFF'}\n` +
//                     `Result: ${data?.result}\n\n` +
//                     `Process time: ${processTime}ms\n` +
//                     `Recording time: ${recordingTime}ms` +
//                     `\n` +
//                     `Segments:` +
//                     `\n${data?.segments
//                       .map(
//                         (segment) =>
//                           `[${toTimestamp(segment.t0)} --> ${toTimestamp(
//                             segment.t1,
//                           )}]  ${segment.text}`,
//                       )
//                       .join('\n')}`,
//                 )
//                 if (!isCapturing) {
//                   setStopTranscribe(null)
//                   log('Finished realtime transcribing')
//                 }
//               })
//             } catch (e) {
//               log('Error:', e)
//             }
//           }}
//         >
//           <Text style={styles.buttonText}>
//             {stopTranscribe?.stop ? 'Stop' : 'Realtime'}
//           </Text>
//         </TouchableOpacity>
//       </View>
//       <View style={styles.logContainer}>
//         {logs.map((msg, index) => (
//           <Text key={index} style={styles.logText}>
//             {msg}
//           </Text>
//         ))}
//       </View>
//       {transcibeResult && (
//         <View style={styles.logContainer}>
//           <Text style={styles.logText}>{transcibeResult}</Text>
//         </View>
//       )}

//       <TouchableOpacity
//         style={[styles.button, styles.buttonClear]}
//         onPress={async () => {
//           if (!whisperContext) return
//           await whisperContext.release()
//           setWhisperContext(null)
//           log('Released context')
//         }}
//       >
//         <Text style={styles.buttonText}>Release Context</Text>
//       </TouchableOpacity>
//       <TouchableOpacity
//         style={[styles.button, styles.buttonClear]}
//         onPress={() => {
//           setLogs([])
//           setTranscibeResult('')
//         }}
//       >
//         <Text style={styles.buttonText}>Clear Logs</Text>
//       </TouchableOpacity>
//       <TouchableOpacity
//         style={[styles.button, styles.buttonClear]}
//         onPress={async () => {
//           await RNFS.unlink(fileDir).catch(() => {})
//           log('Deleted files')
//         }}
//       >
//         <Text style={styles.buttonText}>Clear Download files</Text>
//       </TouchableOpacity>
//       <TouchableOpacity
//         style={[styles.button, styles.buttonClear]}
//         onPress={async () => {
//           if (!(await RNFS.exists(recordFile))) {
//             log('Recorded file does not exist')
//             return
//           }
//           const player = new Sound(recordFile, '', (e) => {
//             if (e) {
//               log('error', e)
//               return
//             }
//             player.play((success) => {
//               if (success) {
//                 log('successfully finished playing')
//               } else {
//                 log('playback failed due to audio decoding errors')
//               }
//               player.release()
//             })
//           })
//         }}
//       >
//         <Text style={styles.buttonText}>Play Recorded file</Text>
//       </TouchableOpacity> */}
//     </SafeAreaView>
//   </ScrollView>
