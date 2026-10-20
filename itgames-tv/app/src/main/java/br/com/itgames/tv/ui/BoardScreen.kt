package br.com.itgames.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.itgames.tv.Board
import br.com.itgames.tv.BoardRow
import br.com.itgames.tv.ScreenConfig
import br.com.itgames.tv.ScreenState
import br.com.itgames.tv.Link
import br.com.itgames.tv.R
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.time.ZoneId
import java.util.Date
import java.util.Locale

@Composable
fun BoardScreen(state: ScreenState, modifier: Modifier = Modifier) {
    val config = state.config
    val boards = state.boards
    val pages = remember(boards) { pagesOf(boards) }
    var current by remember { mutableIntStateOf(0) }
    var anchor by remember { mutableStateOf<BoardPage?>(null) }
    var paused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    // atualização ao vivo mantém a página (campeonato, categoria, página) quando ela ainda existe; senão limita
    val safeIndex = keepPosition(anchor, pages, current)

    LaunchedEffect(Unit) { focus.requestFocus() }
    LaunchedEffect(pages) {
        current = safeIndex
        anchor = pages.getOrNull(safeIndex)
    }
    val rotateMs = (config?.rotateSeconds ?: 15).coerceAtLeast(3) * 1000L
    LaunchedEffect(pages.size, paused, safeIndex, rotateMs) {
        if (paused || pages.size <= 1) return@LaunchedEffect
        delay(rotateMs) // reinicia a contagem a cada troca, inclusive as manuais
        val next = (safeIndex + 1) % pages.size
        current = next
        anchor = pages[next]
    }

    // controle remoto: ◀ ▶ trocam de página, OK pausa/retoma a rotação
    fun move(step: Int) {
        if (pages.isEmpty()) return
        val next = (safeIndex + step + pages.size) % pages.size
        current = next
        anchor = pages[next]
    }

    Box(
        modifier
            .fillMaxSize()
            .background(Palette.Background)
            .focusRequester(focus)
            .focusable()
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionLeft -> { move(-1); true }
                    Key.DirectionRight -> { move(1); true }
                    Key.DirectionCenter, Key.Enter -> { paused = !paused; true }
                    else -> false
                }
            },
    ) {
        if (config == null) {
            Waiting(state)
            return@Box
        }
        val badge = statusBadge(config)
        val page = pages.getOrNull(safeIndex)
        val board = page?.let { boards.getOrNull(it.gameIndex) }
        val category = if (page != null && board != null) board.categories.getOrNull(page.categoryIndex) else null

        Column(Modifier.fillMaxSize().padding(horizontal = 32.dp, vertical = 20.dp)) {
            Header(board, boards.size > 1, state.link, category?.name ?: "", page, paused, badge, config)
            Spacer(Modifier.height(14.dp))

            if (board == null) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("Nenhum campeonato disponível", color = Palette.TextMuted, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                }
            } else if (category == null || category.rows.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("Nenhuma equipe inscrita nesta categoria", color = Palette.TextMuted, fontSize = 22.sp)
                }
            } else {
                val rows = category.rows.drop(page.page * ROWS_PER_PAGE).take(ROWS_PER_PAGE)
                // cada linha ocupa uma fração igual da altura, então 6 equipes sempre cabem na tela
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    rows.forEach { ScoreRow(it, category.wodTitles.size, board.totalUnit, Modifier.weight(1f)) }
                    repeat(ROWS_PER_PAGE - rows.size) { Spacer(Modifier.weight(1f)) }
                }
            }

            Footer(state, badge)
        }

        if (badge == StatusBadge.CONGELADO) FrozenOverlay(config.overlayText ?: DEFAULT_OVERLAY_TEXT)
    }
}

private const val DEFAULT_OVERLAY_TEXT = "LEADERBOARD CONGELADO"

