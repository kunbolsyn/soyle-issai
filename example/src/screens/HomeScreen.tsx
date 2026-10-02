import Feather from 'react-native-vector-icons/Feather'
import React, { useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import RNFS from 'react-native-fs'
import AudioRecord from 'react-native-audio-record'
import {
  formatRecordingDuration,
  formatRecordingTimestamp,
  getAudioLevel,
} from '../audioUtils'
import { getStyles, getThemeColors } from '../styles'
import type { AppScreen, Recording } from '../types'

interface HomeScreenProps {
  navigateTo: (screenName: AppScreen, index?: number | null) => void
  recordings: Recording[]
  setRecordings: React.Dispatch<SetStateAction<Recording[]>>
  isImportingAudio: boolean
  onImportAudio: () => void
  isDark: boolean
}

export default function HomeScreen({
  navigateTo,
  recordings,
  setRecordings,
  isImportingAudio,
  onImportAudio,
  isDark,
}: HomeScreenProps) {
  const styles = getStyles(isDark)
  const colors = getThemeColors(isDark)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [waveformLevels, setWaveformLevels] = useState<number[]>(
    Array.from({ length: 48 }, () => 0),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecordingPaths, setSelectedRecordingPaths] = useState<
    Set<string>
  >(() => new Set())
  const isRecordingRef = useRef(false)
  const pulse = useRef(new Animated.Value(0)).current
  const listScrollY = useRef(new Animated.Value(0)).current
  const lastWaveformUpdate = useRef(0)
  const recordingDuration = useRef(0)
  const recordingStartedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentRecordingName = `Recording ${recordings.length + 1}`

  useEffect(() => {
    const addDataListener = AudioRecord.on as unknown as (
      event: 'data',
      callback: (data: string) => void,
    ) => { remove: () => void }
    const subscription = addDataListener('data', (data) => {
      if (
        !isRecordingRef.current ||
        Date.now() - lastWaveformUpdate.current < 75
      ) {
        return
      }
      lastWaveformUpdate.current = Date.now()
      const level = getAudioLevel(data)
      setWaveformLevels((previousLevels) => [...previousLevels.slice(1), level])
    })

    return () => {
      subscription.remove()
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!isRecording) {
      pulse.setValue(0)
      return
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [isRecording, pulse])

  const onStartRecord = async () => {
    if (Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(
        'android.permission.RECORD_AUDIO',
        {
          title: 'Microphone Access',
          message: 'Microphone access is needed to record speech.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      )
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) return
    }

    const dirPath = `${RNFS.DocumentDirectoryPath}/soyle`
    const isDirExist = await RNFS.exists(dirPath)
    if (!isDirExist) {
      await RNFS.mkdir(dirPath)
    }
    const fileName = `recording${recordings.length + 1}.wav`
    recordingStartedAt.current = Date.now()
    AudioRecord.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      wavFile: `soyle/${fileName}`,
    })
    AudioRecord.start()
    isRecordingRef.current = true
    setIsRecording(true)
    setElapsedSeconds(0)
    setWaveformLevels(Array.from({ length: 48 }, () => 0))

    recordingDuration.current = 0
    timer.current = setInterval(() => {
      recordingDuration.current += 1
      setElapsedSeconds(recordingDuration.current)
    }, 1000)

    console.log(`Recording to ${dirPath}/${fileName}`)
  }

  const onStopRecord = async () => {
    const path = await AudioRecord.stop()
    isRecordingRef.current = false
    setIsRecording(false)

    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }

    const newRecording: Recording = {
      name: currentRecordingName,
      path,
      recordedAt: recordingStartedAt.current,
      duration: recordingDuration.current.toString(),
      transcribedText: '',
    }

    setRecordings((previousRecordings) => [...previousRecordings, newRecording])
    recordingDuration.current = 0
    console.log(`Saved recording to ${path}`)
  }

  const handleMicPress = () => {
    if (isRecording) {
      void onStopRecord()
    } else {
      void onStartRecord()
    }
  }

  const filteredRecordings = [...recordings]
    .sort((first, second) => second.recordedAt - first.recordedAt)
    .filter((recording) =>
      recording.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    )
  const allVisibleRecordingsSelected =
    filteredRecordings.length > 0 &&
    filteredRecordings.every((recording) =>
      selectedRecordingPaths.has(recording.path),
    )

  const toggleRecordingSelection = (path: string) => {
    setSelectedRecordingPaths((previousPaths) => {
      const nextPaths = new Set(previousPaths)
      if (nextPaths.has(path)) {
        nextPaths.delete(path)
      } else {
        nextPaths.add(path)
      }
      return nextPaths
    })
  }

  const selectAllVisibleRecordings = () => {
    const visiblePaths = filteredRecordings.map((recording) => recording.path)
    setSelectedRecordingPaths((previousPaths) => {
      const nextPaths = new Set(previousPaths)
      visiblePaths.forEach((path) => {
        if (allVisibleRecordingsSelected) {
          nextPaths.delete(path)
        } else {
          nextPaths.add(path)
        }
      })
      return nextPaths
    })
  }

  const removeSelectedRecordings = async () => {
    const selectedPaths = new Set(selectedRecordingPaths)
    const deletionResults = await Promise.all(
      Array.from(selectedPaths, async (path) => {
        try {
          if (await RNFS.exists(path)) await RNFS.unlink(path)
          return null
        } catch {
          return path
        }
      }),
    )
    const failedPaths = new Set(
      deletionResults.filter((path): path is string => path !== null),
    )

    setRecordings((previousRecordings) =>
      previousRecordings.filter(
        (recording) =>
          !selectedPaths.has(recording.path) || failedPaths.has(recording.path),
      ),
    )
    setSelectedRecordingPaths(failedPaths)
    if (failedPaths.size > 0) {
      Alert.alert(
        'Some recordings could not be deleted',
        `${failedPaths.size} recording${failedPaths.size === 1 ? '' : 's'} remain selected. Please try again.`,
      )
    }
  }

  const confirmDeleteSelectedRecordings = () => {
    const count = selectedRecordingPaths.size
    Alert.alert(
      `Delete ${count} recording${count === 1 ? '' : 's'}?`,
      'This will permanently delete the selected audio files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void removeSelectedRecordings(),
        },
      ],
    )
  }

  const elapsedTime = `00:${String(Math.floor(elapsedSeconds / 60)).padStart(
    2,
    '0',
  )}:${String(elapsedSeconds % 60).padStart(2, '0')}`
  const expandedTitleOpacity = listScrollY.interpolate({
    inputRange: [0, 20, 30],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  })
  const compactTitleOpacity = listScrollY.interpolate({
    inputRange: [22, 32, 50],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {selectedRecordingPaths.size > 0 ? (
          <>
            <Text style={styles.selectionCount}>
              {`${selectedRecordingPaths.size} selected`}
            </Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  allVisibleRecordingsSelected
                    ? 'Deselect all visible recordings'
                    : 'Select all visible recordings'
                }
                style={styles.iconButton}
                onPress={selectAllVisibleRecordings}
              >
                <Feather
                  name={
                    allVisibleRecordingsSelected
                      ? 'minus-square'
                      : 'check-square'
                  }
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Delete ${selectedRecordingPaths.size} selected recordings`}
                style={styles.iconButton}
                onPress={confirmDeleteSelectedRecordings}
              >
                <Feather name="trash-2" size={18} color={colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
                style={styles.iconButton}
                onPress={() => setSelectedRecordingPaths(new Set())}
              >
                <Feather name="x" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.compactPageTitle,
                { opacity: compactTitleOpacity },
              ]}
            >
              Recordings
            </Animated.Text>
            <View style={styles.topActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Import audio"
                disabled={isImportingAudio || isRecording}
                style={styles.iconButton}
                onPress={onImportAudio}
              >
                {isImportingAudio ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Feather name="upload" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Settings"
                disabled={isRecording}
                style={styles.iconButton}
                onPress={() => navigateTo('Settings', null)}
              >
                <Feather name="settings" size={21} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <Animated.ScrollView
        style={styles.recordingsList}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: listScrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {selectedRecordingPaths.size === 0 && (
          <>
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.pageTitle,
                {
                  opacity: expandedTitleOpacity,
                },
              ]}
            >
              Recordings
            </Animated.Text>
            <View style={styles.homeSearchContainer}>
              <Feather name="search" size={17} color={colors.muted} />
              <TextInput
                style={styles.homeSearchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search recordings"
                placeholderTextColor={colors.placeholder}
                returnKeyType="search"
              />
            </View>
          </>
        )}
        {filteredRecordings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIcon}>
                <Feather name="mic" size={24} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'No matching recordings'
                  : 'A little quiet in here'}
              </Text>
              <Text style={styles.emptyDescription}>
                {searchQuery
                  ? 'Try another title or clear your search.'
                  : 'Your recordings will appear here when you capture or import audio.'}
              </Text>
            </View>
          </View>
        ) : (
          filteredRecordings.map((recording) => {
            const index = recordings.indexOf(recording)
            const isSelected = selectedRecordingPaths.has(recording.path)
            return (
              <TouchableOpacity
                key={`${recording.path}-${index}`}
                disabled={isRecording}
                onLongPress={() =>
                  setSelectedRecordingPaths((previousPaths) =>
                    new Set(previousPaths).add(recording.path),
                  )
                }
                onPress={() =>
                  selectedRecordingPaths.size > 0
                    ? toggleRecordingSelection(recording.path)
                    : navigateTo('Recording', index)
                }
                style={[
                  styles.recordingItem,
                  isSelected && styles.recordingItemSelected,
                ]}
              >
                <View style={styles.recordingHeader}>
                  <Text style={styles.recordingName} numberOfLines={1}>
                    {recording.name}
                  </Text>
                  {isSelected ? (
                    <Feather
                      name="check-circle"
                      size={20}
                      color={colors.primary}
                    />
                  ) : (
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={colors.muted}
                    />
                  )}
                </View>
                <View style={styles.recordingFooter}>
                  <Text style={styles.recordingDetails} numberOfLines={1}>
                    {formatRecordingTimestamp(recording.recordedAt)}
                  </Text>
                  <Text style={styles.recordingDuration} numberOfLines={1}>
                    {formatRecordingDuration(recording.duration)}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </Animated.ScrollView>
      <View
        pointerEvents="box-none"
        style={[styles.floatingDock, isRecording && styles.recordingPanel]}
      >
        <View pointerEvents="box-none" style={styles.dockContent}>
          {isRecording && (
            <>
              <Text style={styles.dockLabel}>{currentRecordingName}</Text>
              <Text style={styles.dockSubtitle}>{elapsedTime}</Text>
              <View
                accessibilityLabel="Live audio waveform"
                pointerEvents="none"
                style={styles.waveform}
              >
                {waveformLevels.map((level, index) => (
                  <View
                    key={index}
                    style={[styles.waveformBar, { height: 3 + level * 56 }]}
                  />
                ))}
              </View>
            </>
          )}
          <View pointerEvents="box-none" style={styles.micControl}>
            {isRecording && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 0.15],
                    }),
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.88, 1.25],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                isRecording ? 'Stop recording' : 'Start recording'
              }
              accessibilityState={{
                disabled: selectedRecordingPaths.size > 0,
              }}
              disabled={selectedRecordingPaths.size > 0}
              style={[
                styles.micButton,
                selectedRecordingPaths.size > 0 && styles.micButtonDisabled,
              ]}
              onPress={handleMicPress}
            >
              <Feather
                name={isRecording ? 'square' : 'mic'}
                size={24}
                color={colors.inverse}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
