package br.com.itgames.tv.ui

import br.com.itgames.tv.Board
import br.com.itgames.tv.ScreenConfig
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

const val ROWS_PER_PAGE = 6

// Uma "tela" do telão: uma página de uma categoria de um campeonato. Categorias grandes são paginadas.
data class BoardPage(val gameIndex: Int, val categoryIndex: Int, val page: Int, val pages: Int)

// Páginas de todos os campeonatos, na ordem. Categorias e campeonatos sem equipes são pulados; se nenhum tiver
// equipes, devolve só a primeira página (vazia) do primeiro. Sem campeonatos, lista vazia.
fun pagesOf(boards: List<Board>): List<BoardPage> {
    if (boards.isEmpty()) return emptyList()
    val result = boards.flatMapIndexed { gameIndex, board ->
        board.categories.indices.filter { board.categories[it].rows.isNotEmpty() }.flatMap { category ->
            val pages = (board.categories[category].rows.size + ROWS_PER_PAGE - 1) / ROWS_PER_PAGE
            List(pages) { BoardPage(gameIndex, category, it, pages) }
        }
    }
    return result.ifEmpty { listOf(BoardPage(0, 0, 0, 1)) }
}

// Índice da página a exibir após uma atualização: mantém a posição (campeonato, categoria, página) se ainda existir;
// senão limita o índice anterior ao tamanho da nova lista.
fun keepPosition(previous: BoardPage?, pages: List<BoardPage>, fallbackIndex: Int): Int {
    if (pages.isEmpty()) return 0
    if (previous != null) {
        val found = pages.indexOfFirst {
            it.gameIndex == previous.gameIndex && it.categoryIndex == previous.categoryIndex && it.page == previous.page
        }
        if (found >= 0) return found
    }
    return fallbackIndex.coerceIn(0, pages.lastIndex)
}

enum class StatusBadge { PARCIAL, OFICIAL, CONGELADO }

// Congelado vence o modo do telão.
fun statusBadge(config: ScreenConfig?): StatusBadge = when {
    config == null -> StatusBadge.PARCIAL
    config.frozen -> StatusBadge.CONGELADO
    config.mode == "official" -> StatusBadge.OFICIAL
    else -> StatusBadge.PARCIAL
}

private val HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm")

// "HH:mm" do instante de congelamento no fuso informado; null se ausente ou inválido.
fun frozenSince(frozenAt: String?, zone: ZoneId): String? {
    if (frozenAt.isNullOrBlank()) return null
    return runCatching { HOUR_MINUTE.format(Instant.parse(frozenAt).atZone(zone)) }.getOrNull()
}
