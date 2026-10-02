import Feather from 'react-native-vector-icons/Feather'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import {
  Alert,
  ActivityIndicator,
  Animated,
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
import styles from '../styles'
import type { AppScreen, Recording } from '../types'

const audioRecorderPlayer = new AudioRecorderPlayer()

interface PlaybackSeekBarProps {
  position: number
  duration: number
  onSeek: (progress: number) => void
}

function formatPlaybackTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function PlaybackSeekBar({ position, duration, onSeek }: PlaybackSeekBarProps) {
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
        accessibilityLabel="Playback position"
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
}

export default function RecordingScreen({
  navigateTo,
  recordings,
  setRecordings,
  selectedRecordingIndex,
  whisperContext,
}: RecordingScreenProps) {
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
  const pendingSeekPosition = useRef<number | null>(null)
  const recordingMenuOpacity = useRef(new Animated.Value(0)).current

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
      const animation = Animated.timing(recordingMenuOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      })
      animation.start()
      return () => animation.stop()
    }

    const animation = Animated.timing(recordingMenuOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished) setIsRecordingMenuMounted(false)
    })
    return () => animation.stop()
  }, [isRecordingMenuVisible, recordingMenuOpacity])

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
        'Transcription failed',
        error instanceof Error ? error.message : 'Unable to transcribe audio.',
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
    setIsRenameModalVisible(false)
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
        'Unable to delete recording',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  const openRenameModal = () => {
    setIsRecordingMenuVisible(false)
    setRecordingNameDraft(selectedRecording.name)
    setIsRenameModalVisible(true)
  }

  const confirmDeleteRecording = () => {
    setIsRecordingMenuVisible(false)
    Alert.alert(
      'Delete recording?',
      'This will permanently delete the recording.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
          accessibilityLabel="Dismiss recording options"
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
          accessibilityLabel="Back to recordings"
          style={styles.circleButtonLeft}
          onPress={() => navigateTo('Home', null)}
        >
          <Feather name="arrow-left" size={19} color="#173C43" />
        </TouchableOpacity>
        <Text style={styles.recordingDetailTitle} numberOfLines={1}>
          {selectedRecording.name}
        </Text>
        <View style={styles.topActions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Transcribe recording"
            disabled={!whisperContext || !!stopTranscribe}
            style={styles.circleButtonRight}
            onPress={() => void startTranscription()}
          >
            {stopTranscribe ? (
              <ActivityIndicator color="#173C43" />
            ) : (
              <Feather name="file-text" size={18} color="#173C43" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Recording options"
            style={styles.circleButtonRight}
            onPress={() => setIsRecordingMenuVisible((visible) => !visible)}
          >
            <Feather name="more-horizontal" size={19} color="#173C43" />
          </TouchableOpacity>
          {isRecordingMenuMounted && (
            <Animated.View
              style={[
                styles.recordingContextMenu,
                { opacity: recordingMenuOpacity },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rename recording"
                style={styles.contextMenuItem}
                onPress={openRenameModal}
              >
                <Feather name="edit-2" size={16} color="#173C43" />
                <Text style={styles.contextMenuLabel}>Rename</Text>
              </Pressable>
              <View style={styles.contextMenuDivider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete recording"
                style={styles.contextMenuItem}
                onPress={confirmDeleteRecording}
              >
                <Feather name="trash-2" size={16} color="#B43F45" />
                <Text style={styles.contextMenuDeleteLabel}>Delete</Text>
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
            <Text style={styles.eyebrow}>TRANSCRIPT</Text>
          </View>
        </View>
        {selectedRecording.transcribedText ? (
          <Text style={styles.outputText}>
            {selectedRecording.transcribedText}
          </Text>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="file-text" size={23} color="#32877F" />
            </View>
            <Text style={styles.emptyTitle}>No transcript yet</Text>
            <Text style={styles.emptyDescription}>
              Transcribe this recording to see the words here.
            </Text>
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
        />
        <View style={styles.playbackControls}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back 5 seconds"
            style={styles.playbackSkipButton}
            onPress={() => seekBySeconds(-5)}
          >
            <Feather name="rotate-ccw" size={32} color="#173C43" />
            <Text style={styles.playbackSkipLabel}>5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isPlaying ? 'Pause recording' : 'Play recording'
            }
            style={styles.playerButton}
            onPress={() => void (isPlaying ? onPauseRecord() : onPlayRecord())}
          >
            <Feather
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Forward 5 seconds"
            style={styles.playbackSkipButton}
            onPress={() => seekBySeconds(5)}
          >
            <Feather name="rotate-cw" size={32} color="#173C43" />
            <Text style={styles.playbackSkipLabel}>5</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        transparent
        visible={isRenameModalVisible}
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.renameModal}>
            <Text style={styles.recordingName}>Rename recording</Text>
            <TextInput
              autoFocus
              style={styles.renameInput}
              value={recordingNameDraft}
              onChangeText={setRecordingNameDraft}
              placeholder="Recording name"
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={renameSelectedRecording}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setIsRenameModalVisible(false)}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={renameSelectedRecording}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
