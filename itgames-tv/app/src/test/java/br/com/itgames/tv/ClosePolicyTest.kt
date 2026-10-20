package br.com.itgames.tv

import org.junit.Test
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue

class ClosePolicyTest {
    @Test fun codigosDeDesparelhamento() {
        assertTrue(isUnpairedCode(4401))
        assertTrue(isUnpairedCode(4410))
        assertFalse(isUnpairedCode(1000))
        assertFalse(isUnpairedCode(0))
    }
}
