import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import bcrypt from 'bcrypt';
import Groq from 'groq-sdk';

const { Pool } = pg;
const app = express();

// ---------- Config ----------
const PORT = parseInt(process.env.PORT || '8080', 10);
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// CORS (lock down in prod by setting ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com")
app.use(cors({ origin: (origin, cb) => {
  if (!origin || ALLOWED.includes('*') || ALLOWED.includes(origin)) return cb(null, true);
  return cb(new Error('Not allowed by CORS'), false);
}}));
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// ---------- Groq Client ----------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ---------- DB Pool ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ---------- Utils ----------
const GUID_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
function isGuid(x) { return GUID_RE.test(x || ''); }

// Escape % and _ so LIKE is safe
function likeSafe(s) {
  return (s || '').replace(/[%_]/g, m => '\\' + m);
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------- Auth ----------
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(t, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

/* Dev token — keep in dev only. Optionally protect with DEV=true */
app.get('/api/devtoken', asyncRoute(async (req, res) => {
  if ((process.env.DEV || 'true') !== 'true') return res.status(404).end();
  const user_id = req.query.user_id;
  if (!isGuid(user_id)) return res.status(400).json({ error: 'user_id must be a GUID' });
  const token = jwt.sign({ id: user_id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
}));

// ---------- Login ----------
app.post('/api/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  // Find user by email
  const result = await pool.query(
    'SELECT * FROM app_user WHERE email=$1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const user = result.rows[0];

  // Check password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  // Generate token
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email
    }
  });
}));

// ---------- Health / Version ----------
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/version', (req, res) => res.json({ version: '1.0.0' }));

// ---------- Players ----------
// GET all players - Uses zones_json AS notes for compatibility
app.get('/api/players', auth, asyncRoute(async (req, res) => {
  const qRaw = (req.query.q || '').trim();
  const q = likeSafe(qRaw);
  const result = await pool.query(
    `SELECT
      id,
      name,
      zones_json AS notes,
      COALESCE(is_active, true) as is_active,
      updated_at
    FROM player
    WHERE user_id=$1 AND ($2='' OR name ILIKE $3)
    ORDER BY updated_at DESC
    LIMIT 200`,
    [req.user.id, q, `%${q}%`]
  );
  res.json(result.rows);
}));

// GET single player - Uses zones_json AS notes
app.get('/api/players/:id', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const result = await pool.query(
    `SELECT
      id,
      name,
      zones_json AS notes,
      COALESCE(is_active, true) as is_active,
      table_image,
      confidence,
      updated_at
    FROM player
    WHERE id=$1 AND user_id=$2`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(result.rows[0]);
}));

// POST create player - Stores notes in zones_json field
app.post('/api/players', auth, asyncRoute(async (req, res) => {
  const { name, notes } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name_required' });
  }

  const result = await pool.query(
    `INSERT INTO player(user_id, name, table_image, confidence, zones_json, is_active, updated_at)
    VALUES($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id, name, zones_json AS notes, COALESCE(is_active, true) as is_active, updated_at`,
    [req.user.id, name.trim(), null, 0, notes || '', true]
  );

  res.status(201).json(result.rows[0]);
}));

// PUT update player - Updates zones_json field (mapped to notes)
app.put('/api/players/:id', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const { notes } = req.body || {};

  const result = await pool.query(
    `UPDATE player SET zones_json=$1, updated_at=NOW()
    WHERE id=$2 AND user_id=$3
    RETURNING id`,
    [notes || '', id, req.user.id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}));

// DELETE player - SOFT DELETE (sets is_active to false)
app.delete('/api/players/:id', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const result = await pool.query(
    `UPDATE player SET is_active=false, updated_at=NOW()
    WHERE id=$1 AND user_id=$2
    RETURNING id`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}));

// OPTIONAL: Restore a soft-deleted player
app.patch('/api/players/:id/restore', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const result = await pool.query(
    `UPDATE player SET is_active=true, updated_at=NOW()
    WHERE id=$1 AND user_id=$2
    RETURNING id`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}));

// ---------- Notes ----------
app.get('/api/players/:id/notes', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const result = await pool.query(
    `SELECT *
    FROM note
    WHERE player_id=$1 AND user_id=$2
    ORDER BY created_at DESC
    LIMIT 100`,
    [id, req.user.id]
  );

  res.json(result.rows);
}));

app.post('/api/players/:id/notes', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });
  const body = (req.body?.body || '').toString().trim();
  if (!body) return res.status(400).json({ error: 'body_required' });

  const result = await pool.query(
    `INSERT INTO note(player_id, user_id, body)
    VALUES($1, $2, $3)
    RETURNING id`,
    [id, req.user.id, body]
  );

  res.status(201).json({ id: result.rows[0].id });
}));

