package app.starsol.tv

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep the screen on while the receiver is foregrounded.
        // navigator.wakeLock is unreliable on Android TV WebViews; the
        // window-level flag is the canonical native equivalent.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )

        // WARNING: remove before production release. Web contents debugging
        // exposes the WebView JS context to any connected Chrome DevTools
        // session on the same network.
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = if (BuildConfig.DEBUG) WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                // Allow the bundled file:// receiver to fetch https://starsol.app/api/*
                // without CORS rejection. Android WebView treats file:// as the opaque
                // "null" origin, which servers don't whitelist. Safe here because this
                // WebView only loads our own file:///android_asset/ content.
                @Suppress("AllowAllHostnameVerifier")
                allowUniversalAccessFromFileURLs = true
                textZoom = 100
                // Append starsol-androidtv token so the live receiver can detect
                // this as a native Android TV shell.
                userAgentString = userAgentString + " starsol-androidtv/1.0.0"
            }
            // Start at 100% to avoid viewport-flash on first paint.
            setInitialScale(100)
            setBackgroundColor(android.graphics.Color.parseColor("#050608"))
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    return !url.startsWith("https://starsol.app/")
                }
            }
        }

        setContentView(webView)
        if (BuildConfig.DEBUG) webView.clearCache(true)

        // Hot-fix override: check remote config (2.5s timeout). If the backend
        // returns an overrideUrl on the starsol.app domain we load that instead
        // of the bundle. On network error or timeout we fall back to bundled.
        loadReceiverWithOverrideCheck()

        // OLED burn-in protection: pixel-shift ±3px every 3 minutes. Done
        // natively on the WebView translation so static elements (logomark,
        // sidebar borders) don't bake in over multi-hour ambient sessions.
        startPixelShift()
    }

    private fun loadReceiverWithOverrideCheck() {
        val mainHandler = Handler(Looper.getMainLooper())
        Thread {
            val url = try {
                val conn = URL(RECEIVER_CONFIG_URL).openConnection() as HttpURLConnection
                conn.connectTimeout = 2500
                conn.readTimeout    = 2500
                conn.setRequestProperty("X-StarSol-Client", CLIENT_VALUE)
                conn.connect()
                val json = JSONObject(conn.inputStream.bufferedReader().readText())
                conn.disconnect()
                val override = json.optString("overrideUrl", "")
                if (override.startsWith("https://starsol.app/")) override else null
            } catch (_: Exception) { null }
            mainHandler.post { webView.loadUrl(url ?: BUNDLED_RECEIVER_URL) }
        }.start()
    }

    private fun startPixelShift() {
        val handler = Handler(Looper.getMainLooper())
        val shiftRunnable = object : Runnable {
            private var phase = 0
            override fun run() {
                val (dx, dy) = when (phase % 4) {
                    0 -> 3f to 0f
                    1 -> 0f to 3f
                    2 -> -3f to 0f
                    else -> 0f to -3f
                }
                webView.animate().translationX(dx).translationY(dy).setDuration(800).start()
                phase++
                handler.postDelayed(this, 180_000L) // 3 minutes
            }
        }
        handler.postDelayed(shiftRunnable, 180_000L)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // BACK: intercept both UP and DOWN. On UP, call into JS first;
        // if JS doesn't consume it, send app to background (TV convention).
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_DOWN) return true
            if (event.action == KeyEvent.ACTION_UP) {
                webView.evaluateJavascript(
                    "(function(){try{return window.starsolBack&&window.starsolBack();}catch(e){return false;}})()"
                ) { result ->
                    if (result != "true") {
                        if (webView.canGoBack()) webView.goBack()
                        else moveTaskToBack(true)
                    }
                }
                return true
            }
        }

        // D-PAD: Android TV WebViews sometimes consume DPAD events via the
        // native View focus system before they reach the JS keydown handler,
        // especially when loaded from file://. Intercept ACTION_DOWN here and
        // inject the event directly into JS — this is the reliable pattern for
        // fully custom D-pad navigation in a single-WebView TV app.
        if (event.action == KeyEvent.ACTION_DOWN) {
            val jsKey = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_UP       -> "ArrowUp"
                KeyEvent.KEYCODE_DPAD_DOWN     -> "ArrowDown"
                KeyEvent.KEYCODE_DPAD_LEFT     -> "ArrowLeft"
                KeyEvent.KEYCODE_DPAD_RIGHT    -> "ArrowRight"
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER,
                KeyEvent.KEYCODE_NUMPAD_ENTER  -> "Enter"
                else                           -> null
            }
            if (jsKey != null) {
                webView.evaluateJavascript(
                    "document.dispatchEvent(new KeyboardEvent('keydown',{key:'$jsKey',bubbles:true,cancelable:true}));",
                    null
                )
                return true
            }
        }

        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val BUNDLED_RECEIVER_URL =
            "file:///android_asset/receiver/index.html"
        private const val CLIENT_VALUE = "starsol-androidtv/1.0.0"
        private const val RECEIVER_CONFIG_URL =
            "https://starsol.app/api/receiver-config"
    }
}
