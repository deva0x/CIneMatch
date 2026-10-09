const { connectLambda, getStore } = require("@netlify/blobs");

const STORE_NAME = "geddis_recommendations";
const KEY_NAME = "recommendations_data";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    "Netlify-CDN-Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store, max-age=0"
  };
}

function normalizeItemReactions(item) {
  if (!item.reactions || typeof item.reactions !== "object") {
    item.reactions = { beg: [], hyped: [], loved: [], liked: [], disliked: [], hated: [] };
  }
  for (const k of ["beg", "hyped", "loved", "liked", "disliked", "hated"]) {
    if (!Array.isArray(item.reactions[k])) {
      item.reactions[k] = [];
    }
  }
  if (!Array.isArray(item.comments)) {
    item.comments = [];
  }
  return item;
}

exports.handler = async (event, context) => {
  const headers = getCorsHeaders();

  // Handle preflight OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  try {
    connectLambda(event);
  } catch (e) {
    console.warn("connectLambda warning:", e.message);
  }

  let store = null;
  try {
    store = getStore(STORE_NAME);
  } catch (err) {
    console.error("Error initializing Netlify Blobs store:", err);
  }

  // Detect true original request path
  const originalPath = (
    event.headers["x-nf-original-pathname"] ||
    event.headers["x-forwarded-uri"] ||
    event.path ||
    ""
  ).toLowerCase();

  const method = (event.httpMethod || "GET").toUpperCase();

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  // Helper to load current recommendations
  async function loadRecs() {
    if (!store) return [];
    try {
      const data = await store.get(KEY_NAME, { type: "json" });
      if (Array.isArray(data)) {
        return data.map(normalizeItemReactions);
      }
      return [];
    } catch (err) {
      console.error("Error reading from store:", err);
      return [];
    }
  }

  // Helper to save recommendations
  async function saveRecs(recs) {
    if (!store) return false;
    try {
      await store.setJSON(KEY_NAME, recs);
      return true;
    } catch (err) {
      console.error("Error saving to store:", err);
      return false;
    }
  }

  try {
    // -------------------------------------------------------------
    // Route: GET (All recommendations)
    // -------------------------------------------------------------
    if (method === "GET") {
      const recs = await loadRecs();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(recs)
      };
    }

    // Determine POST action
    const isComment = originalPath.includes("comments") || body.comment !== undefined;
    const isReaction = !isComment && (originalPath.includes("reactions") || body.reaction !== undefined);
    const isDelete = !isComment && (method === "DELETE" || originalPath.includes("delete") || (body.id && body.userName && !body.title && !body.reaction && !body.comment));

    // -------------------------------------------------------------
    // Route: Add Comment (POST /api/comments)
    // -------------------------------------------------------------
    if (method === "POST" && isComment) {
      const recs = await loadRecs();
      const recId = body.id;
      const comment = body.comment;
      let targetItem = null;

      for (const item of recs) {
        if (item.id === recId) {
          targetItem = normalizeItemReactions(item);
          if (body.deleteCommentId) {
            targetItem.comments = targetItem.comments.filter(c => c.id !== body.deleteCommentId);
            await saveRecs(recs);
          } else if (comment && comment.text && comment.text.trim()) {
            const newCommentObj = {
              id: comment.id || `c-${Date.now()}`,
              author: (comment.author || "Friend").trim() || "Friend",
              text: comment.text.trim(),
              timestamp: comment.timestamp || "Just now"
            };
            targetItem.comments.push(newCommentObj);
            await saveRecs(recs);
          }
          break;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: !!targetItem,
          comments: targetItem ? targetItem.comments : []
        })
      };
    }

    // -------------------------------------------------------------
    // Route: Reaction Vote (POST /api/reactions)
    // -------------------------------------------------------------
    if (method === "POST" && isReaction) {
      const recs = await loadRecs();
      const recId = body.id;
      const reactionType = body.reaction; // 'beg', 'hyped', 'loved', 'liked', 'disliked', 'hated'
      const userName = (body.userName || "").trim();

      let targetItem = null;
      let found = false;

      for (const item of recs) {
        if (item.id === recId) {
          targetItem = normalizeItemReactions(item);

          if (userName && reactionType && targetItem.reactions[reactionType] !== undefined) {
            const alreadyIn = targetItem.reactions[reactionType].some(
              u => u.toLowerCase() === userName.toLowerCase()
            );

            // Remove user from all reaction buckets first
            for (const k of ["beg", "hyped", "loved", "liked", "disliked", "hated"]) {
              targetItem.reactions[k] = targetItem.reactions[k].filter(
                u => u.toLowerCase() !== userName.toLowerCase()
              );
            }

            // If not already in this bucket, add them
            if (!alreadyIn) {
              targetItem.reactions[reactionType].push(userName);
            }

            found = true;
          }
          break;
        }
      }

      if (found) {
        await saveRecs(recs);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: found,
          reactions: targetItem ? targetItem.reactions : null
        })
      };
    }

    // -------------------------------------------------------------
    // Route: Delete Recommendation (POST /api/recommendations/delete)
    // -------------------------------------------------------------
    if (isDelete) {
      const recs = await loadRecs();
      const recId = body.id || (event.queryStringParameters && event.queryStringParameters.id);
      const userName = (body.userName || (event.queryStringParameters && event.queryStringParameters.userName) || "").trim().toLowerCase();

      const initialLen = recs.length;
      const filtered = recs.filter(item => {
        const isTarget = item.id === recId;
        const isAuthor = (item.recommendedBy || "").trim().toLowerCase() === userName;
        return !(isTarget && isAuthor);
      });

      const deleted = filtered.length < initialLen;
      if (deleted) {
        await saveRecs(filtered);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: deleted, remaining: filtered.length })
      };
    }

    // -------------------------------------------------------------
    // Route: Add Recommendation (POST /api/recommendations)
    // -------------------------------------------------------------
    if (method === "POST") {
      const recs = await loadRecs();
      const recBy = (body.recommendedBy || "Friend").trim() || "Friend";
      const initialVerdict = body.initialVerdict || "loved";

      const newItem = {
        id: body.id || `rec-${Date.now()}`,
        movieId: body.movieId || "",
        tmdbId: body.tmdbId || null,
        title: body.title || "Untitled",
        year: body.year || "",
        imdbRating: body.imdbRating || "7.5",
        poster: body.poster || "",
        genres: Array.isArray(body.genres) ? body.genres : [],
        director: body.director || "",
        synopsis: body.synopsis || "",
        trailerId: body.trailerId || "",
        recommendedBy: recBy,
        note: body.note || "",
        timestamp: "Just now",
        reactions: {
          beg: initialVerdict === "beg" ? [recBy] : [],
          hyped: initialVerdict === "hyped" ? [recBy] : [],
          loved: initialVerdict === "loved" ? [recBy] : [],
          liked: initialVerdict === "liked" ? [recBy] : [],
          disliked: [],
          hated: []
        },
        comments: []
      };

      recs.unshift(newItem);
      await saveRecs(recs);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, item: newItem, count: recs.length })
      };
    }

    // Fallback 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Endpoint not found", path: originalPath, method })
    };
  } catch (error) {
    console.error("Unhandled error in Netlify Function handler:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" })
    };
  }
};
