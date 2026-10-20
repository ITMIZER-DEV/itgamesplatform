package br.com.itgames.tv

import android.content.Context

// Servidor e campeonato escolhidos na tela de configuração (ficam salvos no aparelho).
class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("itgames_tv", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server", null) ?: BuildConfig.DEFAULT_API_URL
        set(value) = prefs.edit().putString("server", value.trim().trimEnd('/')).apply()

    // Credencial do telão (guardada só no aparelho; nunca logar nem colocar em mensagens de erro).
    var deviceToken: String?
        get() = prefs.getString("device_token", null)
        set(value) = prefs.edit().apply { if (value == null) remove("device_token") else putString("device_token", value) }.apply()

    var gameCode: String?
        get() = prefs.getString("game", null)
        set(value) = prefs.edit().putString("game", value).apply()
}
