package br.com.itgames.tv.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Mesma paleta do telão web (zinc + âmbar)
object Palette {
    val Background = Color(0xFF09090B)
    val Surface = Color(0xFF18181B)
    val SurfaceHigh = Color(0xFF27272A)
    val Border = Color(0xFF3F3F46)
    val Text = Color(0xFFFAFAFA)
    val TextMuted = Color(0xFFA1A1AA)
    val Amber = Color(0xFFF59E0B)
    val Silver = Color(0xFFD4D4D8)
    val Bronze = Color(0xFFB45309)
    val Online = Color(0xFF22C55E)
    val Offline = Color(0xFFEF4444)
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
