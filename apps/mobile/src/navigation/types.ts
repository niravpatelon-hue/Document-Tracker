import type { OcrOutcome } from '../ocr/types';

export type RootStackParamList = {
  Documents: undefined;
  CaptureReview: {
    pageImageUris: string[];
    phashPerPage: string[];
    ocr: OcrOutcome;
  };
  Ledger: undefined;
};
