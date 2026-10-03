import Feather from 'react-native-vector-icons/Feather'
import React, { useEffect, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
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
import uuid from 'react-native-uuid'
import {
  formatRecordingDuration,
  formatRecordingTimestamp,
  getAudioLevel,
} from '../audioUtils'
import { translate } from '../i18n'
import { getStyles, getThemeColors } from '../styles'
import type { AppLanguage, AppScreen, Recording } from '../types'

interface HomeScreenProps {
  navigateTo: (screenName: AppScreen, index?: number | null) => void
  recordings: Recording[]
  setRecordings: React.Dispatch<SetStateAction<Recording[]>>
  isImportingAudio: boolean
  onImportAudio: () => void
  isDark: boolean
  language: AppLanguage
}

export default function HomeScreen({
  navigateTo,
  recordings,
  setRecordings,
  isImportingAudio,
  onImportAudio,
  isDark,
  language,
}: HomeScreenProps) {
  const styles = getStyles(isDark)
  const colors = getThemeColors(isDark)
  const t = (
    key: Parameters<typeof translate>[1],
    values?: Record<string, string | number>,
  ) => translate(language, key, values)
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
  const recordingOverlayOffset = useRef(new Animated.Value(0)).current
  const listScrollY = useRef(new Animated.Value(0)).current
  const lastWaveformUpdate = useRef(0)
  const recordingDuration = useRef(0)
  const recordingStartedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentRecordingName = `${t('recording')} ${recordings.length + 1}`

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

  useEffect(() => {
    if (!isRecording) {
      recordingOverlayOffset.setValue(0)
      return
    }

    recordingOverlayOffset.setValue(48)
    const animation = Animated.timing(recordingOverlayOffset, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [isRecording, recordingOverlayOffset])

  const onStartRecord = async () => {
    if (Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(
        'android.permission.RECORD_AUDIO',
        {
          title: t('microphoneAccess'),
          message: t('microphoneAccessMessage'),
          buttonNeutral: t('askMeLater'),
          buttonNegative: t('cancel'),
          buttonPositive: t('ok'),
        },
      )
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) return
    }

    const dirPath = `${RNFS.DocumentDirectoryPath}/soyle`
    const isDirExist = await RNFS.exists(dirPath)
    if (!isDirExist) {
      await RNFS.mkdir(dirPath)
    }
    const fileName = `recording-${uuid.v4()}.wav`
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
        t('someRecordingsCouldNotBeDeleted'),
        t('recordingsRemainSelected', {
          count: failedPaths.size,
          plural: failedPaths.size === 1 ? '' : 's',
        }),
      )
    }
  }

  const confirmDeleteSelectedRecordings = () => {
    const count = selectedRecordingPaths.size
    Alert.alert(
      t('deleteRecordingsTitle', {
        count,
        plural: count === 1 ? '' : 's',
      }),
      t('deleteSelectedAudioMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
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
              {t('selectedCount', { count: selectedRecordingPaths.size })}
            </Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  allVisibleRecordingsSelected
                    ? t('deselectAllVisibleRecordings')
                    : t('selectAllVisibleRecordings')
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
                  size={21}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('deleteSelectedRecordingsLabel', {
                  count: selectedRecordingPaths.size,
                })}
                style={styles.iconButton}
                onPress={confirmDeleteSelectedRecordings}
              >
                <Feather name="trash-2" size={21} color={colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('cancelSelection')}
                style={styles.iconButton}
                onPress={() => setSelectedRecordingPaths(new Set())}
              >
                <Feather name="x" size={21} color={colors.primary} />
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
              {t('recordings')}
            </Animated.Text>
            <View style={styles.topActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('importAudio')}
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
                accessibilityLabel={t('settings')}
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
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.pageTitle,
            {
              opacity: expandedTitleOpacity,
            },
          ]}
        >
          {t('recordings')}
        </Animated.Text>
        <View style={styles.homeSearchContainer}>
          <Feather name="search" size={17} color={colors.muted} />
          <TextInput
            style={styles.homeSearchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('searchRecordings')}
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
          />
        </View>
        {filteredRecordings.length === 0 ? (
          <View style={[styles.emptyState, styles.homeEmptyState]}>
            <Image
              source={require('../../assets/microphone.png')}
              style={styles.emptyIllustration}
              resizeMode="contain"
              accessibilityLabel={t('emptyRecordingsTitle')}
            />
            <Text style={styles.emptyTitle}>
              {searchQuery
                ? t('noMatchingRecordings')
                : t('emptyRecordingsTitle')}
            </Text>
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
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.floatingDock,
          isRecording && styles.recordingPanel,
          { transform: [{ translateY: recordingOverlayOffset }] },
        ]}
      >
        <View pointerEvents="box-none" style={styles.dockContent}>
          {isRecording && (
            <>
              <Text style={styles.dockLabel}>{currentRecordingName}</Text>
              <Text style={styles.dockSubtitle}>{elapsedTime}</Text>
              <View
                accessibilityLabel={t('liveAudioWaveform')}
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
                isRecording ? t('stopRecording') : t('startRecording')
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
      </Animated.View>
    </SafeAreaView>
  )
}
