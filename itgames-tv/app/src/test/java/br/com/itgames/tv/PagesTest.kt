package br.com.itgames.tv

import br.com.itgames.tv.ui.BoardPage
import br.com.itgames.tv.ui.StatusBadge
import br.com.itgames.tv.ui.frozenSince
import br.com.itgames.tv.ui.DEFAULT_OVERLAY_TEXT
import br.com.itgames.tv.ui.keepPosition
import br.com.itgames.tv.ui.overlayTextOrDefault
import br.com.itgames.tv.ui.pagesOf
import br.com.itgames.tv.ui.statusBadge
import java.time.ZoneOffset
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull

class PagesTest {
    private fun row(rank: Int) = BoardRow(rank, "Time $rank", "#$rank", emptyList(), 0, wods = emptyList())
    private fun board(vararg teamsPerCategory: Int) = Board(
        "Jogo", "Local", "crossfit",
        teamsPerCategory.mapIndexed { i, n -> BoardCategory(i, "Cat $i", emptyList(), List(n) { row(it + 1) }) },
    )

    private fun config(mode: String = "partial", frozen: Boolean = false) =
        ScreenConfig("s1", "Telão", mode, 15, frozen, null, null, emptyList())

    @Test fun duasCompeticoesEmOrdem() {
        assertEquals(
            listOf(BoardPage(0, 0, 0, 2), BoardPage(0, 0, 1, 2), BoardPage(1, 0, 0, 1)),
            pagesOf(listOf(board(7), board(3))),
        )
    }

    @Test fun campeonatoSemEquipesEPulado() {
        assertEquals(listOf(BoardPage(1, 0, 0, 1)), pagesOf(listOf(board(0), board(2))))
    }

    @Test fun todosVaziosViraUmaPagina() {
        assertEquals(listOf(BoardPage(0, 0, 0, 1)), pagesOf(listOf(board(0), board(0))))
    }

    @Test fun listaVaziaDeBoards() {
        assertEquals(emptyList<BoardPage>(), pagesOf(emptyList()))
    }

    @Test fun congeladoVenceOModo() {
        assertEquals(StatusBadge.CONGELADO, statusBadge(config("official", frozen = true)))
        assertEquals(StatusBadge.OFICIAL, statusBadge(config("official")))
        assertEquals(StatusBadge.PARCIAL, statusBadge(config("partial")))
        assertEquals(StatusBadge.PARCIAL, statusBadge(null))
    }

    @Test fun horaDoCongelamento() {
        assertEquals("14:32", frozenSince("2026-10-20T14:32:00.000Z", ZoneOffset.UTC))
        assertEquals("11:32", frozenSince("2026-10-20T14:32:00.000Z", ZoneOffset.ofHours(-3)))
        assertNull(frozenSince(null, ZoneOffset.UTC))
        assertNull(frozenSince("lixo", ZoneOffset.UTC))
    }

    @Test fun mantemPosicaoQuandoAPaginaAindaExiste() {
        val pages = pagesOf(listOf(board(7), board(3)))
        assertEquals(1, keepPosition(BoardPage(0, 0, 1, 2), pages, 0))
        assertEquals(2, keepPosition(BoardPage(1, 0, 0, 1), pages, 0))
    }

    @Test fun limitaQuandoAPaginaSumiu() {
        val pages = pagesOf(listOf(board(3)))
        assertEquals(0, keepPosition(BoardPage(0, 0, 1, 2), pages, 5))
        assertEquals(0, keepPosition(null, pages, 9))
        assertEquals(0, keepPosition(null, emptyList(), 3))
    }

    @Test fun avisoEmBrancoCaiNoPadrao() {
        assertEquals(DEFAULT_OVERLAY_TEXT, overlayTextOrDefault(null))
        assertEquals(DEFAULT_OVERLAY_TEXT, overlayTextOrDefault(""))
        assertEquals(DEFAULT_OVERLAY_TEXT, overlayTextOrDefault("   "))
        assertEquals("Intervalo", overlayTextOrDefault("  Intervalo "))
    }
}
