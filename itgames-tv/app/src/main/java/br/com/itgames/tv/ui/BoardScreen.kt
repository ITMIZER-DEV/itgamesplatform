package br.com.itgames.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
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
import br.com.itgames.tv.ScreenSpotlight
import br.com.itgames.tv.ScreenState
import br.com.itgames.tv.Link
import br.com.itgames.tv.R
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.time.ZoneId
import java.util.Date
import java.util.Locale

@Composable
fun BoardScreen(state: ScreenState, modifier: Modifier = Modifier, onOpenSetup: (() -> Unit)? = null) {
    val config = state.config
    val boards = state.boards
    val pages = remember(boards) { pagesOf(boards) }
    var current by remember { mutableIntStateOf(0) }
    var anchor by remember { mutableStateOf<BoardPage?>(null) }
    var paused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }

    // Modo interativo local na TV (barra de comando acionada com ▲ no controle do Firestick)
    var showToolbar by remember { mutableStateOf(false) }
    var toolbarIndex by remember { mutableIntStateOf(0) }
    var localMode by remember { mutableStateOf(TvArenaMode.BOARD) }
    var localHeatIndex by remember { mutableIntStateOf(0) }
    var readyConfirmed by remember { mutableStateOf(false) }
    var localPodiumStep by remember { mutableIntStateOf(1) }
    var localFrozenCategoryIds by remember { mutableStateOf(setOf<Int>()) }
    var dismissedRemoteTrigger by remember { mutableStateOf<String?>(null) }

    // Quando chega um novo spotlight do servidor (painel web), exibe-o imediatamente
    val remoteSpotlight = config?.spotlight?.takeIf { it.triggeredAt != dismissedRemoteTrigger }
    val activeMode = when {
        remoteSpotlight is ScreenSpotlight.HeatCall -> TvArenaMode.HEAT_CALL
        remoteSpotlight is ScreenSpotlight.Podium -> TvArenaMode.PODIUM
        else -> localMode
    }

    LaunchedEffect(remoteSpotlight?.triggeredAt) {
        if (remoteSpotlight != null) {
            readyConfirmed = false
            if (remoteSpotlight is ScreenSpotlight.Podium) {
                localPodiumStep = remoteSpotlight.revealStep
            }
        }
    }

    // Auto-advance no Pódio quando configurado com suspense automático
    LaunchedEffect(remoteSpotlight, localPodiumStep) {
        val podium = remoteSpotlight as? ScreenSpotlight.Podium
        if (podium != null && podium.autoAdvance && localPodiumStep < 3) {
            delay(5000L)
            localPodiumStep = (localPodiumStep + 1).coerceAtMost(3)
        }
    }

    val safeIndex = keepPosition(anchor, pages, current)

    LaunchedEffect(Unit) { focus.requestFocus() }
    LaunchedEffect(pages) {
        current = safeIndex
        anchor = pages.getOrNull(safeIndex)
    }
    val rotateMs = (config?.rotateSeconds ?: 15).coerceAtLeast(3) * 1000L
    val latestPages by rememberUpdatedState(pages)
    LaunchedEffect(pages.size, paused, safeIndex, rotateMs, activeMode, showToolbar) {
        if (paused || pages.size <= 1 || activeMode != TvArenaMode.BOARD || showToolbar) return@LaunchedEffect
        delay(rotateMs)
        val atual = latestPages
        if (atual.isEmpty()) return@LaunchedEffect
        val next = (safeIndex + 1) % atual.size
        current = next
        anchor = atual[next]
    }

    fun move(step: Int) {
        if (pages.isEmpty()) return
        val next = (safeIndex + step + pages.size) % pages.size
        current = next
        anchor = pages[next]
        localHeatIndex = 0
        readyConfirmed = false
    }

    val page = pages.getOrNull(safeIndex)
    val board = page?.let { boards.getOrNull(it.gameIndex) }
    val category = if (page != null && board != null) board.categories.getOrNull(page.categoryIndex) else null

    val categoryFrozenMeta = config?.frozenCategories?.firstOrNull {
        it.categoryId == category?.id && (it.gameCode.isBlank() || board?.gameCode.isNullOrBlank() || it.gameCode == board?.gameCode)
    }
    val isCurrentCatFrozen =
        config?.frozen == true ||
            category?.frozen == true ||
            categoryFrozenMeta != null ||
            (category != null && localFrozenCategoryIds.contains(category.id))

    Box(
        modifier
            .fillMaxSize()
            .background(Palette.Background)
            .focusRequester(focus)
            .focusable()
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false

                // 1. Navegação quando a Barra de Comando da Arena está aberta
                if (showToolbar) {
                    when (event.key) {
                        Key.DirectionLeft -> {
                            toolbarIndex = (toolbarIndex + 3) % 4
                            return@onKeyEvent true
                        }
                        Key.DirectionRight -> {
                            toolbarIndex = (toolbarIndex + 1) % 4
                            return@onKeyEvent true
                        }
                        Key.DirectionDown, Key.Back, Key.Escape -> {
                            showToolbar = false
                            return@onKeyEvent true
                        }
                        Key.DirectionCenter, Key.Enter -> {
                            when (toolbarIndex) {
                                0 -> {
                                    dismissedRemoteTrigger = config?.spotlight?.triggeredAt
                                    localMode = TvArenaMode.BOARD
                                    showToolbar = false
                                }
                                1 -> {
                                    dismissedRemoteTrigger = config?.spotlight?.triggeredAt
                                    localMode = TvArenaMode.HEAT_CALL
                                    localHeatIndex = 0
                                    readyConfirmed = false
                                    showToolbar = false
                                }
                                2 -> {
                                    dismissedRemoteTrigger = config?.spotlight?.triggeredAt
                                    localMode = TvArenaMode.PODIUM
                                    localPodiumStep = 1
                                    showToolbar = false
                                }
                                3 -> {
                                    val catId = category?.id
                                    if (catId != null) {
                                        localFrozenCategoryIds = if (localFrozenCategoryIds.contains(catId)) {
                                            localFrozenCategoryIds - catId
                                        } else {
                                            localFrozenCategoryIds + catId
                                        }
                                    }
                                    showToolbar = false
                                }
                            }
                            return@onKeyEvent true
                        }
                        else -> return@onKeyEvent false
                    }
                }

                // 2. Navegação nos modos especiais (Chamada de Raias ou Pódio) ou Placar
                when (event.key) {
                    Key.DirectionUp -> {
                        showToolbar = true
                        return@onKeyEvent true
                    }
                    Key.Back, Key.Escape -> {
                        if (activeMode != TvArenaMode.BOARD) {
                            dismissedRemoteTrigger = config?.spotlight?.triggeredAt
                            localMode = TvArenaMode.BOARD
                            return@onKeyEvent true
                        }
                        false
                    }
                    Key.DirectionLeft -> {
                        if (activeMode == TvArenaMode.HEAT_CALL && remoteSpotlight == null) {
                            if (localHeatIndex > 0) localHeatIndex-- else move(-1)
                            readyConfirmed = false
                        } else {
                            move(-1)
                            if (activeMode == TvArenaMode.PODIUM && remoteSpotlight == null) localPodiumStep = 1
                        }
                        true
                    }
                    Key.DirectionRight -> {
                        if (activeMode == TvArenaMode.HEAT_CALL && remoteSpotlight == null) {
                            val totalHeats = ((category?.rows?.count { it.status != "cancelled" } ?: 1) + 5) / 6
                            if (localHeatIndex + 1 < totalHeats) localHeatIndex++ else move(1)
                            readyConfirmed = false
                        } else {
                            move(1)
                            if (activeMode == TvArenaMode.PODIUM && remoteSpotlight == null) localPodiumStep = 1
                        }
                        true
                    }
                    Key.DirectionCenter, Key.Enter -> {
                        when (activeMode) {
                            TvArenaMode.HEAT_CALL -> readyConfirmed = !readyConfirmed
                            TvArenaMode.PODIUM -> localPodiumStep = if (localPodiumStep < 3) localPodiumStep + 1 else 1
                            TvArenaMode.BOARD -> paused = !paused
                        }
                        true
                    }
                    else -> false
                }
            },
    ) {
        if (config == null) {
            Waiting(state, onOpenSetup = onOpenSetup)
            return@Box
        }

        // Exibição 1: CHAMADA DE ATLETAS PARA AS RAIAS
        if (activeMode == TvArenaMode.HEAT_CALL) {
            val heatData = (remoteSpotlight as? ScreenSpotlight.HeatCall)
                ?: buildLocalHeatCall(board, category, localHeatIndex)
            if (heatData != null) {
                HeatCallOverlayScreen(heatCall = heatData, readyConfirmed = readyConfirmed)
            }
            if (showToolbar) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 12.dp)) {
                    ArenaActionToolbar(activeMode, toolbarIndex, isCurrentCatFrozen, category?.name ?: "Categoria")
                }
            }
            return@Box
        }

        // Exibição 2: CERIMÔNIA DE PÓDIO — ANÚNCIO DOS VENCEDORES
        if (activeMode == TvArenaMode.PODIUM) {
            val remotePodium = remoteSpotlight as? ScreenSpotlight.Podium
            val podiumBoard = if (remotePodium != null) {
                boards.firstOrNull { it.gameCode == remotePodium.gameCode || it.gameName == remotePodium.gameName } ?: board
            } else {
                board
            }
            val podiumCat = if (remotePodium != null && podiumBoard != null) {
                podiumBoard.categories.firstOrNull { it.id == remotePodium.categoryId || it.name == remotePodium.categoryName } ?: category
            } else {
                category
            }
            PodiumCeremonyScreen(
                gameName = podiumBoard?.gameName ?: remotePodium?.gameName ?: "",
                category = podiumCat,
                totalUnit = podiumBoard?.totalUnit ?: "PTS",
                revealStep = localPodiumStep,
            )
            if (showToolbar) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 12.dp)) {
                    ArenaActionToolbar(activeMode, toolbarIndex, isCurrentCatFrozen, podiumCat?.name ?: "Categoria")
                }
            }
            return@Box
        }

        // Exibição 3: PLACAR AO VIVO (COM SUPORTE A CONGELAMENTO POR CATEGORIA OU TODAS)
        val baseBadge = statusBadge(config)
        val badge = if (isCurrentCatFrozen) StatusBadge.CONGELADO else baseBadge
        val isFrozen = badge == StatusBadge.CONGELADO
        val effectiveOverlayText = when {
            !category?.overlayText.isNullOrBlank() -> category!!.overlayText
            categoryFrozenMeta != null -> categoryFrozenMeta.overlayText
            category != null && localFrozenCategoryIds.contains(category.id) -> "CATEGORIA EM REVISÃO"
            else -> config.overlayText
        }
        val effectiveFrozenAt = when {
            !category?.frozenAt.isNullOrBlank() -> category!!.frozenAt
            categoryFrozenMeta?.frozenAt != null -> categoryFrozenMeta.frozenAt
            else -> config.frozenAt
        }

        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp, vertical = 16.dp)
                .then(if (isFrozen) Modifier.blur(18.dp).alpha(0.35f) else Modifier),
        ) {
            if (showToolbar) {
                ArenaActionToolbar(activeMode, toolbarIndex, isCurrentCatFrozen, category?.name ?: "Categoria")
                Spacer(Modifier.height(8.dp))
            }
            Header(
                board = board,
                multiple = boards.size > 1,
                link = state.link,
                categoryName = category?.name ?: "",
                page = page,
                paused = paused,
                badge = badge,
                frozenAtIso = effectiveFrozenAt,
                showBadge = boards.isNotEmpty() || badge != StatusBadge.PARCIAL,
            )
            Spacer(Modifier.height(12.dp))

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
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    rows.forEach { ScoreRow(it, category.wodTitles.size, board.totalUnit, hideScores = isFrozen, Modifier.weight(1f)) }
                    repeat(ROWS_PER_PAGE - rows.size) { Spacer(Modifier.weight(1f)) }
                }
            }

            Footer(
                state = state,
                partialNotice = badge == StatusBadge.PARCIAL && boards.isNotEmpty(),
                frozenCategoriesCount = config.frozenCategories.size + localFrozenCategoryIds.size,
            )
        }

        if (isFrozen) {
            FrozenOverlay(
                text = overlayTextOrDefault(effectiveOverlayText),
                gameName = board?.gameName,
                categoryName = category?.name,
                isSingleCategoryFreeze = !config.frozen,
            )
            if (showToolbar) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 12.dp)) {
                    ArenaActionToolbar(activeMode, toolbarIndex, isCurrentCatFrozen, category?.name ?: "Categoria")
                }
            }
        }
    }
}

