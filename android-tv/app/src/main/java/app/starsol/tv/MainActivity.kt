package app.starsol.tv

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity(), PurchasesUpdatedListener {

    private lateinit var webView: WebView
    private val mainHandler = Handler(Looper.getMainLooper())
    private var destroyed = false
    private var receiverPageReady = false
    private var billingReconnectAttempts = 0
    private var billingClient: BillingClient? = null
    private val productDetailsById = mutableMapOf<String, ProductDetails>()
    private val purchasesByToken = mutableMapOf<String, Purchase>()
    private val pendingReceiverScripts = mutableListOf<String>()

    // Google Sign-In bridge — wired before the WebView so the @JavascriptInterface
    // is registered before any page loads.
    private lateinit var googleSignInBridge: GoogleSignInBridge
    private lateinit var googleSignInLauncher: ActivityResultLauncher<Intent>

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

        // Debug builds only: expose the WebView JS context to Chrome DevTools.
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        // Google Sign-In bridge — must be initialised before the WebView so the
        // @JavascriptInterface is registered before any page loads. The
        // ActivityResultLauncher must also be registered before the Activity
        // reaches STARTED, so we wire it here in onCreate.
        googleSignInBridge = GoogleSignInBridge(this)
        googleSignInLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            googleSignInBridge.onSignInActivityResult(result.data)
        }
        googleSignInBridge.launchSignIn = { intent -> googleSignInLauncher.launch(intent) }

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
            // The receiver is authored as a 1920x1080 TV canvas. Android TV
            // WebView reports a 960x540 CSS viewport on 1080p displays, so
            // starting at 50% prevents a zoomed/panned first paint.
            setInitialScale(50)
            setBackgroundColor(android.graphics.Color.parseColor("#050608"))
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    receiverPageReady = true
                    flushReceiverScripts()
                    if (billingClient?.isReady == true) restorePlayPurchases(false)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false
                    if (isAllowedStarSolUrl(url)) return false
                    if (url.startsWith("http://") || url.startsWith("https://")) {
                        runCatching {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        }
                        return true
                    }
                    return true
                }
            }
            addJavascriptInterface(StarSolBillingBridge(), "StarSolBilling")
            // Google Sign-In is always wired so native auth works regardless of
            // billing state — avoids QR-only fallback on the account gate.
            addJavascriptInterface(googleSignInBridge, "StarSolAuth")
        }

        // Give GoogleSignInBridge a reference to the WebView for JS callbacks.
        googleSignInBridge.webView = webView

        setContentView(webView)
        if (BuildConfig.DEBUG) webView.clearCache(true)
        initPlayBilling()

        // Hot-fix override: check remote config (2.5s timeout). If the backend
        // returns an overrideUrl on the starsol.app domain we load that instead
        // of the bundle. On network error or timeout we fall back to bundled.
        loadReceiverWithOverrideCheck()
    }

    private fun loadReceiverWithOverrideCheck() {
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
                if (isAllowedStarSolUrl(override)) override else null
            } catch (_: Exception) { null }
            mainHandler.post {
                if (!destroyed) webView.loadUrl(url ?: BUNDLED_RECEIVER_URL)
            }
        }.start()
    }

    private fun initPlayBilling() {
        billingClient = BillingClient.newBuilder(this)
            .setListener(this)
            .enablePendingPurchases()
            .build()
        connectPlayBilling()
    }

    private fun connectPlayBilling() {
        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    billingReconnectAttempts = 0
                    queryProducts()
                    restorePlayPurchases(false)
                    notifyBilling("ready", "Google Play Billing ready")
                } else {
                    notifyBilling("unavailable", result.debugMessage.ifBlank { "Google Play Billing unavailable" })
                }
            }

            override fun onBillingServiceDisconnected() {
                notifyBilling("disconnected", "Google Play Billing disconnected")
                scheduleBillingReconnect()
            }
        })
    }

    private fun scheduleBillingReconnect() {
        if (destroyed || billingClient?.isReady == true) return
        val attempt = billingReconnectAttempts.coerceAtMost(5)
        billingReconnectAttempts++
        val delayMs = (1_000L shl attempt).coerceAtMost(30_000L)
        mainHandler.postDelayed({
            if (!destroyed && billingClient?.isReady != true) connectPlayBilling()
        }, delayMs)
    }

    private fun queryProducts() {
        val client = billingClient ?: return
        if (!client.isReady) return
        val products = PLAY_PRODUCT_IDS.map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        client.queryProductDetailsAsync(params) { result, productDetails ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                notifyBilling("products_error", result.debugMessage)
                return@queryProductDetailsAsync
            }
            productDetailsById.clear()
            productDetails.forEach { productDetailsById[it.productId] = it }
            notifyBilling("products", productDetailsById.keys.joinToString(","))
        }
    }

    private fun launchPlayPurchase(productId: String, obfuscatedAccountId: String?) {
        val client = billingClient
        if (client == null || !client.isReady) {
            notifyBilling("unavailable", "Google Play Billing is not ready")
            return
        }
        val details = productDetailsById[productId]
        if (details == null) {
            queryProducts()
            notifyBilling("products_loading", "Loading Google Play products")
            return
        }
        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
        if (offerToken.isNullOrBlank()) {
            notifyBilling("offer_missing", "Google Play subscription offer is missing")
            return
        }
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()
        val flowBuilder = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
        if (!obfuscatedAccountId.isNullOrBlank()) {
            flowBuilder.setObfuscatedAccountId(obfuscatedAccountId.take(64))
        }
        val flowParams = flowBuilder.build()
        val result = client.launchBillingFlow(this, flowParams)
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            notifyBilling("launch_error", result.debugMessage)
        }
    }

    private fun restorePlayPurchases(showMessage: Boolean) {
        val client = billingClient
        if (client == null || !client.isReady) {
            if (showMessage) notifyBilling("unavailable", "Google Play Billing is not ready")
            return
        }
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        client.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                if (showMessage) notifyBilling("restore_error", result.debugMessage)
                return@queryPurchasesAsync
            }
            purchases.forEach { handlePurchase(it) }
            if (showMessage) notifyBilling("restore_complete", "${purchases.size} Google Play subscription(s) found")
        }
    }

    private fun evaluateInReceiver(script: String) {
        mainHandler.post {
            if (destroyed) return@post
            if (receiverPageReady) {
                webView.evaluateJavascript(script, null)
            } else {
                pendingReceiverScripts.add(script)
            }
        }
    }

    private fun flushReceiverScripts() {
        if (pendingReceiverScripts.isEmpty()) return
        val scripts = pendingReceiverScripts.toList()
        pendingReceiverScripts.clear()
        scripts.forEach { webView.evaluateJavascript(it, null) }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases?.forEach { handlePurchase(it) }
            BillingClient.BillingResponseCode.USER_CANCELED -> notifyBilling("canceled", "Purchase canceled")
            else -> notifyBilling("purchase_error", result.debugMessage)
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) {
            notifyBilling("pending", "Purchase is pending")
            return
        }
        val productId = purchase.products.firstOrNull() ?: return
        purchasesByToken[purchase.purchaseToken] = purchase
        val payload = JSONObject()
            .put("productId", productId)
            .put("purchaseToken", purchase.purchaseToken)
            .toString()
        evaluateInReceiver("window.starsolPlayPurchase && window.starsolPlayPurchase($payload);")
        // Acknowledge only after the web receiver confirms StarSol backend
        // verification. This avoids silently accepting payment when entitlement
        // storage failed or the token was rejected.
    }

    private fun acknowledgePurchaseToken(purchaseToken: String) {
        val purchase = purchasesByToken[purchaseToken] ?: return
        if (purchase.isAcknowledged) return
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()
        billingClient?.acknowledgePurchase(params) { result ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                notifyBilling("ack_error", result.debugMessage)
            } else {
                purchasesByToken.remove(purchaseToken)
            }
        }
    }

    private fun notifyBilling(status: String, message: String) {
        val payload = JSONObject().put("status", status).put("message", message).toString()
        evaluateInReceiver("window.starsolPlayBillingMessage && window.starsolPlayBillingMessage($payload);")
    }

    inner class StarSolBillingBridge {
        @JavascriptInterface
        fun purchase(productId: String, obfuscatedAccountId: String?) {
            mainHandler.post { launchPlayPurchase(productId, obfuscatedAccountId) }
        }

        @JavascriptInterface
        fun purchase(productId: String) {
            mainHandler.post { launchPlayPurchase(productId, null) }
        }

        @JavascriptInterface
        fun restore() {
            mainHandler.post { restorePlayPurchases(true) }
        }

        @JavascriptInterface
        fun acknowledge(purchaseToken: String) {
            mainHandler.post { acknowledgePurchaseToken(purchaseToken) }
        }
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

        // TV remote: Android TV WebViews sometimes consume key events via the
        // native View focus system before they reach the JS keydown handler,
        // especially when loaded from file://. Intercept ACTION_DOWN here and
        // inject the event directly into JS — this is the reliable pattern for
        // fully custom remote navigation in a single-WebView TV app.
        if (event.action == KeyEvent.ACTION_DOWN) {
            val jsEvent = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_UP       -> "ArrowUp" to 38
                KeyEvent.KEYCODE_DPAD_DOWN     -> "ArrowDown" to 40
                KeyEvent.KEYCODE_DPAD_LEFT     -> "ArrowLeft" to 37
                KeyEvent.KEYCODE_DPAD_RIGHT    -> "ArrowRight" to 39
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER,
                KeyEvent.KEYCODE_NUMPAD_ENTER  -> "Enter" to 13
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "MediaPlayPause" to 179
                KeyEvent.KEYCODE_MEDIA_PLAY    -> "MediaPlay" to 126
                KeyEvent.KEYCODE_MEDIA_PAUSE   -> "MediaPause" to 127
                KeyEvent.KEYCODE_MEDIA_REWIND  -> "MediaRewind" to 89
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "MediaFastForward" to 90
                else                           -> null
            }
            if (jsEvent != null) {
                val (jsKey, jsKeyCode) = jsEvent
                webView.evaluateJavascript(
                    """
                    document.dispatchEvent(new KeyboardEvent('keydown',{
                      key:'$jsKey',
                      keyCode:$jsKeyCode,
                      which:$jsKeyCode,
                      bubbles:true,
                      cancelable:true
                    }));
                    """.trimIndent(),
                    null
                )
                return true
            }
        }

        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        destroyed = true
        billingClient?.endConnection()
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private val PLAY_PRODUCT_IDS = listOf(
            "explorer_monthly",
            "explorer_annual",
            "observer_monthly",
            "observer_annual"
        )
        private const val BUNDLED_RECEIVER_URL =
            "file:///android_asset/receiver/index.html"
        private const val CLIENT_VALUE = "starsol-androidtv/1.0.0"
        private const val RECEIVER_CONFIG_URL =
            "https://starsol.app/api/receiver-config"

        private fun isAllowedStarSolUrl(url: String): Boolean {
            val uri = Uri.parse(url)
            val host = uri.host ?: return false
            return uri.scheme == "https" && host == "starsol.app"
        }
    }
}
