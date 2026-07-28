// יצירת קשר — טופס פנייה פשוט מהאפליקציה (מערכת התקציב) אל שרה, בעל המערכת.
// פונקציה ציבורית (ללא JWT) ששולחת מייל דרך Resend. אין כאן שמירה ב-DB —
// רק שליחת מייל; אם המייל נכשל מוחזרת שגיאה ברורה כדי שהטופס יידע להציג הודעה.
//
// פריסה:
//   npx supabase functions deploy contact-support --project-ref <ref> --no-verify-jwt
//   npx supabase secrets set RESEND_API_KEY=re_... --project-ref <ref>
//   (אופציונלי) npx supabase secrets set SUPPORT_EMAIL=sarah@reshetch.org.il --project-ref <ref>

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const MAX_MESSAGE_LEN = 5000;
const MAX_SUBJECT_LEN = 150;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 50) : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT_LEN) : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const honeypot = typeof body.honeypot === 'string' ? body.honeypot.trim() : '';

  // מלכודת בוטים שקטה — אם השדה הנסתר מולא, מחזירים "הצלחה" בלי לשלוח כלום
  if (honeypot) return json({ ok: true });

  if (!subject) return json({ error: 'נא למלא נושא לפנייה' }, 400);
  if (!message) return json({ error: 'נא למלא הודעה' }, 400);
  if (message.length > MAX_MESSAGE_LEN) return json({ error: 'ההודעה ארוכה מדי' }, 400);
  if (!email && !phone) return json({ error: 'נא למלא אימייל או טלפון ליצירת קשר' }, 400);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('contact-support: missing RESEND_API_KEY secret');
    return json({ error: 'שירות השליחה אינו מוגדר כרגע — נסי שוב מאוחר יותר' }, 500);
  }

  const to = Deno.env.get('SUPPORT_EMAIL') ?? 'sarah@reshetch.org.il';

  const sentAt = new Date().toLocaleString('he-IL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  });

  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:6px 10px;font-weight:bold;white-space:nowrap;vertical-align:top;color:#4B2E83;">${label}</td>
        <td style="padding:6px 10px;">${value}</td>
      </tr>`;

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;text-align:right;">
      <h2 style="color:#4B2E83;">פנייה חדשה — מערכת התקציב</h2>
      <table style="border-collapse:collapse;width:100%;max-width:520px;">
        ${row('נושא:', escapeHtml(subject))}
        ${row('תאריך:', escapeHtml(sentAt))}
        ${row('שם:', escapeHtml(name || 'לא צוין'))}
        ${row('טלפון לחזרה:', escapeHtml(phone || 'לא צוין'))}
        ${row('אימייל:', escapeHtml(email || 'לא צוין'))}
      </table>
      <hr style="border:none;border-top:1px solid #E2DCF0;margin:16px 0;" />
      <p style="font-weight:bold;color:#4B2E83;margin-bottom:4px;">הודעה:</p>
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: 'מערכת התקציב <onboarding@resend.dev>',
        to: [to],
        ...(email ? { reply_to: email } : {}),
        subject: `פנייה חדשה — מערכת התקציב: ${subject}`,
        html,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error(`contact-support: resend ${r.status} ${errText}`);
      return json({ error: 'שליחת ההודעה נכשלה — נסי שוב' }, 500);
    }
  } catch (e) {
    console.error(`contact-support: ${e}`);
    return json({ error: 'שליחת ההודעה נכשלה — נסי שוב' }, 500);
  }

  return json({ ok: true });
});
