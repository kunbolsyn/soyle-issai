package com.rnwhisperexample

import android.graphics.Color
import android.os.Build
import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class SoyleNavigationBarModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "SoyleNavigationBar"

  @ReactMethod
  fun setNavigationBarColor(color: String, useDarkIcons: Boolean) {
    val parsedColor = runCatching { Color.parseColor(color) }.getOrNull() ?: return
    reactApplicationContext.runOnUiQueueThread {
      currentActivity?.window?.let { window ->
        window.navigationBarColor = parsedColor
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val currentFlags = window.decorView.systemUiVisibility
          window.decorView.systemUiVisibility = if (useDarkIcons) {
            currentFlags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
          } else {
            currentFlags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
          }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          window.isNavigationBarContrastEnforced = false
        }
      }
    }
  }
}

class SoyleNavigationBarPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(SoyleNavigationBarModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}