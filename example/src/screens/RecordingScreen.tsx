import Feather from 'react-native-vector-icons/Feather'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  type GestureResponderEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import RNFS from 'react-native-fs'
import AudioRecorderPlayer from 'react-native-audio-recorder-player'
import type { WhisperContext } from '../../../src'
import { toTimestamp, transcriptionMode } from '../audioUtils'
import { translate } from '../i18n'
import { getStyles, getThemeColors } from '../styles'
import type { AppLanguage, AppScreen, Recording } from '../types'

const audioRecorderPlayer = new AudioRecorderPlayer()

interface PlaybackSeekBarProps {
  position: number
  duration: number
  onSeek: (progress: number) => void
  isDark: boolean
  language: AppLanguage
}

function formatPlaybackTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function PlaybackSeekBar({
  position,
  duration,
  onSeek,
  isDark,
  language,
}: PlaybackSeekBarProps) {
  const styles = getStyles(isDark)
  const trackWidth = useRef(1)
  const onSeekRef = useRef(onSeek)
  onSeekRef.current = onSeek
  const seekFromTouch = (event: GestureResponderEvent) => {
    onSeekRef.current(event.nativeEvent.locationX / trackWidth.current)
  }
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: seekFromTouch,
        onPanResponderMove: seekFromTouch,
      }),
    [],
  )
  const progress = duration > 0 ? Math.min(1, position / duration) : 0

  return (
    <>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={translate(language, 'playbackPosition')}
        accessibilityValue={{ min: 0, max: duration, now: position }}
        accessibilityActions={[{ name: 'decrement' }, { name: 'increment' }]}
        onAccessibilityAction={(event) =>
          onSeek(
            Math.max(
              0,
              Math.min(
                1,
                progress +
                  (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05),
              ),
            ),
          )
        }
        onLayout={(event) => {
          trackWidth.current = Math.max(1, event.nativeEvent.layout.width)
        }}
        style={styles.playbackSeekArea}
        {...panResponder.panHandlers}
      >
        <View style={styles.playbackTrack}>
          <View
            style={[styles.playbackTrackFill, { width: `${progress * 100}%` }]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[styles.playbackThumb, { left: `${progress * 100}%` }]}
        />
      </View>
      <View style={styles.playbackTimeRow}>
        <Text style={styles.playbackTime}>{formatPlaybackTime(position)}</Text>
        <Text style={styles.playbackTime}>{formatPlaybackTime(duration)}</Text>
      </View>
    </>
  )
}

interface RecordingScreenProps {
  navigateTo: (screenName: AppScreen, index?: number | null) => void
  recordings: Recording[]
  setRecordings: React.Dispatch<SetStateAction<Recording[]>>
  selectedRecordingIndex: number | null
  whisperContext: WhisperContext | null
  isDark: boolean
  language: AppLanguage
}

