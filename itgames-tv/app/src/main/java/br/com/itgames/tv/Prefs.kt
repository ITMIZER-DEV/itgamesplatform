package br.com.itgames.tv

import android.content.Context
import android.os.Build

// Servidor e credencial do telão (ficam salvos no aparelho).
class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("itgames_tv", Context.MODE_PRIVATE)

    companion object {
        const val EMULATOR_API_URL = "http://10.0.2.2:3334"
        const val LOCAL_LAN_API_URL = "http://10.10.10.32:3334"

        fun isEmulator(): Boolean {
            val fingerprint = Build.FINGERPRINT.lowercase()
            val model = Build.MODEL.lowercase()
            val hardware = Build.HARDWARE.lowercase()
            val product = Build.PRODUCT.lowercase()
            return fingerprint.contains("generic") ||
                fingerprint.startsWith("unknown") ||
                model.contains("google_sdk") ||
                model.contains("emulator") ||
                model.contains("android sdk") ||
                hardware.contains("goldfish") ||
                hardware.contains("ranchu") ||
                product.contains("sdk") ||
                product.contains("google_sdk")
        }

        fun defaultServerUrl(): String {
            return if (isEmulator()) EMULATOR_API_URL else LOCAL_LAN_API_URL
        }
    }

    var serverUrl: String
        get() = prefs.getString("server", null) ?: defaultServerUrl()
        set(value) = prefs.edit().putString("server", value.trim().trimEnd('/')).apply()

    // Credencial do telão (guardada só no aparelho; nunca logar nem colocar em mensagens de erro).
    var deviceToken: String?
        get() = prefs.getString("device_token", null)
        set(value) = prefs.edit().apply { if (value == null) remove("device_token") else putString("device_token", value) }.apply()
}
