import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../theme';
import { Icon } from '../components/ui';
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
          <Icon name="receipt" color="#fff" size={28} />
        </View>
        <Text style={styles.title}>Document Tracker</Text>
        <Text style={styles.tagline}>Capture receipts. Track warranties. Split with friends.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={signIn}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </View>

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
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 24px -10px rgba(29,78,216,0.6)',
  } as object,
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 14, letterSpacing: -0.3 },
  tagline: { fontSize: 14, color: COLORS.subtext, marginTop: 6, textAlign: 'center', maxWidth: 260 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: COLORS.text, backgroundColor: '#fff' },
  error: { color: COLORS.danger, fontWeight: '600', marginTop: 12 },
  primary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  note: { fontSize: 12, color: COLORS.subtext, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
