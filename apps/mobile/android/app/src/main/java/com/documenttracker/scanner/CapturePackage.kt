package com.documenttracker.scanner

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers the capture-layer native modules. Add this package to the host app's
 * ReactNativeHost (MainApplication.getPackages()) after generating the Android
 * project with the React Native CLI. See android/README.md.
 */
class CapturePackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> =
        listOf(
            DocumentScannerModule(reactContext),
            TextRecognizerModule(reactContext),
        )

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
