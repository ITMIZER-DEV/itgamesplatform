package br.com.itgames.tv.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Mesmos tokens do tema escuro da plataforma (globals.css): fundo, card, muted, borda, âmbar da arena
object Palette {
    val Background = Color(0xFF090A0F)
    val Surface = Color(0xFF11131A)
    val SurfaceHigh = Color(0xFF1E2230)
    val Border = Color(0xFF232838)
    val Text = Color(0xFFF3F4F6)
    val TextMuted = Color(0xFF9CA3AF)
    val Amber = Color(0xFFF59E0B)
    val Silver = Color(0xFFD4D4D8)
    val Bronze = Color(0xFFB45309)
    val Online = Color(0xFF22C55E)
    val Offline = Color(0xFFEF4444)
    val Frozen = Color(0xFF3B82F6)
}

@Composable
fun ItGamesTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Palette.Background,
            surface = Palette.Surface,
            primary = Palette.Amber,
            onPrimary = Color.Black,
            onBackground = Palette.Text,
            onSurface = Palette.Text,
        ),
        content = content,
    )
}
