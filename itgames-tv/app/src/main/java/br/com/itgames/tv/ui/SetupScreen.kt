package br.com.itgames.tv.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import br.com.itgames.tv.R

// Tela do servidor (aberta pelo MENU): edita o endereço e, se o aparelho estiver pareado, permite desparear.
// O telão é escolhido no painel do organizador; aqui não há mais lista de campeonatos.
@Composable
fun SetupScreen(
    initialServer: String,
    paired: Boolean,
    onSave: (server: String) -> Unit,
    onUnpair: () -> Unit,
    onCancel: () -> Unit,
) {
    var server by remember { mutableStateOf(initialServer) }

    Column(Modifier.fillMaxSize().background(Palette.Background).padding(horizontal = 64.dp, vertical = 32.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.logo_itgames), contentDescription = "ITGames", modifier = Modifier.height(56.dp), contentScale = ContentScale.Fit)
            Spacer(Modifier.width(24.dp))
            Text("Servidor do telão", color = Palette.Amber, fontSize = 30.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = server,
            onValueChange = { server = it },
            label = { Text("Endereço do servidor") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Choice(
                label = "🖥️ Emulador (10.0.2.2:3334)",
                modifier = Modifier.weight(1f),
                onClick = { server = br.com.itgames.tv.Prefs.EMULATOR_API_URL },
            )
            Choice(
                label = "📶 Rede Local PC (10.10.10.32:3334)",
                modifier = Modifier.weight(1f),
                onClick = { server = br.com.itgames.tv.Prefs.LOCAL_LAN_API_URL },
            )
        }
        Spacer(Modifier.height(12.dp))
        Text(
            if (paired) "Este aparelho está pareado a um telão." else "Este aparelho ainda não está pareado.",
            color = Palette.TextMuted, fontSize = 16.sp,
        )
        Spacer(Modifier.height(16.dp))

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Choice("Salvar", onClick = { onSave(server.trim().trimEnd('/')) })
            if (paired) Choice("Desparear (Gerar novo código)", onClick = onUnpair)
            Choice("Voltar", onClick = onCancel)
        }
    }
}

// Botão focável pelo controle remoto, com destaque visível no foco.
@Composable
private fun Choice(label: String, modifier: Modifier = Modifier.fillMaxWidth(), onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (focused) Palette.SurfaceHigh else Palette.Surface)
            .border(if (focused) 3.dp else 1.dp, if (focused) Palette.Amber else Palette.Border, RoundedCornerShape(12.dp))
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
    ) {
        Text(label, color = if (focused) Color.White else Palette.Text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    }
}
