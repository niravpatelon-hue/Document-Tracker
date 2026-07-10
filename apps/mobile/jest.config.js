/**
 * Phase 1 test config.
 *
 * The domain layer (src/domain) is pure TypeScript with zero React Native
 * imports, so it runs under a plain ts-jest + node setup — no emulator, no
 * native toolchain. This is the layer where the correctness-critical logic
 * lives (split math, settle-up minimization, dedup, status/reminder dates,
 * OCR field parsing), so it is the layer we test hardest.
 *
 * React Native component/integration tests (added in a later phase) should use
 * the "react-native" jest preset and live under their own config/project so
 * they don't pull the native transform into these pure-logic runs.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/domain'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true } }],
  },
};
