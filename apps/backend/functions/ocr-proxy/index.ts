/**
 * OCR proxy — Supabase Edge Function (Deno).
 *
 * This is the ONLY thing allowed to call the commercial receipt parser (Veryfi),
 * for three reasons (ARCHITECTURE.md §2, §6, §7):
 *   1. The vendor API key stays server-side, never shipped in the app bundle.
 *   2. It is the trustworthy metering choke point — a call from an unmodified
 *      client is the only call that counts against quota.
 *   3. It lets us swap the vendor (Mindee/Taggun) without a client release.
 *
 * The client (src/ocr/VeryfiClient.ts) POSTs { pages: [{ base64, mimeType }] }
 * with the user's Supabase JWT; this function authenticates, enforces the
 * free-tier cloud quota, calls the vendor, records usage, and returns the raw
 * vendor response for the client to map.
 *
 * Deploy: `supabase functions deploy ocr-proxy`. Secrets required:
 *   VERYFI_CLIENT_ID, VERYFI_API_KEY, VERYFI_USERNAME, SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY.
 */
// @ts-nocheck -- Deno runtime; type-checked in the Supabase deploy toolchain, not the RN tsconfig.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FREE_CLOUD_SCANS_PER_MONTH = 20;

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Authenticate the user from their JWT.
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response('Unauthorized', { status: 401 });
  }
  const ownerId = userData.user.id;

  // 2. Enforce the cloud quota (metering choke point).
  const month = monthKey(new Date());
  const { data: usage } = await supabase
    .from('ocr_usage')
    .select('scans_cloud, plan_tier')
    .eq('owner_id', ownerId)
    .eq('month', month)
    .maybeSingle();

  const planTier = usage?.plan_tier ?? 'free';
  const scansCloud = usage?.scans_cloud ?? 0;
  if (planTier !== 'paid' && scansCloud >= FREE_CLOUD_SCANS_PER_MONTH) {
    return new Response(
      JSON.stringify({ error: 'quota_exceeded', freeQuota: FREE_CLOUD_SCANS_PER_MONTH }),
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 3. Call the vendor (Veryfi) with the server-side credentials.
  const body = await req.json();
  const firstPage = body?.pages?.[0];
  if (!firstPage?.base64) {
    return new Response('Bad Request: no page provided', { status: 400 });
  }

  const veryfiRes = await fetch('https://api.veryfi.com/api/v8/partner/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CLIENT-ID': Deno.env.get('VERYFI_CLIENT_ID')!,
      AUTHORIZATION: `apikey ${Deno.env.get('VERYFI_USERNAME')}:${Deno.env.get('VERYFI_API_KEY')}`,
    },
    body: JSON.stringify({ file_data: firstPage.base64 }),
  });

  if (!veryfiRes.ok) {
    const detail = await veryfiRes.text();
    return new Response(JSON.stringify({ error: 'vendor_error', detail }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const parsed = await veryfiRes.json();

  // 4. Record usage (authoritative counter) — upsert-and-increment.
  await supabase.rpc('increment_ocr_cloud', { p_owner_id: ownerId, p_month: month });

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
