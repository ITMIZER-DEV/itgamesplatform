package br.com.itgames.tv

import org.json.JSONObject

// Espelha o JSON enviado por ws://servidor/ws/leaderboard (itgames-api/src/modules/scoring/types.ts).
// Campos novos ausentes (servidor antigo) caem em padrões: status "active", totalDisplay = totalPoints, unidade "PTS".

data class BoardWod(val title: String, val display: String, val rank: Int, val points: Int, val status: String = "active")

data class BoardRow(
    val rank: Int,
    val team: String,
    val number: String,
    val athletes: List<String>,
    val totalPoints: Int,
    val status: String = "active", // "active" | "cancelled"
    val totalDisplay: String = totalPoints.toString(),
    val wods: List<BoardWod>,
)

data class BoardCategory(val id: Int, val name: String, val wodTitles: List<String>, val rows: List<BoardRow>)

data class Board(val gameName: String, val location: String, val eventType: String, val categories: List<BoardCategory>, val totalUnit: String = "PTS") {
    val isHyrox get() = eventType == "hyrox"

    companion object {
        // Aceita a mensagem inteira ({"type":"board","board":{...}}); devolve null se não for um placar.
        fun parse(message: String): Board? {
            val root = JSONObject(message)
            if (root.optString("type") != "board") return null
            val board = root.getJSONObject("board")
            val game = board.getJSONObject("game")
            val categories = board.getJSONArray("categories")
            return Board(
                gameName = game.getString("name"),
                location = game.optString("location"),
                eventType = game.optString("eventType"),
                totalUnit = game.optString("totalUnit").ifBlank { "PTS" },
                categories = List(categories.length()) { c ->
                    val cat = categories.getJSONObject(c)
                    val titles = cat.getJSONArray("wodTitles")
                    val rows = cat.getJSONArray("rows")
                    BoardCategory(
                        id = cat.getInt("id"),
                        name = cat.getString("name"),
                        wodTitles = List(titles.length()) { titles.getString(it) },
                        rows = List(rows.length()) { r ->
                            val row = rows.getJSONObject(r)
                            val athletes = row.getJSONArray("athletes")
                            val wods = row.getJSONArray("wods")
                            BoardRow(
                                rank = row.getInt("rank"),
                                team = row.getString("team"),
                                number = row.optString("number"),
                                athletes = List(athletes.length()) { athletes.getString(it) },
                                totalPoints = row.getInt("totalPoints"),
                                status = row.optString("status").ifBlank { "active" },
                                totalDisplay = row.optString("totalDisplay").ifBlank { row.getInt("totalPoints").toString() },
                                wods = List(wods.length()) { w ->
                                    val wod = wods.getJSONObject(w)
                                    BoardWod(wod.getString("title"), wod.getString("display"), wod.getInt("rank"), wod.getInt("points"), wod.optString("status").ifBlank { "active" })
                                },
                            )
                        },
                    )
                },
            )
        }
    }
}
