package br.com.itgames.tv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.util.concurrent.TimeUnit

data class GameOption(val code: String, val name: String, val location: String)

object Api {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // websocket: sem timeout de leitura, o ping mantém a conexão viva
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    // GET /events — campeonatos liberados (públicos). Lança exceção se o servidor estiver inacessível.
    suspend fun listGames(serverUrl: String): List<GameOption> = withContext(Dispatchers.IO) {
        val url = serverUrl.toHttpUrlOrNull()?.newBuilder()?.addPathSegment("events")?.build()
            ?: throw IllegalArgumentException("Endereço inválido")
        http.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) throw IllegalStateException("Servidor respondeu ${response.code}")
            val array = JSONArray(response.body!!.string())
            List(array.length()) {
                val game = array.getJSONObject(it)
                GameOption(game.getString("code"), game.optString("name"), game.optString("location"))
            }
        }
    }

    // http(s)://host[:porta] -> ws(s)://host[:porta]/ws/leaderboard?game=CODIGO
    fun socketUrl(serverUrl: String, gameCode: String): String? =
        serverUrl.toHttpUrlOrNull()?.newBuilder()
            ?.addPathSegments("ws/leaderboard")
            ?.addQueryParameter("game", gameCode)
            ?.build()
            ?.toString()
            ?.replaceFirst("http", "ws") // "https" vira "wss"

    // http(s)://host[:porta] -> ws(s)://host[:porta]/ws/screen?token=... (o token é codificado na URL)
    fun screenSocketUrl(serverUrl: String, deviceToken: String): String? =
        serverUrl.toHttpUrlOrNull()?.newBuilder()
            ?.addPathSegments("ws/screen")
            ?.addQueryParameter("token", deviceToken)
            ?.build()
            ?.toString()
            ?.replaceFirst("http", "ws")
}
