import Feather from 'react-native-vector-icons/Feather'
import React from 'react'
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native'
import { getStyles, getThemeColors } from '../styles'
import type { AppearancePreference, AppScreen } from '../types'

interface SettingsScreenProps {
  navigateTo: (screenName: AppScreen, index?: number | null) => void
  appearance: AppearancePreference
  onAppearanceChange: (appearance: AppearancePreference) => void
  isDark: boolean
}

const appearanceOptions = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'Auto', icon: 'smartphone' },
] as const

export default function SettingsScreen({
  navigateTo,
  appearance,
  onAppearanceChange,
  isDark,
}: SettingsScreenProps) {
  const styles = getStyles(isDark)
  const colors = getThemeColors(isDark)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to recordings"
          style={[styles.circleButtonLeft, styles.settingsBackButton]}
          onPress={() => navigateTo('Home')}
        >
          <Feather name="arrow-left" size={21} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>Settings</Text>
        <View style={styles.settingsHeaderSpacer} />
      </View>
      <View style={styles.settingsContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>APPEARANCE</Text>
          <View style={styles.appearanceCard}>
            {appearanceOptions.map((option) => {
              const isSelected = appearance === option.value
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${option.label} appearance`}
                  style={[
                    styles.appearanceOption,
                    isSelected && styles.appearanceOptionSelected,
                  ]}
                  onPress={() => onAppearanceChange(option.value)}
                >
                  <Feather
                    name={option.icon}
                    size={16}
                    color={isSelected ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.appearanceOptionText,
                      isSelected && styles.appearanceOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={styles.appearanceDescription}>
            {appearance === 'system'
              ? "Follows your phone's appearance setting."
              : `${appearance === 'dark' ? 'Dark' : 'Light'} appearance is set for this app.`}
          </Text>
        </View>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>ABOUT</Text>
          <View style={styles.appInfo}>
            <View style={styles.appInfoIcon}>
              <Feather name="mic" size={20} color={colors.accent} />
            </View>
            <View style={styles.appInfoCopy}>
              <Text style={styles.appInfoTitle}>Soyle</Text>
              <Text style={styles.appInfoDetail}>
                Kazakh speech recognition
              </Text>
            </View>
            <Text style={styles.appInfoVersion}>v0.0.1</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
