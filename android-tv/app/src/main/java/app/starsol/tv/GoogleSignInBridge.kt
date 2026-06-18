package app.starsol.tv

import android.content.Intent
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import org.json.JSONObject

/**
 * JavascriptInterface that bridges WebView JS calls to Google Sign-In, so users
 * can authenticate on Android TV without scanning a QR code on their phone.
 *
 * Exposed to JS as: window.StarSolAuth
 *
 * JS callable methods:
 *   StarSolAuth.isAvailable()       → boolean
 *   StarSolAuth.signInWithGoogle()
 *   StarSolAuth.signOut()
 *
 * On result, calls window.starsolGoogleSignInResult(jsonString) in the
 * WebView. JSON payload:
 *   { ok: true,  credential: "<google_id_token>" }   on success
 *   { ok: false, error: "<message>" }                on failure / cancel
 *
 * The Activity is responsible for registering the ActivityResultLauncher and
 * handing it to this bridge via [launchSignIn]. JS calls that need to
 * touch the UI / WebView are marshalled to the main thread because
 * @JavascriptInterface methods are invoked on a private background thread.
 */
class GoogleSignInBridge(
    private val activity: MainActivity,
) {
    companion object {
        private const val TAG = "GoogleSignInBridge"
    }

    // WebView reference for JS callbacks — set by MainActivity after webView is created.
    var webView: WebView? = null

    // Set by MainActivity in onCreate before setContentView. Used to launch the
    // Google Sign-In Intent — ActivityResultLauncher must be registered while
    // the Activity is in CREATED state.
    var launchSignIn: ((Intent) -> Unit)? = null

    // Guard against overlapping sign-in attempts.
    @Volatile
    private var signInInFlight: Boolean = false

    private val webClientId: String by lazy {
        try {
            BuildConfig.GOOGLE_CLIENT_ID
        } catch (e: Throwable) {
            ""
        }
    }

    private val googleSignInClient by lazy {
        // Request the ID token so we can hand it to the backend (/api/auth/google)
        // for verification. The backend already accepts { credential: <id_token> }.
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .apply {
                if (webClientId.isNotBlank()) requestIdToken(webClientId)
            }
            .build()
        GoogleSignIn.getClient(activity, gso)
    }

    // ── JS-callable interface ─────────────────────────────────────────────────

    /**
     * Returns true when the native Google Sign-In bridge is wired and the build
     * has a non-empty client id. JS uses this to gate the "Sign in with Google"
     * button rendered in the account prompt.
     */
    @JavascriptInterface
    fun isAvailable(): Boolean = webClientId.isNotBlank()

    /**
     * Triggers the Google account picker. On success, the backend-bound JWT is
     * delivered back to JS via window.starsolGoogleSignInResult.
     */
    @JavascriptInterface
    fun signInWithGoogle() {
        if (webClientId.isBlank()) {
            postResult(false, error = "Google Sign-In not configured")
            return
        }
        if (signInInFlight) return
        signInInFlight = true

        // UI work must run on the main thread; @JavascriptInterface is invoked
        // on a background thread.
        activity.runOnUiThread {
            try {
                // Try silent sign-in first — if the user has previously granted
                // access, this reuses the cached account without showing the picker.
                val silentTask: Task<GoogleSignInAccount> = googleSignInClient.silentSignIn()
                if (silentTask.isSuccessful) {
                    deliverAccount(silentTask.result)
                    return@runOnUiThread
                }
                silentTask.addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        deliverAccount(task.result)
                    } else {
                        // Fall back to the interactive picker.
                        launchInteractiveSignIn()
                    }
                }
            } catch (e: Throwable) {
                Log.w(TAG, "silent sign-in failed, launching picker: ${e.message}")
                launchInteractiveSignIn()
            }
        }
    }

    /**
     * Clears the cached Google account so the next signInWithGoogle() call
     * shows the picker again. JS can call this when the user signs out.
     */
    @JavascriptInterface
    fun signOut() {
        activity.runOnUiThread {
            try {
                googleSignInClient.signOut()
            } catch (e: Throwable) {
                Log.w(TAG, "Google sign-out failed: ${e.message}")
            }
        }
    }

    // ── Activity-result wiring ────────────────────────────────────────────────

    /**
     * Called by MainActivity from the ActivityResultLauncher callback once the
     * Google Sign-In intent returns.
     */
    fun onSignInActivityResult(data: Intent?) {
        signInInFlight = false
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            deliverAccount(account)
        } catch (e: ApiException) {
            Log.w(TAG, "Google Sign-In failed: statusCode=${e.statusCode}")
            val message = when (e.statusCode) {
                12501 /* SIGN_IN_CANCELLED */ -> "Sign-in cancelled"
                7     /* NETWORK_ERROR */     -> "Network error. Try again."
                10    /* DEVELOPER_ERROR */   -> "Google Sign-In misconfigured"
                else -> "Sign-in failed (${e.statusCode})"
            }
            postResult(false, error = message)
        } catch (e: Throwable) {
            Log.e(TAG, "Unexpected sign-in result error", e)
            postResult(false, error = "Sign-in failed")
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun launchInteractiveSignIn() {
        val launcher = launchSignIn
        if (launcher == null) {
            Log.e(TAG, "ActivityResultLauncher not wired by MainActivity")
            postResult(false, error = "Sign-in not ready")
            return
        }
        try {
            launcher(googleSignInClient.signInIntent)
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to launch sign-in intent", e)
            signInInFlight = false
            postResult(false, error = "Could not open Google Sign-In")
        }
    }

    private fun deliverAccount(account: GoogleSignInAccount?) {
        signInInFlight = false
        val idToken = account?.idToken
        if (idToken.isNullOrBlank()) {
            postResult(false, error = "No ID token returned")
            return
        }
        postResult(true, credential = idToken)
    }

    /**
     * Invokes window.starsolGoogleSignInResult(JSON.parse("...")) in the WebView.
     *
     * Security: the JSON payload is wrapped in JSONObject.quote() so it is
     * passed to JS as a properly escaped string literal, then parsed back to
     * an object on the JS side. This prevents JS-injection via quotes,
     * backslashes, control characters, or unicode line terminators in any
     * field of the payload (notably the ID token / error message).
     */
    private fun postResult(ok: Boolean, credential: String? = null, error: String? = null) {
        val payload = JSONObject().apply {
            put("ok", ok)
            if (credential != null) put("credential", credential)
            if (error != null) put("error", error)
        }
        val jsonLiteral = JSONObject.quote(payload.toString())
        val js = "if(typeof window.starsolGoogleSignInResult==='function'){" +
            "try{window.starsolGoogleSignInResult($jsonLiteral)}catch(e){}};"
        val wv = webView ?: return
        // WebView calls must be on the main thread.
        wv.post {
            wv.evaluateJavascript(js, null)
        }
    }
}
