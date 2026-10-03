import Feather from 'react-native-vector-icons/Feather'
import React from 'react'
import { Image, SafeAreaView, Text, TouchableOpacity, View } from 'react-native'
import { translate } from '../i18n'
import { getStyles, getThemeColors } from '../styles'
import type {
  AppLanguage,
  AppearancePreference,
  AppScreen,
} from '../types'

interface SettingsScreenProps {
  navigateTo: (screenName: AppScreen, index?: number | null) => void
  appearance: AppearancePreference
  onAppearanceChange: (appearance: AppearancePreference) => void
  isDark: boolean
  language: AppLanguage
  onLanguageChange: (language: AppLanguage) => void
}

const appearanceOptions = [
  { value: 'light', icon: 'sun' },
  { value: 'dark', icon: 'moon' },
  { value: 'system', icon: 'smartphone' },
] as const

export default function SettingsScreen({
  navigateTo,
  appearance,
  onAppearanceChange,
  isDark,
  language,
  onLanguageChange,
}: SettingsScreenProps) {
  const styles = getStyles(isDark)
  const colors = getThemeColors(isDark)
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(language, key)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('backToRecordings')}
          style={[styles.circleButtonLeft, styles.settingsBackButton]}
          onPress={() => navigateTo('Home')}
        >
          <Feather name="arrow-left" size={21} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>{t('settings')}</Text>
        <View style={styles.settingsHeaderSpacer} />
      </View>
      <View style={styles.settingsContent}>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>{t('appearance')}</Text>
          <View style={styles.settingsOptionGroup}>
            {appearanceOptions.map((option) => {
              const isSelected = appearance === option.value
              const label = t(option.value === 'system' ? 'auto' : option.value)
              return (
                <React.Fragment key={option.value}>
                  {option.value !== 'light' && (
                    <View style={styles.settingsOptionDivider} />
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={label}
                    style={styles.settingsOptionRow}
                    onPress={() => onAppearanceChange(option.value)}
                  >
                    <View style={styles.settingsOptionIcon}>
                      <Feather
                        name={option.icon}
                        size={18}
                        color={isSelected ? colors.accent : colors.muted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.settingsOptionLabel,
                        isSelected && styles.settingsOptionLabelSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    <View
                      style={[
                        styles.settingsRadio,
                        isSelected && styles.settingsRadioSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.settingsRadioDot} />}
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              )
            })}
          </View>
          <Text style={styles.appearanceDescription}>
            {appearance === 'system'
              ? t('followsSystemAppearance')
              : t(appearance === 'dark' ? 'darkAppearanceSet' : 'lightAppearanceSet')}
          </Text>
        </View>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>{t('language')}</Text>
          <View style={styles.settingsOptionGroup}>
            {(['en', 'kk'] as const).map((option) => {
              const isSelected = language === option
              const label = translate(
                language,
                option === 'en' ? 'english' : 'kazakh',
              )
              return (
                <React.Fragment key={option}>
                  {option === 'kk' && (
                    <View style={styles.settingsOptionDivider} />
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={label}
                    style={styles.settingsOptionRow}
                    onPress={() => onLanguageChange(option)}
                  >
                    <View style={styles.languageCode}>
                      <Text style={styles.languageCodeText}>
                        {option === 'en' ? 'EN' : 'ҚАЗ'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.settingsOptionLabel,
                        isSelected && styles.settingsOptionLabelSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    <View
                      style={[
                        styles.settingsRadio,
                        isSelected && styles.settingsRadioSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.settingsRadioDot} />}
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              )
            })}
          </View>
        </View>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>{t('about')}</Text>
          <View style={styles.appInfo}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.appInfoIcon}
              resizeMode="cover"
              accessibilityLabel="Soyle app logo"
            />
            <View style={styles.appInfoCopy}>
              <Text style={styles.appInfoTitle}>Soyle</Text>
              <Text style={styles.appInfoDetail}>
                {t('kazakhSpeechRecognition')}
              </Text>
            </View>
            <Text style={styles.appInfoVersion}>v0.0.1</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
