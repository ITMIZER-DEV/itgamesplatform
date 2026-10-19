package br.com.itgames.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BoardTest {
    private val message = """
        {"type":"board","board":{
          "game":{"code":"G1","name":"Arena","location":"SP","eventType":"hyrox"},
          "generatedAt":"2026-10-19T12:00:00Z",
          "categories":[{"id":1,"name":"RX","wodTitles":["Fran"],"rows":[
            {"rank":1,"team":"Alfa","number":"101","athletes":["A","B"],"totalPoints":100,
             "wods":[{"title":"Fran","display":"04:10","rank":1,"points":100}]}
          ]}]}}
    """.trimIndent()

    private val newMessage = """
        {"type":"board","board":{
          "game":{"code":"G1","name":"Arena","location":"SP","eventType":"hyrox",
                  "rule":{"mode":"total_time","tiebreak":"none"},"totalUnit":"TEMPO"},
          "generatedAt":"2026-10-19T12:00:00Z",
          "categories":[{"id":1,"name":"RX","wodTitles":["Fran"],"rows":[
            {"rank":1,"teamCode":"T1","team":"Alfa","number":"101","athletes":["A","B"],"status":"cancelled",
             "totalPoints":0,"totalDisplay":"60:10",
             "wods":[{"title":"Fran","display":"CANCELADA","rank":0,"points":0,"status":"cancelled"}]}
          ]}]}}
    """.trimIndent()

    @Test
    fun parsesBoardMessage() {
        val board = Board.parse(message)!!
        assertEquals("Arena", board.gameName)
        assertTrue(board.isHyrox)
        val row = board.categories.single().rows.single()
        assertEquals("Alfa", row.team)
        assertEquals(listOf("A", "B"), row.athletes)
        assertEquals("04:10", row.wods.single().display)
    }

    @Test
    fun parsesNewFields() {
        val board = Board.parse(newMessage)!!
        assertEquals("TEMPO", board.totalUnit)
        val row = board.categories.single().rows.single()
        assertEquals("cancelled", row.status)
        assertEquals("60:10", row.totalDisplay)
        assertEquals("cancelled", row.wods.single().status)
        assertEquals("CANCELADA", row.wods.single().display)
    }

    @Test
    fun parsesLegacyMessageWithoutNewFields() {
        val board = Board.parse(message)!!
        assertEquals("PTS", board.totalUnit)
        val row = board.categories.single().rows.single()
        assertEquals("active", row.status)
        assertEquals("100", row.totalDisplay)
        assertEquals("active", row.wods.single().status)
    }

    @Test
    fun ignoresOtherMessageTypes() {
        assertNull(Board.parse("""{"type":"pong"}"""))
    }

    @Test
    fun buildsSocketUrlFromServerAddress() {
        assertEquals("ws://10.0.0.5:3333/ws/leaderboard?game=G1", Api.socketUrl("http://10.0.0.5:3333", "G1"))
        assertEquals("wss://api.exemplo.com/ws/leaderboard?game=G%201", Api.socketUrl("https://api.exemplo.com", "G 1"))
    }
}
