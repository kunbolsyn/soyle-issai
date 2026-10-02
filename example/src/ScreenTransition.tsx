import React, { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

export default function ScreenTransition({
  children,
}: {
  children: React.ReactNode
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const offset = useRef(new Animated.Value(6)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [opacity, offset])

  return (
    <Animated.View
      style={{ flex: 1, opacity, transform: [{ translateY: offset }] }}
    >
      {children}
    </Animated.View>
  )
}
