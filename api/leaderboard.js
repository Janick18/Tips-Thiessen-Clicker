/**
 * Shared leaderboard for Tips Thiessen Clicker.
 *
 * Required Vercel env vars (either pair works):
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   or KV_REST_API_URL + KV_REST_API_TOKEN  (Vercel KV)
 *
 * Create a free Redis DB at https://console.upstash.com (or Vercel Storage > KV),
 * then paste both values in the Vercel project: Settings > Environment Variables.
 */

const SCORE_KEY = "tips-leaderboard:scores";
const PLAYER_PREFIX = "tips-leaderboard:player:";
const TOP_N = 50;
const MAX_NAME = 20;

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

async function redisPipeline(commands) {
  const config = redisConfig();
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Redis ${response.status}: ${text.slice(0, 200)}`);
  }
  const payload = await response.json();
  return payload.map((entry) => (entry && Object.prototype.hasOwnProperty.call(entry, "result") ? entry.result : entry));
}

function sanitizeName(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

function sanitizeId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : "";
}

function parsePlayer(raw, id, score) {
  let data = {};
  if (raw && typeof raw === "string") {
    try { data = JSON.parse(raw); } catch { data = {}; }
  } else if (raw && typeof raw === "object") {
    data = raw;
  }
  const totalEarned = Number(data.totalEarned);
  return {
    id,
    name: sanitizeName(data.name) || "Anonymous",
    totalEarned: Number.isFinite(totalEarned) ? totalEarned : Number(score) || 0,
    progress: Math.max(0, Math.min(100, Number(data.progress) || 0)),
    milestone: String(data.milestone || "Getting started").slice(0, 40),
    activeSeconds: Math.max(0, Number(data.activeSeconds) || 0),
    completed: Boolean(data.completed)
  };
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function handleGet(req, res) {
  const playerId = sanitizeId(new URL(req.url, "http://localhost").searchParams.get("id"));
  const range = await redisPipeline([["ZREVRANGE", SCORE_KEY, "0", String(TOP_N - 1), "WITHSCORES"]]);
  const ranked = range[0] || [];
  const ids = [];
  const scores = [];
  for (let i = 0; i < ranked.length; i += 2) {
    ids.push(ranked[i]);
    scores.push(ranked[i + 1]);
  }

  let profiles = [];
  if (ids.length) {
    const keys = ids.map((id) => `${PLAYER_PREFIX}${id}`);
    const got = await redisPipeline([["MGET", ...keys]]);
    profiles = got[0] || [];
  }

  const players = ids.map((id, index) => ({
    rank: index + 1,
    ...parsePlayer(profiles[index], id, scores[index])
  }));

  let you = players.find((row) => row.id === playerId) || null;
  if (playerId && !you) {
    const extra = await redisPipeline([
      ["ZREVRANK", SCORE_KEY, playerId],
      ["GET", `${PLAYER_PREFIX}${playerId}`],
      ["ZSCORE", SCORE_KEY, playerId]
    ]);
    if (extra[0] !== null && extra[0] !== undefined) {
      you = { rank: Number(extra[0]) + 1, ...parsePlayer(extra[1], playerId, extra[2]) };
    }
  }

  json(res, 200, { configured: true, players, you });
}

async function handlePost(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    json(res, 400, { error: "Invalid JSON" });
    return;
  }

  const id = sanitizeId(body.id);
  const name = sanitizeName(body.name);
  const totalEarned = Number(body.totalEarned);
  if (!id || !name || !Number.isFinite(totalEarned) || totalEarned < 0 || totalEarned > 1e30) {
    json(res, 400, { error: "Need a valid id, name, and score" });
    return;
  }

  const existing = await redisPipeline([
    ["GET", `${PLAYER_PREFIX}${id}`],
    ["ZSCORE", SCORE_KEY, id]
  ]);
  const previous = parsePlayer(existing[0], id, existing[1]);
  const keptScore = Math.max(previous.totalEarned || 0, totalEarned);

  const record = {
    name,
    totalEarned: keptScore,
    progress: Math.max(0, Math.min(100, Number(body.progress) || 0)),
    milestone: String(body.milestone || previous.milestone || "Getting started").slice(0, 40),
    activeSeconds: Math.max(previous.activeSeconds || 0, Number(body.activeSeconds) || 0),
    completed: Boolean(body.completed || previous.completed),
    updatedAt: Date.now()
  };

  await redisPipeline([
    ["ZADD", SCORE_KEY, String(keptScore), id],
    ["SET", `${PLAYER_PREFIX}${id}`, JSON.stringify(record)]
  ]);

  json(res, 200, { ok: true, player: { id, ...record } });
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!redisConfig()) {
    json(res, 503, {
      configured: false,
      players: [],
      error: "Leaderboard is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel."
    });
    return;
  }

  try {
    if (req.method === "GET") {
      await handleGet(req, res);
      return;
    }
    if (req.method === "POST") {
      await handlePost(req, res);
      return;
    }
    json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    json(res, 500, { error: "Leaderboard failed", detail: String(error.message || error) });
  }
};
