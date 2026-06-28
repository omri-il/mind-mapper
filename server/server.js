// server.js — tiny Gemini proxy for Mind-Mapper's AI features.
// The browser never sees the API key; this forwards prompts to Gemini and returns
// a FLAT node list (no recursive schema — Gemini's responseSchema can't do recursion),
// which the front-end turns into a tree.
import 'dotenv/config';
import express from 'express';

const PORT = process.env.PORT || 5055;
const KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';
const ALLOWED = new Set([
  'https://omri-il.github.io',
  'https://mindmap.omri-iram.co.il',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

const app = express();
app.use(express.json({ limit: '256kb' }));

// ---- CORS (allow-listed; this is a keyed endpoint) ----
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- simple in-memory rate limit: 30 req / 5 min / IP ----
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 5 * 60 * 1000, max = 30;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

// ---- Gemini structured-output schema (FLAT, no recursion) ----
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    nodes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          parent: { type: 'STRING' },
          topic: { type: 'STRING' },
          icon: { type: 'STRING' },
        },
        required: ['id', 'parent', 'topic'],
      },
    },
  },
  required: ['title', 'nodes'],
};

const SYS_GENERATE =
  'אתה בונה מפת חשיבה בעברית. החזר רשימת צמתים שטוחה (flat). ' +
  'לכל צומת: id ייחודי (למשל "1","1.1","2"), parent = ה-id של ההורה (מחרוזת ריקה "" עבור השורש), ' +
  'topic = טקסט קצר בעברית (מילה או ביטוי קצר, לא משפט שלם), ו-icon = אימוג\'י יחיד מתאים (אופציונלי). ' +
  'חייב להיות בדיוק צומת שורש אחד עם parent="". עד 4 רמות עומק, עד 6 ילדים לכל צומת. עברית בלבד ב-topic.';

const SYS_SOURCE =
  SYS_GENERATE + ' בנה את המפה אך ורק מתוך המקור שסופק, בלי להוסיף מידע חיצוני.';

const SYS_EXPAND =
  'אתה מרחיב צומת במפת חשיבה בעברית. הצע תתי-נושאים (ילדים) לצומת הנתון. ' +
  'החזר רשימת צמתים שטוחה: צמתים עם parent="" הם ילדים ישירים של הצומת הנתון. ' +
  'id ייחודי לכל צומת, topic קצר בעברית, icon אימוג\'י אופציונלי. עד 5 ילדים ישירים, עד 2 רמות עומק. ' +
  'אל תכלול את הצומת הנתון עצמו בתשובה.';

async function callGemini(model, system, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 4096,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini ${r.status}`;
    const err = new Error(msg); err.status = r.status; err.body = data; throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('תשובה ריקה מ-Gemini');
  return JSON.parse(text);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, gemini: !!KEY, model: MODEL });
});

app.post('/api/generate', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  if (rateLimited(ip)) return res.status(429).json({ error: 'יותר מדי בקשות, נסה שוב בעוד כמה דקות' });
  if (!KEY) return res.status(503).json({ error: 'שירות ה-AI אינו מוגדר (חסר מפתח)' });

  const { mode = 'generate', prompt = '', topic = '', path = '' } = req.body || {};
  let system, userText;
  if (mode === 'source') {
    if (!prompt.trim()) return res.status(400).json({ error: 'חסר טקסט מקור' });
    system = SYS_SOURCE;
    userText = 'בנה מפת חשיבה מהמקור הבא:\n\n' + prompt.slice(0, 20000);
  } else if (mode === 'expand') {
    if (!topic.trim()) return res.status(400).json({ error: 'חסר צומת להרחבה' });
    system = SYS_EXPAND;
    userText = `הצומת להרחבה: "${topic}".` + (path ? ` נתיב מהשורש: ${path}.` : '');
  } else {
    if (!prompt.trim()) return res.status(400).json({ error: 'חסר רעיון למפה' });
    system = SYS_GENERATE;
    userText = 'בנה מפת חשיבה על הנושא: ' + prompt.slice(0, 2000);
  }

  try {
    let out;
    try { out = await callGemini(MODEL, system, userText); }
    catch (e) {
      if (e.status === 404 && FALLBACK_MODEL) out = await callGemini(FALLBACK_MODEL, system, userText);
      else throw e;
    }
    if (!out?.nodes?.length) return res.status(502).json({ error: 'לא התקבלה מפה תקינה' });
    res.json({ title: out.title || '', nodes: out.nodes });
  } catch (e) {
    console.error('generate failed:', e.message);
    res.status(502).json({ error: 'יצירת המפה נכשלה: ' + e.message });
  }
});

app.listen(PORT, () => console.log(`mind-mapper AI proxy on :${PORT} (model ${MODEL}, key ${KEY ? 'set' : 'MISSING'})`));
