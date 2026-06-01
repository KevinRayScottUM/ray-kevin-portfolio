const DEFAULT_LIKES = Object.freeze({
  "why-harness-engineering-matters": 12,
  "retrieval-is-not-grounding": 9,
  "medical-ai-needs-explainable-failure": 8,
  "agent-evaluation-beyond-task-success": 7,
  "multimodal-interfaces-for-robotics": 6,
});

const POST_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,120}$/;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

function getDatabase(env) {
  return (env && (env.DB || env.BLOG_DB || env.LIKES_DB)) || null;
}

function normalizePostId(postId) {
  if (typeof postId !== "string") return "";
  return postId.trim().toLowerCase();
}

function isValidPostId(postId) {
  return POST_ID_PATTERN.test(postId);
}

function parsePostIds(request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("posts") || "";
  return Array.from(new Set(raw.split(",").map(normalizePostId).filter(isValidPostId))).slice(0, 50);
}

async function ensureSchema(db) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS blog_likes (post_id TEXT PRIMARY KEY, likes INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT)"
    )
    .run();
}

async function ensurePostRow(db, postId) {
  const initialLikes = Number(DEFAULT_LIKES[postId] || 0);
  await db
    .prepare(
      "INSERT OR IGNORE INTO blog_likes (post_id, likes, created_at, updated_at) VALUES (?1, ?2, datetime('now'), datetime('now'))"
    )
    .bind(postId, initialLikes)
    .run();
}

async function getPostLikes(db, postId) {
  const row = await db
    .prepare("SELECT likes FROM blog_likes WHERE post_id = ?1")
    .bind(postId)
    .first();

  return Number(row ? row.likes : 0);
}

export async function onRequestGet(context) {
  try {
    const db = getDatabase(context.env);
    if (!db) {
      return json({ error: "D1 binding missing. Bind a D1 database as DB, BLOG_DB, or LIKES_DB." }, 503);
    }

    const postIds = parsePostIds(context.request);
    if (postIds.length === 0) return json({ counts: {} });

    await ensureSchema(db);

    const counts = {};
    for (const postId of postIds) {
      await ensurePostRow(db, postId);
      counts[postId] = await getPostLikes(db, postId);
    }

    return json({ counts });
  } catch (error) {
    return json({ error: "Likes API failed.", detail: error && error.message ? error.message : String(error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = getDatabase(context.env);
    if (!db) {
      return json({ error: "D1 binding missing. Bind a D1 database as DB, BLOG_DB, or LIKES_DB." }, 503);
    }

    let body;
    try {
      body = await context.request.json();
    } catch (_error) {
      return json({ error: "Request body must be JSON." }, 400);
    }

    const postId = normalizePostId(body && body.postId);
    if (!isValidPostId(postId)) {
      return json({ error: "Invalid postId." }, 400);
    }

    await ensureSchema(db);
    await ensurePostRow(db, postId);
    await db
      .prepare("UPDATE blog_likes SET likes = likes + 1, updated_at = datetime('now') WHERE post_id = ?1")
      .bind(postId)
      .run();

    const likes = await getPostLikes(db, postId);
    return json({ postId, likes });
  } catch (error) {
    return json({ error: "Likes API failed.", detail: error && error.message ? error.message : String(error) }, 500);
  }
}
