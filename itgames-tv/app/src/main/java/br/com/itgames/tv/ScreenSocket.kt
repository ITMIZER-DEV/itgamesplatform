package br.com.itgames.tv

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

// Websocket do telão pareado. Reconecta sozinho (2s, 4s... até 30s) e mantém o último estado recebido
// enquanto a conexão cai. Os códigos 4401 (credencial inválida) e 4410 (telão removido) encerram o loop e
// chamam onUnpaired. A URL contém a credencial: nunca é registrada em log nem exibida.
class ScreenSocket(private val url: String, private val scope: CoroutineScope, private val onUnpaired: () -> Unit) {
    private val _state = MutableStateFlow(ScreenState())
    val state: StateFlow<ScreenState> = _state

    private var job: Job? = null
    private var socket: WebSocket? = null

    fun start() {
        if (job != null) return
        job = scope.launch(Dispatchers.IO) {
            var attempt = 0
            while (isActive) {
                val closed = CompletableDeferred<Int>()
                _state.value = _state.value.copy(link = if (attempt == 0) Link.CONNECTING else Link.OFFLINE)
                socket = Api.http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        attempt = 0
                        _state.value = _state.value.copy(link = Link.ONLINE, error = null)
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        val (config, boards) = runCatching { ScreenMessage.parse(text) }.getOrNull() ?: return
                        _state.value = ScreenState(config, boards, Link.ONLINE)
                    }

                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                        webSocket.close(1000, null)
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        _state.value = _state.value.copy(link = Link.OFFLINE)
                        closed.complete(code)
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        _state.value = _state.value.copy(link = Link.OFFLINE, error = "Sem conexão com o servidor")
                        closed.complete(0)
                    }
                })
                val code = closed.await()
                if (code == 4401 || code == 4410) {
                    onUnpaired()
                    return@launch
                }
                attempt++
                delay(minOf(30_000L, 2_000L shl minOf(attempt - 1, 4)))
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
        socket?.cancel()
        socket = null
    }
}
