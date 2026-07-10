import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Web preview build. Two aliases do the important work:
 *  - react-native -> react-native-web, so the RN primitives render in the DOM.
 *  - @domain -> the mobile app's pure domain layer, so this preview runs the
 *    SAME tested logic (OCR field parsing, split math, dedup, money) as the app,
 *    not a reimplementation.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@domain': path.resolve(__dirname, '../mobile/src/domain'),
    },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  define: {
    __DEV__: JSON.stringify(false),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  server: {
    // Allow importing the shared domain layer from outside this app's root.
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
});
