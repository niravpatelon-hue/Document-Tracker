/**
 * Chat UI for the on-device spending assistant. This screen renders only its
 * own content — the app supplies the standard header/back button — and talks
 * to `answerQuery` in '../assistant', which is a local pattern-matcher over
 * the user's own data (no network calls; see assistant.ts for details).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { COLORS } from '../theme';
import { Icon, Pill } from '../components/ui';
import type { Budget, CreditCard, Expense } from '../store';
import { answerQuery, SUGGESTED_QUESTIONS, type AssistantContext } from '../assistant';

interface Props {
  expenses: Expense[];
  budgets: Budget[];
  cards: CreditCard[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ChatScreen({ expenses, budgets, cards }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: newMessageId(),
      role: 'assistant',
      text: 'Hi! Ask me anything about your spending.',
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      const ctx: AssistantContext = { expenses, budgets, cards, todayISO: todayISO() };
      const answer = answerQuery(text, ctx);

      const userMsg: ChatMessage = { id: newMessageId(), role: 'user', text, createdAt: Date.now() };
      const replyMsg: ChatMessage = { id: newMessageId(), role: 'assistant', text: answer, createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg, replyMsg]);
      setInput('');
    },
    [expenses, budgets, cards],
  );

  const showSuggestions = messages.length <= 1;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}
          >
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>{m.text}</Text>
            </View>
          </View>
        ))}

        {showSuggestions && (
          <View style={styles.suggestRow}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <Pill key={q} label={q} onPress={() => submit(q)} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your spending..."
          placeholderTextColor={COLORS.muted}
          style={styles.textInput}
          onSubmitEditing={() => submit(input)}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => submit(input)}
          style={({ pressed }) => [styles.sendBtn, pressed ? { opacity: 0.85 } : null]}
        >
          <Icon name="arrowUp" color="#fff" size={20} strokeWidth={2.3} />
        </Pressable>
      </View>

      <Text style={styles.caption}>Answers are generated on-device from your data — nothing leaves your phone.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 12 },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAssistant: { backgroundColor: COLORS.primarySoft },
  bubbleUser: { backgroundColor: COLORS.primary },
  bubbleTextAssistant: { color: COLORS.ink, fontSize: 14.5, lineHeight: 20 },
  bubbleTextUser: { color: '#fff', fontSize: 14.5, lineHeight: 20 },

  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.chip,
    paddingHorizontal: 16,
    fontSize: 14.5,
    color: COLORS.ink,
    outlineStyle: 'none',
  } as unknown as TextStyle,
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  caption: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 11,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
});
