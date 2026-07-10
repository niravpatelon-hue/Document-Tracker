/**
 * JS bridge to native ML Kit on-device text recognition. Used for the free tier
 * (no per-scan cost) and as the raw-text source for warranty/loyalty documents,
 * which no commercial receipt parser handles (ARCHITECTURE.md §2).
 *
 * The native module (TextRecognizerModule.kt) runs ML Kit Text Recognition v2
 * fully on-device and returns the recognized text plus a confidence estimate.
 */
import { NativeModules } from 'react-native';

export interface TextRecognitionResult {
  text: string;
  confidence: number | null;
}

interface NativeTextRecognizer {
  recognize(imageUri: string): Promise<TextRecognitionResult>;
}

const native = NativeModules.TextRecognizer as NativeTextRecognizer | undefined;

export function isOnDeviceOcrAvailable(): boolean {
  return native != null;
}

export async function recognizeText(imageUri: string): Promise<TextRecognitionResult> {
  if (!native) {
    throw new Error('TextRecognizer native module unavailable.');
  }
  return native.recognize(imageUri);
}
