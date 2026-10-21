package com.laertkarap.calc

import android.media.AudioAttributes
import android.media.SoundPool
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class ButtonFeedbackPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(ButtonFeedbackModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class ButtonFeedbackModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val pool = SoundPool.Builder().setMaxStreams(1)
    .setAudioAttributes(AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build()
  @Volatile private var loaded = false
  private var stream = 0
  private val sound: Int

  init {
    pool.setOnLoadCompleteListener { _, _, status -> loaded = status == 0 }
    sound = pool.load(context, R.raw.tap_sound, 1)
  }

  override fun getName() = "CalcButtonFeedback"

  @ReactMethod fun play() {
    // Never queue a stale tap while loading, and never overlap/repeat streams.
    if (!loaded) return
    pool.stop(stream)
    stream = pool.play(sound, 1f, 1f, 1, 0, 1f)
  }

  @ReactMethod fun stop() { pool.stop(stream) }

  @ReactMethod fun haptic() {
    val vibrator = reactApplicationContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createOneShot(12, VibrationEffect.DEFAULT_AMPLITUDE))
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(12)
    }
  }

  override fun invalidate() {
    loaded = false
    pool.release()
    super.invalidate()
  }
}
