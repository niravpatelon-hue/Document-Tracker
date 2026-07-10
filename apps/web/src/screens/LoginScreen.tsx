import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../theme';
import { Icon, Card, Button } from '../components/ui';
import type { WebUser } from '../store';

interface Props {
  onSignIn: (user: WebUser) => void;
}

export default function LoginScreen({ onSignIn }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function signIn() {
    setError(null);
    if (!name.trim()) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    onSignIn({ name: name.trim(), email: email.trim() });
  }

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
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="words"
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={COLORS.muted}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.buttonWrap}>
          <Button label="Get started" onPress={signIn} variant="primary" icon="arrowUp" />
        </View>
      </Card>

      <Text style={styles.note}>
        Demo sign-in — no real account is created. Your name and email are stored only in this
        browser to personalize the app.
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
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.ink,
    backgroundColor: COLORS.chip,
  },
  error: { color: COLORS.danger, fontWeight: '600', marginTop: 12 },
  buttonWrap: { marginTop: 18 },
  note: { fontSize: 12, color: COLORS.subtext, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
