package br.com.itgames.tv

import br.com.itgames.tv.ui.chipFontSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChipFontTest {
    @Test
    fun keepsNormalValuesAtTwelve() {
        listOf("04:10", "150 kg", "120 reps", "CAP +50", "W.O.").forEach { assertEquals(it, 12, chipFontSize(it)) }
    }

    @Test
    fun shrinksLongValues() {
        assertTrue(chipFontSize("CANCELADA") < chipFontSize("04:10"))
        assertTrue(chipFontSize("Sem Score") < 12)
    }
}
