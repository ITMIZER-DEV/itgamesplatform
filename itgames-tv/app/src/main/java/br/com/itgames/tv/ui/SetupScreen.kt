package br.com.itgames.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import br.com.itgames.tv.Api
import br.com.itgames.tv.GameOption
import br.com.itgames.tv.R
import kotlinx.coroutines.launch

// Escolha do servidor e do campeonato. Navegável só com o controle remoto: a lista de campeonatos
// vem do servidor, então o único texto a digitar é o endereço (e ele já vem preenchido).
@Composable
fun SetupScreen(
    initialServer: String,
    currentGame: String?,
    onDone: (server: String, game: String) -> Unit,
    onCancel: (() -> Unit)?,
) {
    var server by remember { mutableStateOf(initialServer) }
    var games by remember { mutableStateOf<List<GameOption>>(emptyList()) }
    var status by remember { mutableStateOf("Carregando campeonatos…") }
    val scope = rememberCoroutineScope()

    fun load() {
        status = "Carregando campeonatos…"
        games = emptyList()
        scope.launch {
            runCatching { Api.listGames(server.trim().trimEnd('/')) }
                .onSuccess {
                    games = it
                    status = if (it.isEmpty()) "Nenhum campeonato liberado neste servidor" else "Escolha o campeonato do telão"
                }
                .onFailure { status = "Não foi possível acessar o servidor: ${it.message ?: "erro desconhecido"}" }
        }
    }
    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize().background(Palette.Background).padding(horizontal = 64.dp, vertical = 32.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(56.dp), contentScale = ContentScale.Fit)
            Spacer(Modifier.width(24.dp))
            Text("Configurar telão", color = Palette.Amber, fontSize = 30.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.height(16.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = server,
                onValueChange = { server = it },
                label = { Text("Endereço do servidor") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(16.dp))
            Choice("Atualizar", highlighted = false, onClick = ::load)
        }

        Spacer(Modifier.height(16.dp))
        Text(status, color = Palette.TextMuted, fontSize = 16.sp)
        Spacer(Modifier.height(8.dp))

        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(games, key = { it.code }) { game ->
                Choice(
                    label = listOf(game.name, game.location).filter { it.isNotBlank() }.joinToString(" • "),
                    highlighted = game.code == currentGame,
                    onClick = { onDone(server.trim().trimEnd('/'), game.code) },
                )
            }
        }

        if (onCancel != null) {
            Spacer(Modifier.height(8.dp))
            Choice("Voltar ao placar", highlighted = false, onClick = onCancel)
        }
    }
}

// Botão focável pelo controle remoto, com destaque visível no foco.
@Composable
private fun Choice(label: String, highlighted: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val border = when {
        focused -> Palette.Amber
        highlighted -> Palette.Amber.copy(alpha = 0.5f)
        else -> Palette.Border
    }
    Box(
        Modifier
            .fillMaxWidth(if (label == "Atualizar") 0.25f else 1f)
            .clip(RoundedCornerShape(12.dp))
            .background(if (focused) Palette.SurfaceHigh else Palette.Surface)
            .border(if (focused) 3.dp else 1.dp, border, RoundedCornerShape(12.dp))
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
    ) {
        Text(label, color = if (focused) Color.White else Palette.Text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}
