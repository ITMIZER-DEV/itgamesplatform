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

enum class Link { CONNECTING, ONLINE, OFFLINE }

data class BoardState(val board: Board? = null, val link: Link = Link.CONNECTING, val error: String? = null)

// Mantém o websocket aberto e reconecta sozinho (2s, 4s, 8s... até 30s). O último placar recebido
// continua na tela enquanto a conexão cai, então o telão nunca fica em branco no meio do evento.
class BoardSocket(private val url: String, private val scope: CoroutineScope) {
    private val _state = MutableStateFlow(BoardState())
    val state: StateFlow<BoardState> = _state

    private var job: Job? = null
    private var socket: WebSocket? = null

    fun start() {
        if (job != null) return
        job = scope.launch(Dispatchers.IO) {
            var attempt = 0
            while (isActive) {
                val closed = CompletableDeferred<Unit>()
                _state.value = _state.value.copy(link = if (attempt == 0) Link.CONNECTING else Link.OFFLINE)
                socket = Api.http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        attempt = 0
                        _state.value = _state.value.copy(link = Link.ONLINE, error = null)
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        val board = runCatching { Board.parse(text) }.getOrNull() ?: return
                        _state.value = BoardState(board, Link.ONLINE)
                    }

                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                        webSocket.close(1000, null)
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        // 4404 = campeonato inexistente ou fora do ar; seguimos tentando, pois o organizador pode liberá-lo
                        _state.value = _state.value.copy(
                            link = Link.OFFLINE,
                            error = if (code == 4404) "Campeonato indisponível" else null,
                        )
                        closed.complete(Unit)
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        _state.value = _state.value.copy(link = Link.OFFLINE, error = "Sem conexão com o servidor")
                        closed.complete(Unit)
                    }
                })
                closed.await()
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
