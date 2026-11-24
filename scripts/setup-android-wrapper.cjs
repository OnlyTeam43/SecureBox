const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../android-wrapper');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

// 1. Copy gradle wrapper and gradlew
fs.cpSync(path.resolve(__dirname, '../android/gradle'), path.join(baseDir, 'gradle'), { recursive: true });
fs.copyFileSync(path.resolve(__dirname, '../android/gradlew.bat'), path.join(baseDir, 'gradlew.bat'));
fs.copyFileSync(path.resolve(__dirname, '../android/gradlew'), path.join(baseDir, 'gradlew'));

// 2. local.properties
fs.writeFileSync(path.join(baseDir, 'local.properties'), 'sdk.dir=C\\:\\\\Users\\\\kanne\\\\AppData\\\\Local\\\\Android\\\\Sdk\n', 'utf8');

// 3. settings.gradle
fs.writeFileSync(path.join(baseDir, 'settings.gradle'), 'rootProject.name = "SecureBox"\ninclude ":app"\n', 'utf8');

// 4. root build.gradle
const rootBuildGradle = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.6.0'
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`;
fs.writeFileSync(path.join(baseDir, 'build.gradle'), rootBuildGradle, 'utf8');

// 5. app directory
const appDir = path.join(baseDir, 'app');
fs.mkdirSync(appDir, { recursive: true });

// Copy debug.keystore
const sourceKeystore = path.resolve(__dirname, '../android/app/debug.keystore');
if (fs.existsSync(sourceKeystore)) {
  fs.copyFileSync(sourceKeystore, path.join(appDir, 'debug.keystore'));
}

// 6. app/build.gradle
const appBuildGradle = `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace 'com.securebox.app'
    compileSdk 35

    defaultConfig {
        applicationId "com.securebox.app"
        minSdk 24
        targetSdk 35
        versionCode 2
        versionName "1.0.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.debug
        }
        debug {
            signingConfig signingConfigs.debug
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.13.1'
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.activity:activity-ktx:1.9.3'
}
`;
fs.writeFileSync(path.join(appDir, 'build.gradle'), appBuildGradle, 'utf8');

// 7. Res directory: copy mipmaps from android/app/src/main/res
const srcRes = path.resolve(__dirname, '../android/app/src/main/res');
const destRes = path.join(appDir, 'src/main/res');
fs.mkdirSync(destRes, { recursive: true });

const mipmaps = fs.readdirSync(srcRes).filter(f => f.startsWith('mipmap') || f.startsWith('drawable'));
for (const m of mipmaps) {
  fs.cpSync(path.join(srcRes, m), path.join(destRes, m), { recursive: true });
}

// Values & styles
const valuesDir = path.join(destRes, 'values');
fs.mkdirSync(valuesDir, { recursive: true });

fs.writeFileSync(path.join(valuesDir, 'strings.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Brick Smash</string>
</resources>
`, 'utf8');