// Faixa translúcida grande, legível de longe, sobre o meio do placar (as linhas continuam visíveis acima e abaixo).
@Composable
private fun FrozenOverlay(text: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(Palette.Frozen.copy(alpha = 0.82f))
                .padding(horizontal = 48.dp, vertical = 22.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text,
                color = Color.White,
                fontSize = 56.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun Waiting(state: ScreenState) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(160.dp), contentScale = ContentScale.Fit)
            Spacer(Modifier.height(24.dp))
            Text(
                state.error ?: "Conectando ao servidor…",
                color = if (state.error != null) Palette.Offline else Palette.TextMuted,
                fontSize = 22.sp,
            )
            Spacer(Modifier.height(8.dp))
            Text("Pressione MENU para configurar", color = Palette.TextMuted, fontSize = 16.sp)
        }
    }
}

@Composable
private fun Header(
    board: Board?,
    multiple: Boolean,
    link: Link,
    categoryName: String,
    page: BoardPage?,
    paused: Boolean,
    badge: StatusBadge,
    config: ScreenConfig,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        // logo oficial no lugar do texto; altura fixa preserva o layout (proporção mantida)
        Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(60.dp), contentScale = ContentScale.Fit)
        Spacer(Modifier.width(20.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LiveBadge(link)
                Spacer(Modifier.width(8.dp))
                StatusPill(badge, config)
                Spacer(Modifier.width(12.dp))
                if (board != null) {
                    // com mais de um campeonato, o nome ganha destaque para saber qual placar está na tela
                    Text(
                        listOf(board.gameName, board.location).filter { it.isNotBlank() }.joinToString(" • "),
                        color = if (multiple) Palette.Text else Palette.TextMuted,
                        fontSize = if (multiple) 20.sp else 14.sp,
                        fontWeight = if (multiple) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (board != null) {
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        categoryName.ifBlank { "Geral" },
                        color = Palette.Amber,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(Palette.Amber.copy(alpha = 0.12f))
                            .border(1.dp, Palette.Amber.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                            .padding(horizontal = 16.dp, vertical = 2.dp),
                    )
                    if (page != null && page.pages > 1) {
                        Spacer(Modifier.width(12.dp))
                        Text("${page.page + 1}/${page.pages}", color = Palette.TextMuted, fontSize = 16.sp)
                    }
                    if (paused) {
                        Spacer(Modifier.width(12.dp))
                        Text("ROTAÇÃO PAUSADA", color = Palette.TextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        Clock()
    }
}

// Selo do cabeçalho: PARCIAL (âmbar), OFICIAL (verde) ou CONGELADO (azul, com cadeado e a hora).
@Composable
private fun StatusPill(badge: StatusBadge, config: ScreenConfig) {
    val color = when (badge) {
        StatusBadge.PARCIAL -> Palette.Amber
        StatusBadge.OFICIAL -> Palette.Online
        StatusBadge.CONGELADO -> Palette.Frozen
    }
    val since = if (badge == StatusBadge.CONGELADO) frozenSince(config.frozenAt, ZoneId.systemDefault()) else null
    Row(
        Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.18f))
            .border(1.dp, color.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 12.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (badge == StatusBadge.CONGELADO) {
            LockIcon(color)
            Spacer(Modifier.width(6.dp))
        }
        Text(
            if (since != null) "CONGELADO $since" else badge.name,
            color = color,
            fontSize = 14.sp,
            fontWeight = FontWeight.Black,
        )
    }
}

// Cadeado desenhado com formas (fontes de TV nem sempre têm o emoji).
@Composable
private fun LockIcon(color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(width = 9.dp, height = 7.dp).border(2.dp, color, RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp)))
        Box(Modifier.size(width = 14.dp, height = 9.dp).clip(RoundedCornerShape(2.dp)).background(color))
    }
}

@Composable
private fun LiveBadge(link: Link) {
    val (label, color) = when (link) {
        Link.ONLINE -> "AO VIVO" to Palette.Online
        Link.CONNECTING -> "CONECTANDO" to Palette.TextMuted
        Link.OFFLINE -> "RECONECTANDO" to Palette.Offline
    }
    Row(
        Modifier.clip(CircleShape).background(color.copy(alpha = 0.16f)).padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun Clock() {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = Date()
            delay(1000)
        }
    }
    val format = remember { SimpleDateFormat("HH:mm:ss", Locale("pt", "BR")) }
    Text(format.format(now), color = Palette.Text, fontSize = 30.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
}

@Composable
private fun ScoreRow(row: BoardRow, wodCount: Int, totalUnit: String, modifier: Modifier = Modifier) {
    val (badgeBg, badgeFg, rowBorder) = when (row.rank) {
        1 -> Triple(Palette.Amber, Color.Black, Palette.Amber)
        2 -> Triple(Palette.Silver, Color.Black, Palette.Silver.copy(alpha = 0.5f))
        3 -> Triple(Palette.Bronze, Color.White, Palette.Bronze.copy(alpha = 0.6f))
        else -> Triple(Palette.SurfaceHigh, Palette.TextMuted, Palette.SurfaceHigh)
    }
    val cancelled = row.status == "cancelled"
    val nameColor = if (cancelled) Palette.TextMuted else Palette.Text
    val totalColor = if (cancelled) Palette.TextMuted else Palette.Amber
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .alpha(if (cancelled) 0.55f else 1f)
            .background(if (row.rank == 1 && !cancelled) Palette.Amber.copy(alpha = 0.10f) else Palette.Surface)
            .border(if (row.rank == 1 && !cancelled) 2.dp else 1.dp, if (cancelled) Palette.SurfaceHigh else rowBorder, shape)
            .padding(horizontal = 12.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(badgeBg), contentAlignment = Alignment.Center) {
            Text("${row.rank}º", color = badgeFg, fontSize = 18.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(row.team, color = nameColor, fontSize = 21.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (cancelled) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "CANCELADA",
                        color = Palette.Offline,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Palette.Offline.copy(alpha = 0.16f))
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(row.number, color = Palette.Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            if (row.athletes.isNotEmpty()) {
                Text(row.athletes.joinToString(", "), color = Palette.TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (wodCount > 0) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                row.wods.take(MAX_WOD_CHIPS).forEachIndexed { index, wod ->
                    Column(
                        Modifier
                            .width(WOD_CHIP_WIDTH)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Palette.Background)
                            .border(1.dp, Palette.SurfaceHigh, RoundedCornerShape(8.dp))
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("WOD ${index + 1}", color = Palette.TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        Text(wod.display, color = Palette.Text, fontSize = chipFontSize(wod.display).sp, fontWeight = FontWeight.Black, maxLines = 1, softWrap = false)
                    }
                }
            }
            Spacer(Modifier.width(12.dp))
        }
        Column(
            Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(Color.Black.copy(alpha = 0.6f))
                .border(1.dp, Palette.Amber.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 1.dp),
            horizontalAlignment = Alignment.End,
        ) {
            Text("TOTAL", color = Palette.TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            // PTS e SOMA levam a unidade; TEMPO mostra só o horário. Valores longos (1:02:10) encolhem para caber.
            val text = if (totalUnit == "TEMPO") row.totalDisplay else "${row.totalDisplay} $totalUnit"
            Text(
                text,
                color = totalColor,
                fontSize = if (text.length > 9) 16.sp else if (text.length > 7) 19.sp else 22.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                softWrap = false,
            )
        }
    }
}

// Tamanho (sp) do texto do chip de WOD: valores longos ("CANCELADA", "Sem Score") encolhem para caber nos 80dp sem truncar.
fun chipFontSize(display: String): Int = when {
    display.length <= 8 -> 12
    else -> 9
}

private const val MAX_WOD_CHIPS = 5
private val WOD_CHIP_WIDTH = 80.dp

@Composable
private fun Footer(state: ScreenState, badge: StatusBadge) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("◀ ▶ trocar página   OK pausar/retomar   MENU configurar", color = Palette.TextMuted, fontSize = 12.sp)
        if (state.link == Link.OFFLINE) {
            Text(state.error ?: "Reconectando…", color = Palette.Offline, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        } else if (badge == StatusBadge.PARCIAL) {
            Text("Resultados parciais, sujeitos a homologação", color = Palette.TextMuted, fontSize = 12.sp)
        }
    }
}
