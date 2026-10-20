package br.com.itgames.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PairingTest {
    @Test
    fun pendingAndExpired() {
        assertEquals(PairingPoll.Pending, decidePoll(200, """{"status":"pending"}"""))
        assertEquals(PairingPoll.Expired, decidePoll(200, """{"status":"expired"}"""))
    }

    @Test
    fun paired() {
        assertEquals(PairingPoll.Paired("tok"), decidePoll(200, """{"status":"paired","deviceToken":"tok"}"""))
    }

    @Test
    fun goneOrNotFoundMeansRequestNewCode() {
        assertEquals(PairingPoll.Expired, decidePoll(410, ""))
        assertEquals(PairingPoll.Expired, decidePoll(404, ""))
    }

    @Test
    fun transientFailuresKeepPolling() {
        assertNull(decidePoll(500, ""))
        assertNull(decidePoll(429, ""))
        assertNull(decidePoll(200, "não é json"))
        assertNull(decidePoll(200, """{"status":"paired"}"""))
    }
}