fs.writeFileSync(path.join(valuesDir, 'colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#FAF9F5</color>
    <color name="status_bar">#FAF9F5</color>
</resources>
`, 'utf8');

fs.writeFileSync(path.join(valuesDir, 'themes.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.SecureBox" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:statusBarColor">@color/status_bar</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowBackground">@color/primary</item>
    </style>
</resources>
`, 'utf8');

// xml directory for file provider
const xmlDir = path.join(destRes, 'xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(path.join(xmlDir, 'file_paths.xml'), `<?xml version="1.0" encoding="utf-8"?>
<paths>
    <external-files-path name="my_images" path="Pictures" />
    <external-cache-path name="my_cache" path="." />
    <cache-path name="internal_cache" path="." />
</paths>
`, 'utf8');

// 8. AndroidManifest.xml
const mainDir = path.join(appDir, 'src/main');
fs.writeFileSync(path.join(mainDir, 'AndroidManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.media.action.IMAGE_CAPTURE" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.SecureBox"
        android:usesCleartextTraffic="false"
        tools:targetApi="35">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|uiMode"
            android:windowSoftInputMode="adjustResize"
            android:theme="@style/Theme.SecureBox">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Deep linking for rooms -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="thesecurebox.vercel.app" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="securebox" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="com.securebox.app.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

    </application>
</manifest>
`, 'utf8');

// 9. MainActivity.kt
const javaDir = path.join(mainDir, 'java/com/securebox/app');
fs.mkdirSync(javaDir, { recursive: true });

fs.writeFileSync(path.join(javaDir, 'MainActivity.kt'), `package com.securebox.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.webkit.*
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null

    private val WEB_URL = "https://thesecurebox.vercel.app/"

    // File Chooser Activity Result Launcher
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback == null) return@registerForActivityResult

        var results: Array<Uri>? = null
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            if (data != null && data.clipData != null) {
                // Multiple files selected
                val count = data.clipData!!.itemCount
                val list = ArrayList<Uri>()
                for (i in 0 until count) {
                    list.add(data.clipData!!.getItemAt(i).uri)
                }
                results = list.toTypedArray()
            } else if (data != null && data.data != null) {
                // Single file from gallery/documents
                results = arrayOf(data.data!!)
            } else if (cameraImageUri != null) {
                // Photo taken from camera
                results = arrayOf(cameraImageUri!!)
            }
        }
        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    // Permission Request Launcher for Camera / Audio
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Permissions handled
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make status bar appearance match app (#FAF9F5 light background)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = true

        // Create UI container
        val rootLayout = FrameLayout(this)
        rootLayout.setBackgroundColor(0xFFFAF9F5.toInt())

        webView = WebView(this)
        rootLayout.addView(
            webView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        progressBar.max = 100
        progressBar.progressDrawable = ContextCompat.getDrawable(this, android.R.drawable.progress_horizontal)
        val progressParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            8
        )
        rootLayout.addView(progressBar, progressParams)

        setContentView(rootLayout)

        // Request runtime permissions
        requestAppPermissions()

        // Configure WebView
        setupWebView()

        // Handle Back Button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // Restore or Load URL
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            val appLinkData: Uri? = intent?.data
            if (appLinkData != null) {
                webView.loadUrl(appLinkData.toString())
            } else {
                webView.loadUrl(WEB_URL)
            }
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        permissionLauncher.launch(permissions.toTypedArray())
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        // Append identifier to user agent while maintaining full Chrome/WebRTC compatibility
        val defaultUserAgent = settings.userAgentString
        settings.userAgentString = "\$defaultUserAgent SecureBoxApp/1.0"

        // WebChromeClient: file uploads, progress, permissions
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress == 100) {
                    progressBar.visibility = View.GONE
                } else {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                // Grant camera / audio permissions for WebRTC calling
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                mWebView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                // 1. Prepare Camera capture intent
                var takePictureIntent: Intent? = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                if (takePictureIntent?.resolveActivity(packageManager) != null) {
                    var photoFile: File? = null
                    try {
                        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
                        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
                        photoFile = File.createTempFile("IMG_\${timeStamp}_", ".jpg", storageDir)
                    } catch (ex: IOException) {
                        // ignore
                    }
                    if (photoFile != null) {
                        cameraImageUri = FileProvider.getUriForFile(
                            this@MainActivity,
                            "com.securebox.app.fileprovider",
                            photoFile
                        )
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                    } else {
                        takePictureIntent = null
                    }
                }

                // 2. Document/File picker intent
                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }

                val intentArray: Array<Intent> = if (takePictureIntent != null) arrayOf(takePictureIntent) else emptyArray()
                val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                    putExtra(Intent.EXTRA_TITLE, "Select File or Capture Photo")
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
                }

                try {
                    fileChooserLauncher.launch(chooserIntent)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }
        }

        // WebViewClient: internal navigation & external intents
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val host = url.host ?: ""

                // Keep securebox urls inside WebView
                if (host.contains("thesecurebox.vercel.app") || host.contains("kanelijo.com") || host.contains("supabase.co")) {
                    return false
                }

                // Open external links (whatsapp, mailto, tel, etc.) with default app
                return try {
                    val intent = Intent(Intent.ACTION_VIEW, url)
                    startActivity(intent)
                    true
                } catch (e: Exception) {
                    false
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    // Show a clean offline fallback screen
                    val offlineHtml = """
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #FAF9F5; color: #1E1E1E; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; }
                                h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
                                p { font-size: 14px; color: #666; margin-bottom: 24px; max-width: 320px; }
                                button { background: #D97757; color: white; border: none; padding: 12px 28px; border-radius: 9999px; font-weight: 600; font-size: 15px; cursor: pointer; }
                            </style>
                        </head>
                        <body>
                            <h1>No Internet Connection</h1>
                            <p>Unable to connect to SecureBox servers. Please check your data connection and tap below.</p>
                            <button onclick="window.location.reload()">Retry Connection</button>
                        </body>
                        </html>
                    """.trimIndent()
                    view?.loadDataWithBaseURL(null, offlineHtml, "text/html", "UTF-8", null)
                }
            }
        }

        // Handle file downloads
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimetype)
                    addRequestHeader("User-Agent", userAgent)
                    setDescription("Downloading file from SecureBox...")
                    setTitle(URLUtil.guessFileName(url, contentDisposition, mimetype))
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        URLUtil.guessFileName(url, contentDisposition, mimetype)
                    )
                }
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "Downloading file...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                // Fallback to browser intent
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (ex: Exception) {
                    Toast.makeText(this, "Unable to download file.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }
}
`, 'utf8');

console.log('Setup completed successfully!');
