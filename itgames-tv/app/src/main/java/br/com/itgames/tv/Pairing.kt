package br.com.itgames.tv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

data class PairingRequest(val pairingId: String, val code: String, val expiresAt: String)

sealed interface PairingPoll {
    data object Pending : PairingPoll
    data object Expired : PairingPoll // inclui 404/410: o código deve ser pedido de novo
    data class Paired(val token: String) : PairingPoll {
        override fun toString() = "Paired(token=***)" // a credencial nunca vai para log
    }
}

// Decisão pura da resposta do poll. null = falha passageira (continua consultando).
fun decidePoll(httpCode: Int, body: String): PairingPoll? {
    if (httpCode == 404 || httpCode == 410) return PairingPoll.Expired
    if (httpCode !in 200..299) return null
    val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
    return when (json.optString("status")) {
        "pending" -> PairingPoll.Pending
        "expired" -> PairingPoll.Expired
        "paired" -> json.optString("deviceToken").takeIf { it.isNotBlank() }?.let { PairingPoll.Paired(it) }
        else -> null
    }
}

private fun pairingUrl(server: String, vararg segments: String) =
    server.toHttpUrlOrNull()?.newBuilder()?.apply {
        addPathSegment("screens")
        addPathSegment("pairing")
        segments.forEach { addPathSegment(it) }
    }?.build() ?: throw IllegalArgumentException("Endereço inválido")

// POST /screens/pairing. Lança exceção se o servidor estiver inacessível (quem chama tenta de novo).
suspend fun requestPairing(server: String): PairingRequest = withContext(Dispatchers.IO) {
    val request = Request.Builder().url(pairingUrl(server)).post("".toRequestBody()).build()
    Api.http.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw IllegalStateException("Servidor respondeu ${response.code}")
        val json = JSONObject(response.body!!.string())
        PairingRequest(json.getString("pairingId"), json.getString("code"), json.optString("expiresAt"))
    }
}

// GET /screens/pairing/:id. Falha passageira de rede/servidor vira Pending (o loop continua).
suspend fun pollPairing(server: String, pairingId: String): PairingPoll = withContext(Dispatchers.IO) {
    runCatching {
        Api.http.newCall(Request.Builder().url(pairingUrl(server, pairingId)).build()).execute().use { response ->
            decidePoll(response.code, response.body?.string().orEmpty())
        }
    }.getOrNull() ?: PairingPoll.Pending
}
