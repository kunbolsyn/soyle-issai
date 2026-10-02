import Feather from 'react-native-vector-icons/Feather'
import React from 'react'
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native'
import styles from '../styles'
import type { AppScreen } from '../types'

interface SettingsScreenProps {
  navigateTo: (screenName: AppScreen, index?: number | null) => void
}

export default function SettingsScreen({ navigateTo }: SettingsScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to recordings"
          style={styles.circleButtonLeft}
          onPress={() => navigateTo('Home')}
        >
          <Feather name="arrow-left" size={19} color="#173C43" />
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={styles.circleButtonRight} />
      </View>
      <View style={styles.appInfo}>
        <Text style={styles.appInfoDetail}>Kazakh speech recognition</Text>
      </View>
    </SafeAreaView>
  )
}