// Overlay em tela cheia com backdrop escuro, exibindo a logo, o nome do campeonato, a categoria e a mensagem de bloqueio.
@Composable
private fun FrozenOverlay(
    text: String,
    gameName: String?,
    categoryName: String?,
    isSingleCategoryFreeze: Boolean = false,
) {
    val titleSize = when {
        text.length > 34 -> 26.sp
        text.length > 22 -> 32.sp
        else -> 40.sp
    }
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.78f))
            .padding(horizontal = 48.dp, vertical = 28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .fillMaxWidth(0.88f)
                .clip(RoundedCornerShape(24.dp))
                .background(Palette.Surface.copy(alpha = 0.96f))
                .border(2.dp, Palette.Frozen.copy(alpha = 0.85f), RoundedCornerShape(24.dp))
                .padding(horizontal = 40.dp, vertical = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Image(
                    painterResource(R.drawable.logo_itgames),
                    contentDescription = "ITMIZER ITGames",
                    modifier = Modifier.height(48.dp),
                    contentScale = ContentScale.Fit,
                )
                Text(
                    "ITMIZER",
                    color = Palette.TextMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Palette.SurfaceHigh)
                        .border(1.dp, Palette.Border, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }

            if (!gameName.isNullOrBlank()) {
                Text(
                    gameName,
                    color = Palette.Amber,
                    fontSize = 22.sp,
                    lineHeight = 26.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (!categoryName.isNullOrBlank()) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Palette.Amber.copy(alpha = 0.14f))
                        .border(1.dp, Palette.Amber.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                ) {
                    Text(
                        if (isSingleCategoryFreeze) "CATEGORIA: $categoryName" else categoryName,
                        color = Palette.Amber,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Palette.Frozen.copy(alpha = 0.92f))
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(width = 18.dp, height = 13.dp).border(3.5.dp, Color.White, RoundedCornerShape(topStart = 9.dp, topEnd = 9.dp)))
                        Box(Modifier.size(width = 28.dp, height = 18.dp).clip(RoundedCornerShape(4.dp)).background(Color.White))
                    }
                    Text(
                        text,
                        color = Color.White,
                        fontSize = titleSize,
                        lineHeight = titleSize * 1.22f,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Text(
                if (isSingleCategoryFreeze) "Esta categoria está em revisão pela mesa técnica • Demais categorias seguem ao vivo"
                else "Aguarde a liberação oficial da mesa técnica",
                color = Palette.TextMuted,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun Waiting(state: ScreenState, onOpenSetup: (() -> Unit)? = null) {
    Box(
        Modifier
            .fillMaxSize()
            .clickable { onOpenSetup?.invoke() },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(160.dp), contentScale = ContentScale.Fit)
            Spacer(Modifier.height(24.dp))
            Text(
                state.error ?: "Conectando ao servidor…",
                color = if (state.error != null) Palette.Offline else Palette.TextMuted,
                fontSize = 22.sp,
            )
            Spacer(Modifier.height(8.dp))
            Text("Pressione MENU ou clique aqui para configurar", color = Palette.TextMuted, fontSize = 16.sp)
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
    frozenAtIso: String?,
    showBadge: Boolean,
) {
    val isFrozen = badge == StatusBadge.CONGELADO
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(60.dp), contentScale = ContentScale.Fit)
        Spacer(Modifier.width(20.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (LiveBadge(link, isFrozen)) Spacer(Modifier.width(8.dp))
                if (showBadge) {
                    StatusPill(badge, frozenAtIso)
                    Spacer(Modifier.width(12.dp))
                }
                if (board != null) {
                    Text(
                        board.gameName,
                        color = Palette.Text,
                        fontSize = if (multiple) 19.sp else 17.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
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

@Composable
private fun StatusPill(badge: StatusBadge, frozenAtIso: String?) {
    val color = when (badge) {
        StatusBadge.PARCIAL -> Palette.Amber
        StatusBadge.OFICIAL -> Palette.Online
        StatusBadge.CONGELADO -> Palette.Frozen
    }
    val since = if (badge == StatusBadge.CONGELADO) frozenSince(frozenAtIso, ZoneId.systemDefault()) else null
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

@Composable
private fun LockIcon(color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(width = 9.dp, height = 7.dp).border(2.dp, color, RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp)))
        Box(Modifier.size(width = 14.dp, height = 9.dp).clip(RoundedCornerShape(2.dp)).background(color))
    }
}

@Composable
private fun LiveBadge(link: Link, frozen: Boolean): Boolean {
    if (link == Link.ONLINE && frozen) return false
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
    return true
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
private fun ScoreRow(row: BoardRow, wodCount: Int, totalUnit: String, hideScores: Boolean = false, modifier: Modifier = Modifier) {
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
            .padding(horizontal = 12.dp, vertical = 6.dp),
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
            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                modifier = if (hideScores) Modifier.blur(12.dp).alpha(0.18f) else Modifier,
            ) {
                row.wods.take(MAX_WOD_CHIPS).forEachIndexed { index, wod ->
                    Column(
                        Modifier
                            .width(WOD_CHIP_WIDTH)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Palette.Background)
                            .border(1.dp, Palette.SurfaceHigh, RoundedCornerShape(8.dp))
                            .padding(horizontal = 4.dp, vertical = 3.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text("WOD ${index + 1}", color = Palette.TextMuted, fontSize = 9.sp, lineHeight = 10.sp, fontWeight = FontWeight.Bold)
                        Text(
                            if (hideScores) "•••" else wod.display,
                            color = Palette.Text,
                            fontSize = chipFontSize(wod.display).sp,
                            lineHeight = 14.sp,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                            softWrap = false,
                        )
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
                .padding(horizontal = 14.dp, vertical = 4.dp)
                .then(if (hideScores) Modifier.blur(12.dp).alpha(0.18f) else Modifier),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("TOTAL", color = Palette.TextMuted, fontSize = 9.sp, lineHeight = 10.sp, fontWeight = FontWeight.Bold)
            val text = if (hideScores) "•••" else if (totalUnit == "TEMPO") row.totalDisplay else "${row.totalDisplay} $totalUnit"
            Text(
                text,
                color = totalColor,
                fontSize = if (text.length > 9) 14.sp else if (text.length > 7) 16.sp else 18.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                softWrap = false,
            )
        }
    }
}

fun chipFontSize(display: String): Int = when {
    display.length <= 8 -> 12
    else -> 9
}

private const val MAX_WOD_CHIPS = 5
private val WOD_CHIP_WIDTH = 80.dp

@Composable
private fun Footer(state: ScreenState, partialNotice: Boolean, frozenCategoriesCount: Int = 0) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("◀ ▶ página   OK pausar   ▲ comando arena (raias/pódio)   MENU servidor", color = Palette.TextMuted, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            if (frozenCategoriesCount > 0) {
                Text(
                    "$frozenCategoriesCount cat. em revisão",
                    color = Palette.Frozen,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            if (state.link == Link.OFFLINE) {
                Text(state.error ?: "RECONECTANDO…", color = Palette.Offline, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            if (partialNotice) {
                Text("Resultados parciais, sujeitos a homologação", color = Palette.TextMuted, fontSize = 12.sp)
            }
        }
    }
}
