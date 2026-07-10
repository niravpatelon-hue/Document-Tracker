package com.documenttracker.scanner

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/**
 * Native bridge over ML Kit Text Recognition v2, running fully on-device
 * (ARCHITECTURE.md §2). Used for the free OCR tier and for warranty/loyalty
 * documents, which no commercial receipt parser handles. Returns the raw text;
 * the domain field parser (domain/ocr/fieldparser.ts) extracts fields from it.
 *
 * JS surface: NativeModules.TextRecognizer.recognize(imageUri)
 * -> { text: string, confidence: number | null }
 */
class TextRecognizerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "TextRecognizer"

    @ReactMethod
    fun recognize(imageUri: String, promise: Promise) {
        try {
            val image = InputImage.fromFilePath(reactContext, Uri.parse(imageUri))
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    val map = Arguments.createMap()
                    map.putString("text", visionText.text)
                    // ML Kit v2 exposes per-element confidence but not a single
                    // document score; leave null and let the UI treat on-device
                    // extraction as lower-confidence than a cloud parse.
                    map.putNull("confidence")
                    promise.resolve(map)
                }
                .addOnFailureListener { e -> promise.reject("OCR_FAILED", e) }
        } catch (e: Exception) {
            promise.reject("OCR_FAILED", e)
        }
    }
}
