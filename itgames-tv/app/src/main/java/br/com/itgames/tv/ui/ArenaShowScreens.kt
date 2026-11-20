package br.com.itgames.tv.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.itgames.tv.Board
import br.com.itgames.tv.BoardCategory
import br.com.itgames.tv.BoardRow
import br.com.itgames.tv.HeatCallLane
import br.com.itgames.tv.R
import br.com.itgames.tv.ScreenSpotlight
import kotlin.math.sin

enum class TvArenaMode {
    BOARD,
    HEAT_CALL,
    PODIUM,
}

@Composable
fun ArenaActionToolbar(
    activeMode: TvArenaMode,
    selectedIndex: Int,
    isCurrentCategoryFrozen: Boolean,
    categoryName: String,
    modifier: Modifier = Modifier,
) {
    val items = listOf(
        "PLACAR AO VIVO" to (activeMode == TvArenaMode.BOARD),
        "CHAMAR RAIAS (BATERIA)" to (activeMode == TvArenaMode.HEAT_CALL),
        "ANUNCIAR VENCEDORES (PÓDIO)" to (activeMode == TvArenaMode.PODIUM),
        (if (isCurrentCategoryFrozen) "LIBERAR: ${categoryName.take(18)}" else "REVISÃO: ${categoryName.take(18)}") to isCurrentCategoryFrozen,
    )

    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Palette.SurfaceHigh.copy(alpha = 0.96f))
            .border(1.5.dp, Palette.Amber.copy(alpha = 0.7f), RoundedCornerShape(14.dp))
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f),
        ) {
            Text(
                "COMANDO ARENA:",
                color = Palette.Amber,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
            )
            items.forEachIndexed { idx, (label, isActive) ->
                val isFocused = idx == selectedIndex
                val bg = when {
                    isFocused -> Palette.Amber
                    isActive -> Palette.Amber.copy(alpha = 0.22f)
                    else -> Palette.Background
                }
                val fg = when {
                    isFocused -> Color.Black
                    isActive -> Palette.Amber
                    else -> Palette.Text
                }
                val borderCol = when {
                    isFocused -> Color.White
                    isActive -> Palette.Amber.copy(alpha = 0.6f)
                    else -> Palette.Border
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(bg)
                        .border(if (isFocused) 2.dp else 1.dp, borderCol, RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                ) {
                    Text(
                        label,
                        color = fg,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                    )
                }
            }
        }
        Text(
            "◀ ▶ escolher   OK ativar   ▼ fechar",
            color = Palette.TextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

// Gera as raias de uma bateria a partir das linhas da categoria quando acionado pelo controle remoto da TV
fun buildLocalHeatCall(
    board: Board?,
    category: BoardCategory?,
    heatIndex: Int,
    lanesPerHeat: Int = 6,
): ScreenSpotlight.HeatCall? {
    if (board == null || category == null) return null
    val activeRows = category.rows.filter { it.status != "cancelled" }
    val totalHeats = ((activeRows.size + lanesPerHeat - 1) / lanesPerHeat).coerceAtLeast(1)
    val safeHeatIdx = heatIndex.coerceIn(0, totalHeats - 1)
    val slice = activeRows.drop(safeHeatIdx * lanesPerHeat).take(lanesPerHeat)
    val totalMinutes = 8 * 60 + safeHeatIdx * 15
    val startTime = "%02d:%02d".format(totalMinutes / 60, totalMinutes % 60)
    val unit = if (board.totalUnit == "TEMPO") "" else " ${board.totalUnit}"

    return ScreenSpotlight.HeatCall(
        gameCode = board.gameCode,
        gameName = board.gameName,
        categoryId = category.id,
        categoryName = category.name,
        workoutTitle = category.wodTitles.firstOrNull() ?: "WOD 1",
        heatNumber = safeHeatIdx + 1,
        totalHeats = totalHeats,
        startTime = startTime,
        message = "ATLETAS DA BATERIA, DIRIJAM-SE ÀS SUAS RAIAS DE LARGADA",
        lanes = slice.mapIndexed { idx, r ->
            HeatCallLane(
                laneNumber = idx + 1,
                teamName = r.team,
                number = r.number,
                athletes = r.athletes,
                rank = r.rank,
                totalDisplay = "${r.totalDisplay}$unit",
            )
        },
        triggeredAt = "",
    )
}

@Composable
fun HeatCallOverlayScreen(
    heatCall: ScreenSpotlight.HeatCall,
    readyConfirmed: Boolean,
    modifier: Modifier = Modifier,
) {
    val pulseTransition = rememberInfiniteTransition(label = "callPulse")
    val pulseAlpha by pulseTransition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800, easing = LinearEasing), RepeatMode.Reverse),
        label = "pulseAlpha",
    )

    val accentColor = if (readyConfirmed) Palette.Online else Palette.Amber

    Column(
        modifier
            .fillMaxSize()
            .background(Palette.Background)
            .padding(horizontal = 28.dp, vertical = 16.dp),
    ) {
        // CABEÇALHO DA CHAMADA DE RAIAS
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painterResource(R.drawable.logo_itgames),
                    contentDescription = "ITGames",
                    modifier = Modifier.height(52.dp),
                    contentScale = ContentScale.Fit,
                )
                Spacer(Modifier.width(16.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(accentColor.copy(alpha = 0.22f * pulseAlpha))
                                .border(1.5.dp, accentColor, CircleShape)
                                .padding(horizontal = 12.dp, vertical = 3.dp),
                        ) {
                            Text(
                                if (readyConfirmed) "LARGADA AUTORIZADA • RAIAS PRONTAS" else "CHAMADA OFICIAL DE ARENA • CALL ROOM",
                                color = accentColor,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                            )
                        }
                        Text(
                            heatCall.gameName,
                            color = Palette.TextMuted,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            heatCall.categoryName.ifBlank { "GERAL" },
                            color = Palette.Amber,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Palette.SurfaceHigh)
                                .border(1.dp, Palette.Border, RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 3.dp),
                        ) {
                            Text(
                                heatCall.workoutTitle,
                                color = Palette.Text,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                maxLines = 1,
                            )
                        }
                    }
                }
            }

            // CARD DE BATERIA E HORÁRIO DE LARGADA
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(
                    Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(accentColor.copy(alpha = 0.16f))
                        .border(2.dp, accentColor, RoundedCornerShape(14.dp))
                        .padding(horizontal = 18.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "BATERIA ${heatCall.heatNumber}/${heatCall.totalHeats.coerceAtLeast(heatCall.heatNumber)}",
                        color = accentColor,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        "LARGADA ${heatCall.startTime}",
                        color = Palette.Text,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // FAIXA DE AVISO DE CHAMADA
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            accentColor.copy(alpha = 0.25f),
                            Palette.SurfaceHigh,
                            accentColor.copy(alpha = 0.25f),
                        ),
                    ),
                )
                .border(1.dp, accentColor.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                .padding(horizontal = 16.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                if (readyConfirmed) "ATLETAS POSICIONADOS NAS RAIAS — AGUARDEM O SINAL SONORO DE LARGADA!"
                else heatCall.message.ifBlank { "DIRIJAM-SE ÀS RAIAS DE LARGADA PARA CONFERÊNCIA DO JUIZ DE RAIA" },
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Spacer(Modifier.height(10.dp))

        // GRID DE RAIAS (2 COLUNAS x ATÉ 4 LINHAS = 8 RAIAS NA TELA)
        if (heatCall.lanes.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(
                    "Nenhuma equipe alocada nesta bateria",
                    color = Palette.TextMuted,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        } else {
            val lanes = heatCall.lanes.take(8)
            val rowsPerCol = ((lanes.size + 1) / 2).coerceAtLeast(1)
            val leftCol = lanes.take(rowsPerCol)
            val rightCol = lanes.drop(rowsPerCol)

            Row(
                Modifier.weight(1f).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(
                    Modifier.weight(1f).fillMaxHeight(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    leftCol.forEach { lane ->
                        LaneCallCard(lane, accentColor, Modifier.weight(1f))
                    }
                    repeat((4 - leftCol.size).coerceAtLeast(0)) { Spacer(Modifier.weight(1f)) }
                }
                Column(
                    Modifier.weight(1f).fillMaxHeight(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    rightCol.forEach { lane ->
                        LaneCallCard(lane, accentColor, Modifier.weight(1f))
                    }
                    repeat((4 - rightCol.size).coerceAtLeast(0)) { Spacer(Modifier.weight(1f)) }
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // RODAPÉ COM COMANDOS DO CONTROLE REMOTO
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "◀ ▶ trocar bateria   ▲ barra de comando   OK confirmar largada   VOLTAR ao placar",
                color = Palette.TextMuted,
                fontSize = 12.sp,
            )
            Text(
                "ITMIZER ARENA CALL ROOM",
                color = Palette.Amber,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

@Composable
private fun LaneCallCard(
    lane: HeatCallLane,
    accentColor: Color,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Palette.Surface)
            .border(1.5.dp, accentColor.copy(alpha = 0.55f), shape)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // CRACHÁ DA RAIA
        Column(
            Modifier
                .width(74.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(10.dp))
                .background(accentColor)
                .padding(horizontal = 6.dp, vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "RAIA",
                color = Color.Black,
                fontSize = 10.sp,
                lineHeight = 10.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                "%02d".format(lane.laneNumber),
                color = Color.Black,
                fontSize = 22.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
        }

        Spacer(Modifier.width(12.dp))

        // EQUIPE E ATLETAS
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    lane.teamName,
                    color = Palette.Text,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (lane.number.isNotBlank()) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        lane.number,
                        color = Palette.Amber,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Palette.Amber.copy(alpha = 0.14f))
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                    )
                }
            }
            if (lane.athletes.isNotEmpty()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    lane.athletes.joinToString(" • "),
                    color = Palette.TextMuted,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // RANK ATUAL SE DISPONÍVEL
        if (lane.rank > 0) {
            Spacer(Modifier.width(8.dp))
            Column(
                Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(Palette.Background)
                    .border(1.dp, Palette.Border, RoundedCornerShape(10.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    "${lane.rank}º GERAL",
                    color = Palette.Amber,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                )
                if (lane.totalDisplay.isNotBlank()) {
                    Text(
                        lane.totalDisplay,
                        color = Palette.TextMuted,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

// ─── CERIMÔNIA DE PÓDIO — ANÚNCIO DOS VENCEDORES DA CATEGORIA ─────────────────

@Composable
fun PodiumCeremonyScreen(
    gameName: String,
    category: BoardCategory?,
    totalUnit: String,
    revealStep: Int, // 1 = 3º lugar, 2 = 2º e 3º lugar, 3 = Pódio Completo (1º, 2º e 3º)
    modifier: Modifier = Modifier,
) {
    val activeRows = category?.rows?.filter { it.status != "cancelled" }?.sortedBy { it.rank } ?: emptyList()
    val first = activeRows.firstOrNull { it.rank == 1 } ?: activeRows.getOrNull(0)
    val second = activeRows.firstOrNull { it.rank == 2 } ?: activeRows.getOrNull(1)
    val third = activeRows.firstOrNull { it.rank == 3 } ?: activeRows.getOrNull(2)
    val fourth = activeRows.getOrNull(3)
    val fifth = activeRows.getOrNull(4)

    val anim = rememberInfiniteTransition(label = "podiumConfetti")
    val phase by anim.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing), RepeatMode.Restart),
        label = "confettiPhase",
    )

    Box(
        modifier
            .fillMaxSize()
            .background(Palette.Background),
    ) {
        // Partículas douradas de celebração ao fundo
        Canvas(Modifier.fillMaxSize()) {
            val count = 28
            for (i in 0 until count) {
                val seedX = ((i * 73) % 100) / 100f
                val speed = 0.5f + (i % 4) * 0.25f
                val yNorm = (1f - ((phase * speed + (i * 0.13f)) % 1f))
                val xOffset = sin((phase * 6.28f) + i) * 18f
                val x = seedX * size.width + xOffset
                val y = yNorm * size.height
                val col = when (i % 3) {
                    0 -> Palette.Amber.copy(alpha = 0.30f)
                    1 -> Palette.Silver.copy(alpha = 0.20f)
                    else -> Palette.Bronze.copy(alpha = 0.24f)
                }
                drawCircle(
                    color = col,
                    radius = (3 + (i % 5)).dp.toPx(),
                    center = Offset(x, y),
                )
            }
        }

        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp, vertical = 16.dp),
        ) {
            // CABEÇALHO DO PÓDIO
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painterResource(R.drawable.logo_itgames),
                        contentDescription = "ITGames",
                        modifier = Modifier.height(52.dp),
                        contentScale = ContentScale.Fit,
                    )
                    Spacer(Modifier.width(16.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(
                                Modifier
                                    .clip(CircleShape)
                                    .background(Palette.Amber.copy(alpha = 0.20f))
                                    .border(1.5.dp, Palette.Amber, CircleShape)
                                    .padding(horizontal = 12.dp, vertical = 3.dp),
                            ) {
                                Text(
                                    "CERIMÔNIA OFICIAL DE PÓDIO • VENCEDORES",
                                    color = Palette.Amber,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black,
                                )
                            }
                            Text(
                                gameName,
                                color = Palette.TextMuted,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            category?.name?.ifBlank { "GERAL" } ?: "CATEGORIA",
                            color = Color.White,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }

                // INDICADOR DE ETAPA DE REVELAÇÃO
                Box(
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Palette.SurfaceHigh)
                        .border(1.dp, Palette.Amber.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Text(
                        when (revealStep) {
                            1 -> "ETAPA 1/3 • 3º LUGAR REVELADO"
                            2 -> "ETAPA 2/3 • 2º LUGAR REVELADO"
                            else -> "PÓDIO COMPLETO • CAMPEÕES!"
                        },
                        color = Palette.Amber,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            if (activeRows.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text(
                        "Nenhuma pontuação registrada nesta categoria para o pódio",
                        color = Palette.TextMuted,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            } else {
                // PÓDIO OLÍMPICO: 2º LUGAR (ESQUERDA) | 1º LUGAR CAMPEÃO (CENTRO ELEVADO) | 3º LUGAR (DIREITA)
                Row(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    // 2º LUGAR — PRATA
                    PodiumColumn(
                        place = 2,
                        label = "2º LUGAR • VICE-CAMPEÃO",
                        medalColor = Palette.Silver,
                        medalTextColor = Color.Black,
                        pedestalHeight = 52.dp,
                        row = second,
                        totalUnit = totalUnit,
                        revealed = revealStep >= 2,
                        isChampion = false,
                        modifier = Modifier.weight(1f).fillMaxHeight(0.90f),
                    )

                    // 1º LUGAR — CAMPEÃO OURO
                    PodiumColumn(
                        place = 1,
                        label = "1º LUGAR • CAMPEÃO DA CATEGORIA",
                        medalColor = Palette.Amber,
                        medalTextColor = Color.Black,
                        pedestalHeight = 76.dp,
                        row = first,
                        totalUnit = totalUnit,
                        revealed = revealStep >= 3,
                        isChampion = true,
                        modifier = Modifier.weight(1.18f).fillMaxHeight(),
                    )

                    // 3º LUGAR — BRONZE
                    PodiumColumn(
                        place = 3,
                        label = "3º LUGAR • BRONZE",
                        medalColor = Palette.Bronze,
                        medalTextColor = Color.White,
                        pedestalHeight = 38.dp,
                        row = third,
                        totalUnit = totalUnit,
                        revealed = revealStep >= 1,
                        isChampion = false,
                        modifier = Modifier.weight(1f).fillMaxHeight(0.84f),
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            // FAIXA DE 4º E 5º COLOCADOS + COMANDOS DO CONTROLE REMOTO
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "◀ ▶ trocar categoria   OK revelar próximo colocado (3º ➔ 2º ➔ 1º)   ▲ comando   VOLTAR placar",
                    color = Palette.TextMuted,
                    fontSize = 12.sp,
                )
                if (fourth != null || fifth != null) {
                    val extras = listOfNotNull(
                        fourth?.let { "4º ${it.team} (${it.totalDisplay})" },
                        fifth?.let { "5º ${it.team} (${it.totalDisplay})" },
                    ).joinToString("   •   ")
                    Text(
                        "TOP 5: $extras",
                        color = Palette.TextMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun PodiumColumn(
    place: Int,
    label: String,
    medalColor: Color,
    medalTextColor: Color,
    pedestalHeight: androidx.compose.ui.unit.Dp,
    row: BoardRow?,
    totalUnit: String,
    revealed: Boolean,
    isChampion: Boolean,
    modifier: Modifier = Modifier,
) {
    val cardShape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 8.dp, bottomEnd = 8.dp)
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Bottom,
    ) {
        // CARD DO VENCEDOR
        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(cardShape)
                .background(
                    if (isChampion && revealed) {
                        Brush.verticalGradient(
                            listOf(
                                Palette.Amber.copy(alpha = 0.22f),
                                Palette.Surface,
                            ),
                        )
                    } else {
                        Brush.verticalGradient(listOf(Palette.SurfaceHigh, Palette.Surface))
                    },
                )
                .border(
                    width = if (isChampion && revealed) 2.5.dp else 1.5.dp,
                    color = if (revealed) medalColor else Palette.Border,
                    shape = cardShape,
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            // BADGE DA COLOCAÇÃO
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(if (revealed) medalColor else Palette.SurfaceHigh)
                    .padding(horizontal = 14.dp, vertical = 4.dp),
            ) {
                Text(
                    label,
                    color = if (revealed) medalTextColor else Palette.TextMuted,
                    fontSize = if (isChampion) 12.sp else 11.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                )
            }

            if (row == null) {
                Text(
                    "—",
                    color = Palette.TextMuted,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                )
                Spacer(Modifier.height(4.dp))
            } else if (!revealed) {
                // MODO SUSPENSE ANTES DA REVELAÇÃO
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "${place}º",
                        color = medalColor.copy(alpha = 0.45f),
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (isChampion) "QUEM SERÁ O GRANDE CAMPEÃO?" else "AGUARDANDO ANÚNCIO...",
                        color = Palette.TextMuted,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "Pressione OK para revelar",
                        color = medalColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Spacer(Modifier.height(4.dp))
            } else {
                // DADOS DA EQUIPE CAMPEÃ / PÓDIO
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        row.team,
                        color = Color.White,
                        fontSize = if (isChampion) 24.sp else 20.sp,
                        lineHeight = if (isChampion) 27.sp else 23.sp,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (row.number.isNotBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "BIB ${row.number}",
                            color = medalColor,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                        )
                    }
                    if (row.athletes.isNotEmpty()) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            row.athletes.joinToString(" • "),
                            color = Palette.TextMuted,
                            fontSize = if (isChampion) 13.sp else 12.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }

                // PONTUAÇÃO TOTAL E RESUMO DE WODS
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (row.wods.isNotEmpty()) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(bottom = 6.dp),
                        ) {
                            row.wods.take(4).forEachIndexed { idx, w ->
                                Box(
                                    Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Palette.Background)
                                        .border(1.dp, Palette.Border, RoundedCornerShape(6.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp),
                                ) {
                                    Text(
                                        "W${idx + 1}: ${w.display}",
                                        color = Palette.TextMuted,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                    )
                                }
                            }
                        }
                    }

                    val totalText = if (totalUnit == "TEMPO") row.totalDisplay else "${row.totalDisplay} $totalUnit"
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.Black.copy(alpha = 0.65f))
                            .border(1.dp, medalColor.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            totalText,
                            color = medalColor,
                            fontSize = if (isChampion) 20.sp else 17.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 1,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(4.dp))

        // PEDESTAL DO PÓDIO
        Box(
            Modifier
                .fillMaxWidth()
                .height(pedestalHeight)
                .clip(RoundedCornerShape(bottomStart = 14.dp, bottomEnd = 14.dp, topStart = 6.dp, topEnd = 6.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(
                            medalColor.copy(alpha = if (revealed) 0.88f else 0.25f),
                            medalColor.copy(alpha = if (revealed) 0.45f else 0.12f),
                        ),
                    ),
                )
                .border(
                    1.5.dp,
                    medalColor.copy(alpha = if (revealed) 1f else 0.35f),
                    RoundedCornerShape(bottomStart = 14.dp, bottomEnd = 14.dp, topStart = 6.dp, topEnd = 6.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "${place}º",
                color = if (revealed) medalTextColor else Palette.TextMuted,
                fontSize = if (isChampion) 32.sp else 24.sp,
                fontWeight = FontWeight.Black,
            )
        }
    }
}
