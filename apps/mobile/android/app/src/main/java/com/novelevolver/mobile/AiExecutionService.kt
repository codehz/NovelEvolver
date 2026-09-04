package com.novelevolver.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class AiExecutionService : Service() {

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
          NOTIFICATION_ID,
          notification(),
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification())
    }
    acquireWakeLock()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val powerManager = getSystemService(PowerManager::class.java)
    wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
      setReferenceCounted(false)
      acquire(WAKE_LOCK_TIMEOUT_MS)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let {
      if (it.isHeld) it.release()
    }
    wakeLock = null
  }

  private fun notification(): Notification =
      Notification.Builder(this, CHANNEL_ID)
          .setSmallIcon(android.R.drawable.stat_sys_download)
          .setContentTitle(getString(R.string.app_name))
          .setContentText("AI 正在生成内容")
          .setOngoing(true)
          .setCategory(Notification.CATEGORY_PROGRESS)
          .setPriority(Notification.PRIORITY_LOW)
          .build()

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "AI 请求", NotificationManager.IMPORTANCE_LOW),
    )
  }

  companion object {
    private const val ACTION_STOP = "com.novelevolver.mobile.action.STOP_AI_EXECUTION"
    private const val CHANNEL_ID = "ai-execution"
    private const val NOTIFICATION_ID = 4201
    private const val WAKE_LOCK_TAG = "NovelEvolver:AiExecution"
    private const val WAKE_LOCK_TIMEOUT_MS = 30L * 60L * 1000L

    fun start(context: Context) {
      val intent = Intent(context, AiExecutionService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, AiExecutionService::class.java).apply {
        action = ACTION_STOP
      })
    }
  }
}
