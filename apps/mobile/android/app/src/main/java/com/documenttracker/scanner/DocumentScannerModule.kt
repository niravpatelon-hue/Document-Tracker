package com.documenttracker.scanner

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult

/**
 * Native bridge over Google's ML Kit Document Scanner (ARCHITECTURE.md §2). It
 * provides edge detection, perspective correction, and multi-page capture out of
 * the box via Google Play Services, at zero SDK cost. Returns file:// URIs for
 * the corrected page images plus an optional combined PDF.
 *
 * JS surface: NativeModules.DocumentScanner.scan({ pageLimit, allowGalleryImport })
 * -> { pageImageUris: string[], pdfUri?: string }
 */
class DocumentScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = "DocumentScanner"

    @ReactMethod
    fun scan(options: ReadableMap, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity to launch the scanner from")
            return
        }
        if (pendingPromise != null) {
            promise.reject("IN_PROGRESS", "A scan is already in progress")
            return
        }

        val pageLimit = if (options.hasKey("pageLimit")) options.getInt("pageLimit") else 10
        val allowGallery =
            if (options.hasKey("allowGalleryImport")) options.getBoolean("allowGalleryImport") else true

        val scannerOptions = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(allowGallery)
            .setPageLimit(pageLimit)
            .setResultFormats(
                GmsDocumentScannerOptions.RESULT_FORMAT_JPEG,
                GmsDocumentScannerOptions.RESULT_FORMAT_PDF,
            )
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()

        pendingPromise = promise
        GmsDocumentScanning.getClient(scannerOptions)
            .getStartScanIntent(activity)
            .addOnSuccessListener { intentSender: IntentSender ->
                try {
                    activity.startIntentSenderForResult(intentSender, REQUEST_CODE, null, 0, 0, 0)
                } catch (e: IntentSender.SendIntentException) {
                    rejectPending("START_FAILED", e)
                }
            }
            .addOnFailureListener { e ->
                // Most commonly: device without Google Play Services (ARCHITECTURE.md §14).
                rejectPending("SCANNER_UNAVAILABLE", e)
            }
    }

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
        if (requestCode != REQUEST_CODE) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode == Activity.RESULT_CANCELED) {
            promise.reject("CANCELLED", "User cancelled the scan")
            return
        }

        val result = GmsDocumentScanningResult.fromActivityResultIntent(data)
        if (result == null) {
            promise.reject("NO_RESULT", "Scanner returned no result")
            return
        }

        val pages = Arguments.createArray()
        result.pages?.forEach { page -> pages.pushString(page.imageUri.toString()) }

        val map = Arguments.createMap()
        map.putArray("pageImageUris", pages)
        result.pdf?.let { pdf -> map.putString("pdfUri", pdf.uri.toString()) }
        promise.resolve(map)
    }

    override fun onNewIntent(intent: Intent?) {
        // No-op: the scanner uses startIntentSenderForResult, not a new intent.
    }

    private fun rejectPending(code: String, e: Throwable) {
        pendingPromise?.reject(code, e)
        pendingPromise = null
    }

    companion object {
        private const val REQUEST_CODE = 0xD0C
    }
}
