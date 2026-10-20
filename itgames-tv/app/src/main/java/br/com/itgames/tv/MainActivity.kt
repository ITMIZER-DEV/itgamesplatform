package br.com.itgames.tv

import android.os.Bundle
import android.view.KeyEvent
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // telão: a TV não pode apagar nem ligar protetor de tela durante o evento
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
                    // Task 6 troca por telas de rotação/congelamento; por ora mostra o primeiro placar da lista.
                    val state = socket.state.collectAsState().value
                    BoardScreen(BoardState(state.boards.firstOrNull(), state.link, state.error))
                }
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
