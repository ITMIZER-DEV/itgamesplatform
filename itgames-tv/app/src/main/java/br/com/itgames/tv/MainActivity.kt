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
import br.com.itgames.tv.ui.SetupScreen

class MainActivity : ComponentActivity() {
    private var showSetup by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // telão: a TV não pode apagar nem ligar protetor de tela durante o evento
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val prefs = Prefs(this)
        showSetup = prefs.gameCode == null

        setContent {
            ItGamesTheme {
                var server by remember { mutableStateOf(prefs.serverUrl) }
                var game by remember { mutableStateOf(prefs.gameCode) }

                if (showSetup || game == null) {
                    BackHandler(enabled = game != null) { showSetup = false }
                    SetupScreen(
                        initialServer = server,
                        currentGame = game,
                        onDone = { newServer, newGame ->
                            prefs.serverUrl = newServer
                            prefs.gameCode = newGame
                            server = newServer
                            game = newGame
                            showSetup = false
                        },
                        onCancel = if (game != null) ({ showSetup = false }) else null,
                    )
                } else {
                    val scope = rememberCoroutineScope()
                    val socket = remember(server, game) {
                        BoardSocket(Api.socketUrl(server, game!!) ?: "http://invalid/", scope)
                    }
                    DisposableEffect(socket) {
                        socket.start()
                        onDispose { socket.stop() }
                    }
                    BoardScreen(socket.state.collectAsState().value)
                }
            }
        }
    }

    // MENU do controle (Android TV e Fire TV) abre a configuração
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showSetup = true
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
