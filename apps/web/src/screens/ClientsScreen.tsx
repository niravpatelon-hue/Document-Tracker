import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computeInvoiceTotals, effectiveStatus } from '@domain/business/invoicing';
import { formatINR } from '@domain/money';
import { COLORS } from '../theme';
import { Avatar, Card, Icon, SectionLabel } from '../components/ui';
import type { WebClient, WebInvoice } from '../store';

interface Props {
  clients: WebClient[];
  invoices: WebInvoice[];
  onCreate: (c: { name: string; gstin?: string; email?: string; phone?: string; stateName?: string }) => void;
  onDelete: (id: string) => void;
}

const TODAY = new Date().toISOString().slice(0, 10);

function outstandingFor(clientId: string, invoices: WebInvoice[]): number {
  return invoices
    .filter((inv) => inv.clientId === clientId && effectiveStatus(inv, TODAY) !== 'paid')
    .reduce((sum, inv) => sum + computeInvoiceTotals(inv.items).totalCents, 0);
}

export default function ClientsScreen({ clients, invoices, onCreate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stateName, setStateName] = useState('');

  const sorted = useMemo(() => [...clients].sort((a, b) => b.createdAt - a.createdAt), [clients]);

  function reset() {
    setName('');
    setGstin('');
    setEmail('');
    setPhone('');
    setStateName('');
  }

  function save() {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      gstin: gstin.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      stateName: stateName.trim() || undefined,
    });
    reset();
    setAdding(false);
  }

  function confirmDelete(id: string, clientName: string) {
    if (window.confirm(`Delete client "${clientName}"? This cannot be undone.`)) {
      onDelete(id);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {adding ? (
        <Card>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Client or company name" />
          <Text style={styles.label}>GSTIN (optional)</Text>
          <TextInput style={styles.input} value={gstin} onChangeText={setGstin} placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />
          <Text style={styles.label}>Email (optional)</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="name@company.com" keyboardType="email-address" />
          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
          <Text style={styles.label}>State (optional)</Text>
          <TextInput style={styles.input} value={stateName} onChangeText={setStateName} placeholder="Maharashtra" />
          <Pressable style={[styles.primary, !name.trim() && styles.primaryDisabled]} onPress={save} disabled={!name.trim()}>
            <Text style={styles.primaryText}>Save client</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              reset();
              setAdding(false);
            }}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Card>
      ) : (
        <Pressable style={styles.primary} onPress={() => setAdding(true)}>
          <Icon name="plus" color="#fff" size={18} />
          <Text style={styles.primaryText}>New client</Text>
        </Pressable>
      )}

      <SectionLabel>Clients</SectionLabel>
      {sorted.length === 0 ? (
        <Card><Text style={styles.empty}>No clients yet.</Text></Card>
      ) : (
        sorted.map((c) => {
          const outstanding = outstandingFor(c.id, invoices);
          return (
            <Card key={c.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={c.name} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={styles.clientMeta}>
                  {c.gstin ? c.gstin : 'No GSTIN'}
                  {c.stateName ? ` · ${c.stateName}` : ''}
                </Text>
                <Text style={styles.outstanding}>
                  {outstanding > 0 ? `Outstanding ${formatINR(outstanding)}` : 'No outstanding balance'}
                </Text>
              </View>
              <Pressable onPress={() => confirmDelete(c.id, c.name)} hitSlop={8}>
                <Icon name="trash" color={COLORS.danger} size={18} />
              </Pressable>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { padding: 16, paddingBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#fff',
  },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { color: COLORS.subtext, textAlign: 'center', marginTop: 12, fontSize: 15 },
  empty: { color: COLORS.subtext },
  clientName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  clientMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  outstanding: { fontSize: 12, color: COLORS.text, fontWeight: '600', marginTop: 4 },
});
