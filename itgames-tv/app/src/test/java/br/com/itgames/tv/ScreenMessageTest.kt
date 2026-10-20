package br.com.itgames.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenMessageTest {
    private fun board(code: String) =
        """{"game":{"code":"$code","name":"Arena $code","location":"SP","eventType":"hyrox"},
            "generatedAt":"2026-10-19T12:00:00Z",
            "categories":[{"id":1,"name":"RX","wodTitles":["Fran"],"rows":[
              {"rank":1,"team":"Alfa","number":"101","athletes":["A","B"],"totalPoints":100,
               "wods":[{"title":"Fran","display":"04:10","rank":1,"points":100}]}]}]}"""

    private val full = """
        {"type":"screen","screen":{"id":"s1","name":"Entrada","mode":"rotate","rotateSeconds":20,
          "frozen":true,"frozenAt":"2026-10-20T10:00:00.000Z","overlayText":"Intervalo",
          "games":[{"code":"G1","name":"Arena G1"},{"code":"G2","name":"Arena G2"}]},
         "boards":[${board("G1")},${board("G2")}]}
    """.trimIndent()

    @Test
    fun parsesFullMessage() {
        val (config, boards) = ScreenMessage.parse(full)!!
        assertEquals("s1", config.id)
        assertEquals("Entrada", config.name)
        assertEquals("rotate", config.mode)
        assertEquals(20, config.rotateSeconds)
        assertTrue(config.frozen)
        assertEquals("2026-10-20T10:00:00.000Z", config.frozenAt)
        assertEquals("Intervalo", config.overlayText)
        assertEquals(listOf(GameRef("G1", "Arena G1"), GameRef("G2", "Arena G2")), config.games)
        assertEquals(2, boards.size)
        assertEquals("Arena G2", boards[1].gameName)
    }

    @Test
    fun missingOrNullOptionalFieldsBecomeNull() {
        val msg = """{"type":"screen","screen":{"id":"s1","name":"X","mode":"single","rotateSeconds":15,
            "frozen":false,"frozenAt":null,"games":[]},"boards":[]}"""
        val (config, boards) = ScreenMessage.parse(msg)!!
        assertNull(config.frozenAt)
        assertNull(config.overlayText)
        assertTrue(boards.isEmpty())
        assertTrue(config.games.isEmpty())
    }

    @Test
    fun explicitNullOverlayIsNotTheStringNull() {
        val msg = """{"type":"screen","screen":{"id":"s1","name":"X","mode":"single","rotateSeconds":15,
            "frozen":false,"frozenAt":null,"overlayText":null,"games":[]},"boards":[]}"""
        assertNull(ScreenMessage.parse(msg)!!.first.overlayText)
    }

    @Test
    fun otherTypeReturnsNull() {
        assertNull(ScreenMessage.parse("""{"type":"board","board":${board("G1")}}"""))
    }
}
