import java.util.Properties

// NOTE: The receiver is bundled into APK assets via
// `bash scripts/bundle-receiver-for-androidtv.sh` (writes to
// app/src/main/assets/receiver/). The `bundleReceiver` task below wires
// that script into `preBuild` so any assemble (debug/release) refreshes
// the bundle from ../receiver/ first.

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Read signing creds and optional Google client id from local.properties (gitignored).
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { stream -> load(stream) }
}

android {
    namespace = "app.starsol.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.starsol.tv"
        minSdk = 21
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Google Sign-In OAuth client id (Web application type, from Google Cloud
        // Console). Plumbed via local.properties so it is not committed. Empty
        // string is a safe default so the build still compiles when unset —
        // GoogleSignInBridge.isAvailable() returns false and the TV falls back
        // to the QR-pairing flow.
        val googleClientId = localProps.getProperty("googleClientId") ?: ""
        buildConfigField("String", "GOOGLE_CLIENT_ID", "\"${googleClientId}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            val storeFilePath = localProps.getProperty("storeFile")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
                storePassword = localProps.getProperty("storePassword")
                keyAlias = localProps.getProperty("keyAlias")
                keyPassword = localProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

// Refresh the bundled receiver before any build.
val bundleReceiver by tasks.registering(Exec::class) {
    workingDir = rootProject.projectDir.parentFile
    commandLine("bash", "scripts/bundle-receiver-for-androidtv.sh")
    isIgnoreExitValue = false
}

tasks.named("preBuild") {
    dependsOn(bundleReceiver)
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    implementation("com.google.android.gms:play-services-auth:21.0.0")
}