export default function RecordingScreen({
  navigateTo,
  recordings,
  setRecordings,
  selectedRecordingIndex,
  whisperContext,
  isDark,
  language,
}: RecordingScreenProps) {
  const styles = getStyles(isDark)
  const colors = getThemeColors(isDark)
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(language, key)
  const [stopTranscribe, setStopTranscribe] = useState<{
    stop: () => void
  } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false)
  const [isRecordingMenuVisible, setIsRecordingMenuVisible] = useState(false)
  const [isRecordingMenuMounted, setIsRecordingMenuMounted] = useState(false)
  const [recordingNameDraft, setRecordingNameDraft] = useState('')
  const recordingNameInput = useRef<TextInput>(null)
  const pendingSeekPosition = useRef<number | null>(null)
  const recordingMenuOpacity = useRef(new Animated.Value(0)).current
  const recordingMenuOffset = useRef(new Animated.Value(0)).current
  const renameModalOpacity = useRef(new Animated.Value(0)).current
  const renameModalScale = useRef(new Animated.Value(0.96)).current

  const animateRenameModalIn = () => {
    recordingNameInput.current?.focus()
    Animated.parallel([
      Animated.timing(renameModalOpacity, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(renameModalScale, {
        toValue: 1,
        speed: 20,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const closeRenameModal = () => {
    Animated.parallel([
      Animated.timing(renameModalOpacity, {
        toValue: 0,
        duration: 130,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(renameModalScale, {
        toValue: 0.97,
        duration: 130,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setIsRenameModalVisible(false)
    })
  }

  useEffect(() => {
    audioRecorderPlayer.addPlayBackListener(({ currentPosition, duration }) => {
      setPlaybackPosition(currentPosition)
      setPlaybackDuration(duration)
      if (duration > 0 && currentPosition >= duration) {
        setIsPlaying(false)
        setHasStartedPlayback(false)
        pendingSeekPosition.current = null
      }
    })

    return () => {
      audioRecorderPlayer.removePlayBackListener()
      void audioRecorderPlayer.stopPlayer()
    }
  }, [])

  useEffect(() => {
    if (isRecordingMenuVisible) {
      setIsRecordingMenuMounted(true)
      recordingMenuOpacity.setValue(0)
      recordingMenuOffset.setValue(-4)
      const animation = Animated.parallel([
        Animated.timing(recordingMenuOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(recordingMenuOffset, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ])
      animation.start()
      return () => animation.stop()
    }

    const animation = Animated.parallel([
      Animated.timing(recordingMenuOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(recordingMenuOffset, {
        toValue: -4,
        duration: 140,
        useNativeDriver: true,
      }),
    ])
    animation.start(({ finished }) => {
      if (finished) setIsRecordingMenuMounted(false)
    })
    return () => animation.stop()
  }, [isRecordingMenuVisible, recordingMenuOffset, recordingMenuOpacity])

  if (selectedRecordingIndex === null) return null
  const selectedRecording = recordings[selectedRecordingIndex]
  if (!selectedRecording) return null

  const onPlayRecord = async () => {
    if (!hasStartedPlayback) {
      const fileExists = await RNFS.exists(selectedRecording.path)
      if (!fileExists) {
        console.log(`File does not exist at path: ${selectedRecording.path}`)
        return
      }
      await audioRecorderPlayer.startPlayer(selectedRecording.path)
      if (pendingSeekPosition.current !== null) {
        await audioRecorderPlayer.seekToPlayer(pendingSeekPosition.current)
        pendingSeekPosition.current = null
      }
      setHasStartedPlayback(true)
    } else {
      await audioRecorderPlayer.resumePlayer()
    }
    setIsPlaying(true)
  }

  const onPauseRecord = async () => {
    await audioRecorderPlayer.pausePlayer()
    setIsPlaying(false)
  }

  const seekToProgress = (progress: number) => {
    const duration =
      playbackDuration || Number(selectedRecording.duration) * 1000
    if (duration <= 0) return
    const position = Math.max(0, Math.min(1, progress)) * duration
    setPlaybackPosition(position)
    if (hasStartedPlayback) {
      void audioRecorderPlayer.seekToPlayer(position)
    } else {
      pendingSeekPosition.current = position
    }
  }

  const seekBySeconds = (seconds: number) => {
    const duration =
      playbackDuration || Number(selectedRecording.duration) * 1000
    if (duration <= 0) return
    seekToProgress((playbackPosition + seconds * 1000) / duration)
  }

  const updateSelectedRecordingTranscribedText = (transcribedText: string) => {
    setRecordings((previousRecordings) =>
      previousRecordings.map((recording, index) =>
        index === selectedRecordingIndex
          ? { ...recording, transcribedText }
          : recording,
      ),
    )
  }

  const startTranscription = async () => {
    if (!whisperContext || stopTranscribe) return

    console.log('Start transcribing...')
    const startTime = Date.now()
    const { stop, promise } = whisperContext.transcribe(
      selectedRecording.path,
      {
        maxLen: 1,
        tokenTimestamps: true,
        onProgress: (cur) => console.log(`Transcribing progress: ${cur}%`),
        language: 'kk',
      },
    )
    setStopTranscribe({ stop })
    try {
      const { result, segments } = await promise
      const endTime = Date.now()
      console.log(
        `Transcribed result: ${result}\n` +
          `Transcribed in ${endTime - startTime}ms in ${transcriptionMode} mode` +
          `\nSegments:\n${segments
            .map(
              (segment) =>
                `[${toTimestamp(segment.t0)} --> ${toTimestamp(
                  segment.t1,
                )}]  ${segment.text}`,
            )
            .join('\n')}`,
      )
      updateSelectedRecordingTranscribedText(result)
      console.log('Finished transcribing')
    } catch (error) {
      Alert.alert(
        t('transcriptionFailed'),
        error instanceof Error
          ? error.message
          : t('unableToTranscribeAudio'),
      )
    } finally {
      setStopTranscribe(null)
    }
  }

  const renameSelectedRecording = () => {
    const name = recordingNameDraft.trim()
    if (!name) return
    setRecordings((previousRecordings) =>
      previousRecordings.map((recording, index) =>
        index === selectedRecordingIndex ? { ...recording, name } : recording,
      ),
    )
    closeRenameModal()
  }

  const deleteSelectedRecording = async () => {
    try {
      if (hasStartedPlayback) await audioRecorderPlayer.stopPlayer()
      if (await RNFS.exists(selectedRecording.path)) {
        await RNFS.unlink(selectedRecording.path)
      }
      setRecordings((previousRecordings) =>
        previousRecordings.filter(
          (_, index) => index !== selectedRecordingIndex,
        ),
      )
      navigateTo('Home', null)
    } catch (error) {
      Alert.alert(
        t('unableToDeleteRecording'),
        error instanceof Error ? error.message : t('pleaseTryAgain'),
      )
    }
  }

  const openRenameModal = () => {
    setIsRecordingMenuVisible(false)
    setRecordingNameDraft(selectedRecording.name)
    renameModalOpacity.setValue(0)
    renameModalScale.setValue(0.96)
    setIsRenameModalVisible(true)
  }

  const confirmDeleteRecording = () => {
    setIsRecordingMenuVisible(false)
    Alert.alert(
      t('deleteRecordingTitle'),
      t('deleteRecordingMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => void deleteSelectedRecording(),
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {isRecordingMenuVisible && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dismissRecordingOptions')}
          style={styles.contextMenuBackdrop}
          onPress={() => setIsRecordingMenuVisible(false)}
        />
      )}
      <View
        style={[
          styles.topBar,
          isRecordingMenuVisible && styles.topBarAboveOverlay,
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('backToRecordings')}
          style={styles.circleButtonLeft}
          onPress={() => navigateTo('Home', null)}
        >
          <Feather name="arrow-left" size={21} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.recordingDetailTitle} numberOfLines={1}>
          {selectedRecording.name}
        </Text>
        <View style={styles.topActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('transcribeRecording')}
            disabled={!whisperContext || !!stopTranscribe}
            style={styles.circleButtonRight}
            onPress={() => void startTranscription()}
          >
            {stopTranscribe ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Feather name="file-text" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('recordingOptions')}
            style={styles.circleButtonRight}
            onPress={() => setIsRecordingMenuVisible((visible) => !visible)}
          >
            <Feather name="more-horizontal" size={21} color={colors.primary} />
          </TouchableOpacity>
          {isRecordingMenuMounted && (
            <Animated.View
              style={[
                styles.recordingContextMenu,
                {
                  opacity: recordingMenuOpacity,
                  transform: [{ translateY: recordingMenuOffset }],
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('renameRecordingLabel')}
                style={styles.contextMenuItem}
                onPress={openRenameModal}
              >
                <Feather name="edit-2" size={16} color={colors.primary} />
                <Text style={styles.contextMenuLabel}>{t('rename')}</Text>
              </Pressable>
              <View style={styles.contextMenuDivider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deleteRecordingLabel')}
                style={styles.contextMenuItem}
                onPress={confirmDeleteRecording}
              >
                <Feather name="trash-2" size={16} color={colors.danger} />
                <Text style={styles.contextMenuDeleteLabel}>{t('delete')}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
      <ScrollView
        style={styles.scrollableTextBox}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t('transcript')}</Text>
          </View>
        </View>
        {selectedRecording.transcribedText ? (
          <Text style={styles.outputText}>
            {selectedRecording.transcribedText}
          </Text>
        ) : (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/document.png')}
              style={styles.emptyIllustration}
              resizeMode="contain"
              accessibilityLabel={t('noTranscriptYet')}
            />
            <Text style={styles.emptyTitle}>{t('noTranscriptYet')}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.miniPlayer}>
        <PlaybackSeekBar
          position={playbackPosition}
          duration={
            playbackDuration || Number(selectedRecording.duration) * 1000
          }
          onSeek={seekToProgress}
          isDark={isDark}
          language={language}
        />
        <View style={styles.playbackControls}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('backFiveSeconds')}
            style={styles.playbackSkipButton}
            onPress={() => seekBySeconds(-5)}
          >
            <Feather name="rotate-ccw" size={32} color={colors.primary} />
            <Text style={[styles.playbackSkipLabel, { color: colors.primary }]}>
              5
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isPlaying ? t('pauseRecording') : t('playRecording')
            }
            style={styles.playerButton}
            onPress={() => void (isPlaying ? onPauseRecord() : onPlayRecord())}
          >
            <Feather
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={colors.inverse}
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('forwardFiveSeconds')}
            style={styles.playbackSkipButton}
            onPress={() => seekBySeconds(5)}
          >
            <Feather name="rotate-cw" size={32} color={colors.primary} />
            <Text style={[styles.playbackSkipLabel, { color: colors.primary }]}>
              5
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        transparent
        visible={isRenameModalVisible}
        animationType="none"
        onShow={animateRenameModalIn}
        onRequestClose={closeRenameModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior="padding"
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.renameModalBackdrop,
              { opacity: renameModalOpacity },
            ]}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.renameModal,
                {
                  opacity: renameModalOpacity,
                  transform: [{ scale: renameModalScale }],
                },
              ]}
            >
              <Text style={styles.recordingName}>
                {t('renameRecordingLabel')}
              </Text>
              <TextInput
                ref={recordingNameInput}
                style={styles.renameInput}
                value={recordingNameDraft}
                onChangeText={setRecordingNameDraft}
                placeholder={t('recordingName')}
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={renameSelectedRecording}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={closeRenameModal}
                >
                  <Text style={styles.modalSecondaryButtonText}>
                    {t('cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.button}
                  onPress={renameSelectedRecording}
                >
                  <Text style={styles.buttonText}>{t('save')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}
