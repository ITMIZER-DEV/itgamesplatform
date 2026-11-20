package br.com.itgames.tv

import org.json.JSONObject

// Espelha o JSON enviado por ws://servidor/ws/screen (itgames-api/src/modules/screens/screen-message.ts).
data class GameRef(val code: String, val name: String)

data class FrozenCategoryInfo(
    val gameCode: String,
    val categoryId: Int,
    val categoryName: String,
    val overlayText: String,
    val frozenAt: String?,
)

data class HeatCallLane(
    val laneNumber: Int,
    val teamName: String,
    val number: String,
    val athletes: List<String>,
    val rank: Int = 0,
    val totalDisplay: String = "",
)

sealed interface ScreenSpotlight {
    val gameCode: String
    val gameName: String
    val categoryId: Int
    val categoryName: String
    val triggeredAt: String

    data class HeatCall(
        override val gameCode: String,
        override val gameName: String,
        override val categoryId: Int,
        override val categoryName: String,
        val workoutTitle: String,
        val heatNumber: Int,
        val totalHeats: Int,
        val startTime: String,
        val message: String,
        val lanes: List<HeatCallLane>,
        override val triggeredAt: String,
    ) : ScreenSpotlight

    data class Podium(
        override val gameCode: String,
        override val gameName: String,
        override val categoryId: Int,
        override val categoryName: String,
        val revealStep: Int,
        val autoAdvance: Boolean,
        override val triggeredAt: String,
    ) : ScreenSpotlight
}

data class ScreenConfig(
    val id: String,
    val name: String,
    val mode: String,
    val rotateSeconds: Int,
    val frozen: Boolean,
    val frozenAt: String?,
    val overlayText: String?,
    val games: List<GameRef>,
    val frozenCategories: List<FrozenCategoryInfo> = emptyList(),
    val spotlight: ScreenSpotlight? = null,
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
        val frozenCatsJson = screen.optJSONArray("frozenCategories")
        val spotlightJson = if (screen.isNull("spotlight")) null else screen.optJSONObject("spotlight")
        val boards = root.optJSONArray("boards")

        val frozenCategories = List(frozenCatsJson?.length() ?: 0) {
            val fc = frozenCatsJson!!.getJSONObject(it)
            FrozenCategoryInfo(
                gameCode = fc.optString("gameCode"),
                categoryId = fc.optInt("categoryId", 0),
                categoryName = fc.optString("categoryName"),
                overlayText = fc.optString("overlayText").ifBlank { "CATEGORIA EM REVISÃO" },
                frozenAt = fc.nullableString("frozenAt"),
            )
        }

        val spotlight = spotlightJson?.let { parseSpotlight(it) }

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
            frozenCategories = frozenCategories,
            spotlight = spotlight,
        )
        return config to List(boards?.length() ?: 0) { Board.fromJson(boards!!.getJSONObject(it)) }
    }

    private fun parseSpotlight(obj: JSONObject): ScreenSpotlight? {
        val kind = obj.optString("kind")
        val gameCode = obj.optString("gameCode")
        val gameName = obj.optString("gameName")
        val categoryId = obj.optInt("categoryId", 0)
        val categoryName = obj.optString("categoryName")
        val triggeredAt = obj.optString("triggeredAt")

        return when (kind) {
            "heat_call" -> {
                val lanesArr = obj.optJSONArray("lanes")
                val lanes = List(lanesArr?.length() ?: 0) { idx ->
                    val l = lanesArr!!.getJSONObject(idx)
                    val athArr = l.optJSONArray("athletes")
                    HeatCallLane(
                        laneNumber = l.optInt("laneNumber", idx + 1),
                        teamName = l.optString("teamName"),
                        number = l.optString("number"),
                        athletes = List(athArr?.length() ?: 0) { a -> athArr!!.optString(a) },
                        rank = l.optInt("rank", 0),
                        totalDisplay = l.optString("totalDisplay"),
                    )
                }
                ScreenSpotlight.HeatCall(
                    gameCode = gameCode,
                    gameName = gameName,
                    categoryId = categoryId,
                    categoryName = categoryName,
                    workoutTitle = obj.optString("workoutTitle").ifBlank { "WOD 1" },
                    heatNumber = obj.optInt("heatNumber", 1).coerceAtLeast(1),
                    totalHeats = obj.optInt("totalHeats", 1).coerceAtLeast(1),
                    startTime = obj.optString("startTime").ifBlank { "09:00" },
                    message = obj.optString("message").ifBlank { "DIRIJAM-SE ÀS RAIAS DE LARGADA" },
                    lanes = lanes,
                    triggeredAt = triggeredAt,
                )
            }
            "podium" -> {
                ScreenSpotlight.Podium(
                    gameCode = gameCode,
                    gameName = gameName,
                    categoryId = categoryId,
                    categoryName = categoryName,
                    revealStep = obj.optInt("revealStep", 3).coerceIn(1, 3),
                    autoAdvance = obj.optBoolean("autoAdvance", false),
                    triggeredAt = triggeredAt,
                )
            }
            else -> null
        }
    }

    // org.json devolve a string "null" para null explícito em optString: tratamos aqui.
    private fun JSONObject.nullableString(key: String): String? =
        if (isNull(key)) null else optString(key).ifBlank { null }
}
