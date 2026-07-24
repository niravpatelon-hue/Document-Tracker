import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import { Icon, Card } from '../components/ui';

interface Props {
  onSignIn: () => void;
  signingIn: boolean;
  error: string | null;
}

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.5 2.4-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.8-2.8 5.1-5.3 6.5l6.5 5.5C39.9 37.7 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export default function LoginScreen({ onSignIn, signingIn, error }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="split" color="#fff" size={30} strokeWidth={2.4} />
        </View>
        <Text style={styles.title}>SplitKar</Text>
        <Text style={styles.tagline}>Scan receipts. Split with friends.</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.blurb}>
          Your personal expenses stay private to your Google account. Group expenses are shared only
          with the members you invite — your own Google Drive is where it all lives.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.googleBtn} onPress={onSignIn} disabled={signingIn}>
          {signingIn ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <>
              <GoogleG size={20} />
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </>
          )}
        </Pressable>
      </Card>

      <Text style={styles.note}>
        Signing in grants this app access to a private, app-only space in your Drive (for your
        personal data) and lets it create/share folders for groups you create or join.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 22, paddingTop: 48, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 26 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 24px -10px rgba(28,194,159,0.55)',
  } as object,
  title: { fontSize: 26, fontWeight: '800', color: COLORS.ink, marginTop: 14, letterSpacing: -0.4 },
  tagline: { fontSize: 14, color: COLORS.subtext, marginTop: 6, textAlign: 'center', maxWidth: 260 },
  card: { padding: 18, borderRadius: 20 },
  blurb: { fontSize: 13.5, color: COLORS.subtext, lineHeight: 19, marginBottom: 18 },
  error: { color: COLORS.danger, fontWeight: '600', marginBottom: 12, fontSize: 13 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },
  googleBtnText: { color: COLORS.ink, fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12, color: COLORS.subtext, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