// ---------- Export (players + notes) ----------
app.get('/api/export', auth, asyncRoute(async (req, res) => {
  const players = await pool.query(
    'SELECT * FROM player WHERE user_id=$1 ORDER BY updated_at DESC',
    [req.user.id]
  );
  const notes = await pool.query(
    'SELECT * FROM note WHERE user_id=$1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ players: players.rows, notes: notes.rows });
}));

// ---------- Cues (Quick Tap) ----------
app.get('/api/cues', auth, asyncRoute(async (req, res) => {
  const result = await pool.query(
    'SELECT id, zone, label FROM cue WHERE is_active=true ORDER BY zone, label'
  );
  res.json(result.rows);
}));

// ---------- Observations (Quick Tap) ----------
app.post('/api/players/:id/observe', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const { bucket, cue_id, free_text, hand_outcome, tilt_state, stack_situation } = req.body || {};
  const b = Number(bucket);
  if (![1, 2, 3, 4].includes(b)) {
    return res.status(400).json({ error: 'bucket must be 1 (Bluff), 2 (Strong), 3 (Semi-Bluff), or 4 (Semi-Strong)' });
  }

  const result = await pool.query(
    `INSERT INTO observation(player_id, user_id, bucket, cue_id, free_text, hand_outcome, tilt_state, stack_situation)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      id,
      req.user.id,
      b,
      cue_id ?? null,
      (free_text || '').toString().trim() || null,
      hand_outcome ?? null,
      tilt_state ?? null,
      stack_situation ?? null
    ]
  );

  res.status(201).json({ id: result.rows[0].id });
}));

app.get('/api/players/:id/observe', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const result = await pool.query(
    `SELECT o.id, o.bucket, o.cue_id, c.zone, c.label AS cue_label, o.free_text, o.created_at,
           o.hand_outcome, o.tilt_state, o.stack_situation
    FROM observation o
    LEFT JOIN cue c ON c.id = o.cue_id
    WHERE o.player_id=$1 AND o.user_id=$2
    ORDER BY o.created_at DESC`,
    [id, req.user.id]
  );

  res.json(result.rows);
}));

// Summary endpoint - returns counts for all 4 bucket types with snake_case keys
app.get('/api/players/:id/observe/summary', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const result = await pool.query(
    `SELECT bucket, COUNT(*) AS cnt
    FROM observation
    WHERE player_id=$1 AND user_id=$2
    GROUP BY bucket`,
    [id, req.user.id]
  );

  const m = Object.fromEntries(result.rows.map(x => [x.bucket, parseInt(x.cnt)]));

  // Return with snake_case keys to match frontend expectations
  res.json({
    bluff: m[1] || 0,
    strong: m[2] || 0,
    semi_bluff: m[3] || 0,
    semi_strong: m[4] || 0
  });
}));

// Analysis endpoint - returns percentages and counts with snake_case keys
app.post('/api/players/:id/observe/analyze', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const { cue_ids, hand_outcome, tilt_state, stack_situation } = req.body || {};
  if (!Array.isArray(cue_ids) || cue_ids.length === 0) {
    return res.status(400).json({ error: 'cue_ids array required' });
  }

  // Build WHERE clause with optional context filters
  let whereConditions = [
    'player_id=$1',
    'user_id=$2',
    `cue_id = ANY($3)`
  ];

  const params = [id, req.user.id, cue_ids.map(id => parseInt(id))];
  let paramIndex = 4;

  // Add context filters if provided
  if (hand_outcome !== undefined && hand_outcome !== null) {
    whereConditions.push(`hand_outcome=$${paramIndex}`);
    params.push(hand_outcome);
    paramIndex++;
  }
  if (tilt_state !== undefined && tilt_state !== null) {
    whereConditions.push(`tilt_state=$${paramIndex}`);
    params.push(tilt_state);
    paramIndex++;
  }
  if (stack_situation !== undefined && stack_situation !== null) {
    whereConditions.push(`stack_situation=$${paramIndex}`);
    params.push(stack_situation);
    paramIndex++;
  }

  // Get historical observations for this player matching criteria
  const result = await pool.query(
    `SELECT bucket, COUNT(*) AS cnt
    FROM observation
    WHERE ${whereConditions.join(' AND ')}
    GROUP BY bucket`,
    params
  );

  // Calculate totals and percentages
  const bucketCounts = Object.fromEntries(result.rows.map(x => [x.bucket, parseInt(x.cnt)]));
  const total = Object.values(bucketCounts).reduce((sum, cnt) => sum + cnt, 0);

  // Build context message
  let contextMsg = '';
  if (hand_outcome !== undefined && hand_outcome !== null) {
    const outcomes = ['Unknown', 'Won', 'Lost', 'Folded'];
    contextMsg += ` when ${outcomes[hand_outcome] || 'Unknown'}`;
  }
  if (tilt_state !== undefined && tilt_state !== null) {
    const tilts = ['Normal', 'Slight tilt', 'On tilt', 'Steaming'];
    contextMsg += ` while ${tilts[tilt_state] || 'Unknown'}`;
  }
  if (stack_situation !== undefined && stack_situation !== null) {
    const stacks = ['Unknown', 'Short', 'Medium', 'Deep'];
    contextMsg += ` with ${stacks[stack_situation] || 'Unknown'} stack`;
  }

  if (total === 0) {
    return res.json({
      message: `No historical data for these behaviors${contextMsg}`,
      total: 0,
      percentages: { bluff: 0, semi_bluff: 0, strong: 0, semi_strong: 0 },
      counts: { bluff: 0, semi_bluff: 0, strong: 0, semi_strong: 0 }
    });
  }

  // Return with snake_case keys to match frontend expectations
  const percentages = {
    bluff: Math.round((bucketCounts[1] || 0) / total * 100),
    strong: Math.round((bucketCounts[2] || 0) / total * 100),
    semi_bluff: Math.round((bucketCounts[3] || 0) / total * 100),
    semi_strong: Math.round((bucketCounts[4] || 0) / total * 100)
  };

  const counts = {
    bluff: bucketCounts[1] || 0,
    strong: bucketCounts[2] || 0,
    semi_bluff: bucketCounts[3] || 0,
    semi_strong: bucketCounts[4] || 0
  };

  res.json({
    total,
    percentages,
    counts,
    context_message: contextMsg ? `Filtered${contextMsg}` : null
  });
}));

app.delete('/api/players/:id/observe/:obsId', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  const obsId = req.params.obsId;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid player id' });

  const result = await pool.query(
    `DELETE FROM observation
    WHERE id=$1 AND player_id=$2 AND user_id=$3
    RETURNING id`,
    [obsId, id, req.user.id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}));

// AI Analysis endpoint
app.post('/api/players/:id/ai-analyze', auth, asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!isGuid(id)) return res.status(400).json({ error: 'invalid id' });

  const { player, observations, summary } = req.body;

  if (!player) {
    return res.status(400).json({ error: 'player data required' });
  }

  try {
    // Build a comprehensive prompt for the AI
    const bucketLabels = { 1: 'BLUFF', 2: 'STRONG', 3: 'SEMI-BLUFF', 4: 'SEMI-STRONG' };
    const outcomeLabels = { 1: 'Won', 2: 'Lost', 3: 'Folded' };
    const tiltLabels = { 0: 'Normal', 1: 'Slight Tilt', 2: 'On Tilt', 3: 'Steaming' };
    const stackLabels = { 1: 'Short', 2: 'Medium', 3: 'Deep' };

    let prompt = `You are an expert poker analyst. Analyze this player's behavior patterns and provide actionable insights.\n\n`;
    prompt += `Player: ${player.name}\n`;
    prompt += `Notes: ${player.notes || 'None'}\n\n`;

    prompt += `Behavior Summary:\n`;
    prompt += `- BLUFF observations: ${summary.bluff || 0}\n`;
    prompt += `- STRONG observations: ${summary.strong || 0}\n`;
    prompt += `- SEMI-BLUFF observations: ${summary.semi_bluff || 0}\n`;
    prompt += `- SEMI-STRONG observations: ${summary.semi_strong || 0}\n`;
    prompt += `Total observations: ${(summary.bluff || 0) + (summary.strong || 0) + (summary.semi_bluff || 0) + (summary.semi_strong || 0)}\n\n`;

    if (observations && observations.length > 0) {
      prompt += `Detailed Observations:\n`;
      observations.slice(0, 50).forEach((obs, idx) => {
        prompt += `${idx + 1}. ${bucketLabels[obs.bucket]} - ${obs.cue_label || 'General observation'}`;
        if (obs.hand_outcome) prompt += ` [Hand: ${outcomeLabels[obs.hand_outcome]}]`;
        if (obs.tilt_state !== null && obs.tilt_state !== undefined) prompt += ` [Tilt: ${tiltLabels[obs.tilt_state]}]`;
        if (obs.stack_situation) prompt += ` [Stack: ${stackLabels[obs.stack_situation]}]`;
        if (obs.free_text) prompt += ` - ${obs.free_text}`;
        prompt += `\n`;
      });
    }

    prompt += `\nProvide:\n`;
    prompt += `1. A comprehensive analysis of their playing style and decision patterns\n`;
    prompt += `2. Key tendencies and patterns you've identified\n`;
    prompt += `3. Specific exploitable weaknesses and how to exploit them\n`;
    prompt += `\nIMPORTANT: You MUST respond ONLY with valid JSON in this exact format:\n`;
    prompt += `{\n`;
    prompt += `  "analysis": "your comprehensive analysis here",\n`;
    prompt += `  "tendencies": ["tendency 1", "tendency 2", "tendency 3"],\n`;
    prompt += `  "exploits": ["exploit 1", "exploit 2", "exploit 3"]\n`;
    prompt += `}\n`;
    prompt += `Do not include any text before or after the JSON. Only return the JSON object.\n`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an expert poker analyst with deep knowledge of player profiling, behavioral analysis, and game theory optimal play. You MUST respond only with valid JSON. No additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    let responseContent = completion.choices[0].message.content;

    // Try to extract JSON if the response has extra text
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseContent = jsonMatch[0];
    }

    const result = JSON.parse(responseContent);
    res.json(result);

  } catch (err) {
    console.error('AI Analysis error:', err);
    console.error('Error details:', {
      message: err.message,
      status: err.status,
      response: err.response?.data
    });
    res.status(500).json({
      error: 'ai_analysis_failed',
      details: err.message,
      statusCode: err.status
    });
  }
}));

// ---------- Error handler ----------
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log('API on :' + PORT);
});
