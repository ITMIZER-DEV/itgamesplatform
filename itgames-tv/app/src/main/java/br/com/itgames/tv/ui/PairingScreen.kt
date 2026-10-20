package br.com.itgames.tv.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.itgames.tv.PairingPoll
import br.com.itgames.tv.R
import br.com.itgames.tv.pollPairing
import br.com.itgames.tv.requestPairing
import kotlinx.coroutines.delay

private const val POLL_MS = 3_000L
private const val RETRY_MS = 5_000L

// Pareamento sem digitar nada no controle: a TV mostra um código grande e o organizador o digita no painel.
// Renova o código quando expira (ou quando o servidor não o conhece mais) e consulta a cada 3 s.
@Composable
fun PairingScreen(server: String, onPaired: (token: String) -> Unit) {
    var code by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("Gerando código…") }

    LaunchedEffect(server) {
        while (true) {
            code = null
            val request = runCatching { requestPairing(server) }.getOrNull()
            if (request == null) {
                status = "Sem conexão com o servidor. Tentando de novo…"
                delay(RETRY_MS)
                continue
            }
            code = request.code
            status = "Aguardando o pareamento…"
            var expired = false
            while (!expired) {
                delay(POLL_MS)
                when (val poll = pollPairing(server, request.pairingId)) {
                    is PairingPoll.Paired -> {
                        onPaired(poll.token)
                        return@LaunchedEffect
                    }
                    PairingPoll.Expired -> expired = true
                    PairingPoll.Pending -> Unit
                }
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(Palette.Background).padding(64.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(72.dp), contentScale = ContentScale.Fit)
        Spacer(Modifier.height(32.dp))
        Text(
            "Abra Telões no painel do organizador e digite o código",
            color = Palette.Text, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
        Box(
            Modifier
                .background(Palette.Surface, RoundedCornerShape(24.dp))
                .border(3.dp, Palette.Amber, RoundedCornerShape(24.dp))
                .padding(horizontal = 64.dp, vertical = 32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                code ?: "• • • •",
                color = Palette.Amber, fontSize = 120.sp, fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace, letterSpacing = 16.sp,
            )
        }
        Spacer(Modifier.height(24.dp))
        Text(status, color = Palette.TextMuted, fontSize = 20.sp)
        Spacer(Modifier.height(8.dp))
        Text("MENU: endereço do servidor", color = Palette.TextMuted, fontSize = 16.sp)
    }
}
