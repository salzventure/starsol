# Keep WebView JS-interface classes if we add any later.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
