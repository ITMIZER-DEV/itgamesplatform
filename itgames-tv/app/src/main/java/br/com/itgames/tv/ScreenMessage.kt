package br.com.itgames.tv

import org.json.JSONObject

// Espelha o JSON enviado por ws://servidor/ws/screen (itgames-api/src/modules/screens/screen-message.ts).
data class GameRef(val code: String, val name: String)

data class ScreenConfig(
    val id: String,
    val name: String,
    val mode: String,
    val rotateSeconds: Int,
    val frozen: Boolean,
    val frozenAt: String?,
    val overlayText: String?,
    val games: List<GameRef>,
)

data class ScreenState(
    val config: ScreenConfig? = null,
    val boards: List<Board> = emptyList(),
    val link: Link = Link.CONNECTING,
    val error: String? = null,
)

object ScreenMessage {
    // Devolve null se a mensagem não for do tipo "screen". Campos opcionais ausentes ou nulos viram null.
    fun parse(text: String): Pair<ScreenConfig, List<Board>>? {
        val root = JSONObject(text)
        if (root.optString("type") != "screen") return null
        val screen = root.getJSONObject("screen")
        val games = screen.optJSONArray("games")
        val boards = root.optJSONArray("boards")
        val config = ScreenConfig(
            id = screen.getString("id"),
            name = screen.optString("name"),
            mode = screen.optString("mode"),
            rotateSeconds = screen.optInt("rotateSeconds", 15),
            frozen = screen.optBoolean("frozen", false),
            frozenAt = screen.nullableString("frozenAt"),
            overlayText = screen.nullableString("overlayText"),
            games = List(games?.length() ?: 0) {
                val game = games!!.getJSONObject(it)
                GameRef(game.getString("code"), game.optString("name"))
            },
        )
        return config to List(boards?.length() ?: 0) { Board.fromJson(boards!!.getJSONObject(it)) }
    }

    // org.json devolve a string "null" para null explícito em optString: tratamos aqui.
    private fun JSONObject.nullableString(key: String): String? =
        if (isNull(key)) null else optString(key).ifBlank { null }
}
