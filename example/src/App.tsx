import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  NativeModules,
  PanResponder,
  Platform,
  StatusBar,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import RNFS from 'react-native-fs'
import DocumentPicker from 'react-native-document-picker'
import { convertAudioFile, initWhisper } from '../../src'
import type { WhisperContext } from '../../src'
import contextOpts from './context-opts'
import ScreenTransition from './ScreenTransition'
import HomeScreen from './screens/HomeScreen'
import RecordingScreen from './screens/RecordingScreen'
import SettingsScreen from './screens/SettingsScreen'
import { translate } from './i18n'
import { getThemeColors } from './styles'
import type {
  AppLanguage,
  AppearancePreference,
  AppScreen,
  Recording,
} from './types'

const appearancePreferencePath = `${RNFS.DocumentDirectoryPath}/appearance-preference`
const languagePreferencePath = `${RNFS.DocumentDirectoryPath}/language-preference`

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('Home')
  const currentScreenRef = useRef(currentScreen)
  currentScreenRef.current = currentScreen
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedRecordingIndex, setSelectedRecordingIndex] = useState<
    number | null
  >(null)
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null,
  )
  const [isImportingAudio, setIsImportingAudio] = useState(false)
  const [appearance, setAppearance] = useState<AppearancePreference>('system')
  const [isAppearanceLoaded, setIsAppearanceLoaded] = useState(false)
  const [language, setLanguage] = useState<AppLanguage>('en')
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false)
  const themeOpacity = useRef(new Animated.Value(1)).current
  const backSwipeOffset = useRef(new Animated.Value(0)).current
  const backSwipeStartX = useRef(Number.POSITIVE_INFINITY)
  const { width: screenWidth } = useWindowDimensions()
  const systemColorScheme = useColorScheme()
  const isDark =
    appearance === 'dark' ||
    (appearance === 'system' && systemColorScheme === 'dark')
  const themeColors = getThemeColors(isDark)
  const changeAppearance = (nextAppearance: AppearancePreference) => {
    if (nextAppearance === appearance) return
    themeOpacity.stopAnimation()
    Animated.timing(themeOpacity, {
      toValue: 0.92,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return
      setAppearance(nextAppearance)
      Animated.timing(themeOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    })
  }

  useEffect(() => {
    let isMounted = true
    const loadAppearance = async () => {
      try {
        if (await RNFS.exists(appearancePreferencePath)) {
          const savedAppearance = await RNFS.readFile(
            appearancePreferencePath,
            'utf8',
          )
          if (
            savedAppearance === 'light' ||
            savedAppearance === 'dark' ||
            savedAppearance === 'system'
          ) {
            setAppearance(savedAppearance)
          }
        }
      } catch (error) {
        console.warn('Unable to load appearance preference:', error)
      } finally {
        if (isMounted) setIsAppearanceLoaded(true)
      }
    }

    void loadAppearance()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isAppearanceLoaded) return
    void RNFS.writeFile(appearancePreferencePath, appearance, 'utf8').catch(
      (error) => console.warn('Unable to save appearance preference:', error),
    )
  }, [appearance, isAppearanceLoaded])

  useEffect(() => {
    let isMounted = true
    const loadLanguage = async () => {
      try {
        if (await RNFS.exists(languagePreferencePath)) {
          const savedLanguage = await RNFS.readFile(
            languagePreferencePath,
            'utf8',
          )
          if (savedLanguage === 'en' || savedLanguage === 'kk') {
            setLanguage(savedLanguage)
          }
        }
      } catch (error) {
        console.warn('Unable to load language preference:', error)
      } finally {
        if (isMounted) setIsLanguageLoaded(true)
      }
    }

    void loadLanguage()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLanguageLoaded) return
    void RNFS.writeFile(languagePreferencePath, language, 'utf8').catch(
      (error) => console.warn('Unable to save language preference:', error),
    )
  }, [language, isLanguageLoaded])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    NativeModules.SoyleNavigationBar?.setNavigationBarColor(
      themeColors.background,
      !isDark,
    )
  }, [isDark, themeColors.background])

  const navigateTo = (screenName: AppScreen, index: number | null = null) => {
    setCurrentScreen(screenName)
    setSelectedRecordingIndex(index)
  }

  const returnHome = () => {
    setCurrentScreen('Home')
    setSelectedRecordingIndex(null)
  }
  const returnHomeRef = useRef(returnHome)
  returnHomeRef.current = returnHome

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (currentScreen === 'Home') return false
        returnHome()
        return true
      },
    )
    return () => subscription.remove()
  }, [currentScreen])

  const backSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) => {
          backSwipeStartX.current = event.nativeEvent.pageX
          return false
        },
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Platform.OS === 'ios' &&
          currentScreenRef.current !== 'Home' &&
          backSwipeStartX.current <= 28 &&
          gesture.dx > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderMove: (_, gesture) => {
          backSwipeOffset.setValue(Math.max(0, gesture.dx))
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > screenWidth * 0.25 || gesture.vx > 0.7) {
            Animated.timing(backSwipeOffset, {
              toValue: screenWidth,
              duration: 170,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (!finished) return
              backSwipeOffset.setValue(0)
              returnHomeRef.current()
            })
            return
          }

          Animated.timing(backSwipeOffset, {
            toValue: 0,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start()
        },
        onPanResponderTerminate: () => {
          Animated.timing(backSwipeOffset, {
            toValue: 0,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start()
        },
      }),
    [backSwipeOffset, screenWidth],
  )

  const onImportAudio = async () => {
    setIsImportingAudio(true)
    try {
      const selectedFile = await DocumentPicker.pickSingle({
        type: DocumentPicker.types.audio,
        copyTo: 'cachesDirectory',
      })
      if (!selectedFile.fileCopyUri) {
        throw new Error(
          selectedFile.copyError || translate(language, 'couldNotAccessFile'),
        )
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
      const sourceName =
        selectedFile.name || translate(language, 'importedAudio')
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
            : translate(language, 'unableToImportAudio')
        Alert.alert(translate(language, 'audioImportFailed'), message)
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
        filePath: require('../assets/ggml-tiny.en.bin'),
        ...contextOpts,
      })
      console.log('Loaded model, ID:', context.id)
      console.log('Loaded model in', Date.now() - startTime, 'ms')
      setWhisperContext(context)
    }

    void initializeWhisper()
  }, [])

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: themeColors.background,
        opacity: themeOpacity,
        transform: [{ translateX: backSwipeOffset }],
      }}
      {...backSwipeResponder.panHandlers}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
        translucent={false}
      />
      {currentScreen === 'Home' && (
        <ScreenTransition key="Home">
          <HomeScreen
            navigateTo={navigateTo}
            recordings={recordings}
            setRecordings={setRecordings}
            isImportingAudio={isImportingAudio}
            onImportAudio={() => void onImportAudio()}
            isDark={isDark}
            language={language}
          />
        </ScreenTransition>
      )}
      {currentScreen === 'Settings' && (
        <ScreenTransition key="Settings">
          <SettingsScreen
            navigateTo={navigateTo}
            appearance={appearance}
            onAppearanceChange={changeAppearance}
            isDark={isDark}
            language={language}
            onLanguageChange={setLanguage}
          />
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
            isDark={isDark}
            language={language}
          />
        </ScreenTransition>
      )}
    </Animated.View>
  )
}
