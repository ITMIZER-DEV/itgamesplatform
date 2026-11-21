package br.com.itgames.tv

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import br.com.itgames.tv.ui.BoardScreen
import br.com.itgames.tv.ui.ItGamesTheme
import br.com.itgames.tv.ui.PairingScreen
import br.com.itgames.tv.ui.SetupScreen

class MainActivity : ComponentActivity() {
    private var showSetup by mutableStateOf(false)
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Telão / Fire TV Stick: impede desligamento da tela, protetor de tela e suspensão
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val prefs = Prefs(this)

        setContent {
            ItGamesTheme {
                var server by remember { mutableStateOf(prefs.serverUrl) }
                var token by remember { mutableStateOf(prefs.deviceToken) }
                val unpair = {
                    prefs.deviceToken = null
                    token = null
                    showSetup = false
                }

                val currentToken = token
                if (showSetup) {
                    BackHandler { showSetup = false }
                    SetupScreen(
                        initialServer = server,
                        paired = currentToken != null,
                        onSave = { newServer ->
                            prefs.serverUrl = newServer
                            server = prefs.serverUrl
                            showSetup = false
                        },
                        onUnpair = unpair,
                        onCancel = { showSetup = false },
                    )
                } else if (currentToken == null) {
                    PairingScreen(
                        server = server,
                        onOpenSetup = { showSetup = true },
                        onPaired = { newToken ->
                            prefs.deviceToken = newToken
                            token = newToken
                        },
                    )
                } else {
                    val scope = rememberCoroutineScope()
                    val socket = remember(server, currentToken) {
                        ScreenSocket(Api.screenSocketUrl(server, currentToken) ?: "http://invalid/", scope, onUnpaired = unpair)
                    }
                    DisposableEffect(socket) {
                        socket.start()
                        onDispose { socket.stop() }
                    }
                    BoardScreen(
                        state = socket.state.collectAsState().value,
                        onOpenSetup = { showSetup = true },
                    )
                }
            }
        }
        window.decorView.post { applyImmersiveFullscreen() }
    }

    override fun onResume() {
        super.onResume()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        applyImmersiveFullscreen()
        acquireLocks()
    }

    override fun onPause() {
        releaseLocks()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveFullscreen()
    }

    @Suppress("DEPRECATION")
    private fun acquireLocks() {
        runCatching {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE,
                    "ITGamesTv::ArenaDisplayWakeLock",
                ).apply { setReferenceCounted(false) }
            }
            if (wakeLock?.isHeld == false) wakeLock?.acquire()
        }
        runCatching {
            if (wifiLock == null) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    @Suppress("DEPRECATION")
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wm.createWifiLock(mode, "ITGamesTv::ArenaWifiLock").apply {
                    setReferenceCounted(false)
                }
            }
            if (wifiLock?.isHeld == false) wifiLock?.acquire()
        }
    }

    private fun releaseLocks() {
        runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        runCatching { if (wifiLock?.isHeld == true) wifiLock?.release() }
    }

    @Suppress("DEPRECATION")
    private fun applyImmersiveFullscreen() {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.decorView.let {
                    window.insetsController?.let { controller ->
                        controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                        controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    }
                }
            } else {
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    )
            }
        }
    }

    // MENU do controle (Android TV e Fire TV) abre a tela do servidor
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showSetup = true
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
