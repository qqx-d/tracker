// Daily Check-in Tracker — Deno Deploy Backend
// Uses Deno KV for persistent storage

const kv = await Deno.openKv();

// --- Helpers ---

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function generateId() {
  return crypto.randomUUID();
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const values = new Uint8Array(6);
  crypto.getRandomValues(values);
  for (const v of values) {
    code += chars[v % chars.length];
  }
  return code;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// Get dates from startDate to today
function dateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// --- Route handlers ---

async function handleRegister(body) {
  const { username } = body;
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return error("Username is required");
  }
  if (username.length > 20) {
    return error("Username too long");
  }

  const id = generateId();
  const user = { id, username: username.trim(), createdAt: new Date().toISOString() };
  await kv.set(["users", id], user);
  return json(user);
}

async function handleGetUser(userId) {
  const result = await kv.get(["users", userId]);
  if (!result.value) return error("User not found", 404);
  return json(result.value);
}

async function handleCreateLobby(body) {
  const { name, ownerId } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return error("Lobby name is required");
  }
  if (name.length > 40) {
    return error("Name too long");
  }
  if (!ownerId) return error("Owner ID is required");

  const ownerResult = await kv.get(["users", ownerId]);
  if (!ownerResult.value) return error("User not found", 404);

  const id = generateId();
  const code = generateCode();
  const lobby = {
    id,
    name: name.trim(),
    code,
    ownerId,
    memberIds: [ownerId],
    createdAt: new Date().toISOString(),
  };

  await kv.atomic()
    .set(["lobbies", id], lobby)
    .set(["lobby_codes", code], id)
    .set(["user_lobbies", ownerId, id], true)
    .commit();

  return json(lobby);
}

async function handleJoinLobby(body) {
  const { code, userId } = body;
  if (!code || !userId) return error("Code and userId are required");

  const codeResult = await kv.get(["lobby_codes", code.toUpperCase()]);
  if (!codeResult.value) return error("Invalid code", 404);

  const lobbyId = codeResult.value;
  const lobbyResult = await kv.get(["lobbies", lobbyId]);
  if (!lobbyResult.value) return error("Lobby not found", 404);

  const userResult = await kv.get(["users", userId]);
  if (!userResult.value) return error("User not found", 404);

  const lobby = lobbyResult.value;
  if (!lobby.memberIds.includes(userId)) {
    lobby.memberIds.push(userId);
    await kv.atomic()
      .set(["lobbies", lobbyId], lobby)
      .set(["user_lobbies", userId, lobbyId], true)
      .commit();
  }

  return json(lobby);
}

async function handleGetLobby(lobbyId) {
  const result = await kv.get(["lobbies", lobbyId]);
  if (!result.value) return error("Lobby not found", 404);

  const lobby = result.value;
  // Resolve member usernames
  const members = [];
  for (const mId of lobby.memberIds) {
    const u = await kv.get(["users", mId]);
    if (u.value) {
      members.push({ id: u.value.id, username: u.value.username });
    }
  }

  return json({ ...lobby, members });
}

async function handleDeleteLobby(lobbyId, userId) {
  if (!userId) return error("userId is required", 400);

  const lobbyResult = await kv.get(["lobbies", lobbyId]);
  if (!lobbyResult.value) return error("Lobby not found", 404);

  const lobby = lobbyResult.value;
  if (lobby.ownerId !== userId) {
    return error("Only lobby owner can delete lobby", 403);
  }

  // Remove lobby from each member's list.
  for (const memberId of lobby.memberIds || []) {
    await kv.delete(["user_lobbies", memberId, lobbyId]);
  }

  // Remove all check-ins for this lobby.
  const checkinsIter = kv.list({ prefix: ["checkins", lobbyId] });
  for await (const entry of checkinsIter) {
    await kv.delete(entry.key);
  }

  await kv.delete(["lobbies", lobbyId]);
  await kv.delete(["lobby_codes", lobby.code]);

  return json({ ok: true, lobbyId });
}

async function handleLeaveLobby(body) {
  const { lobbyId, userId } = body;
  if (!lobbyId || !userId) return error("lobbyId and userId are required", 400);

  const lobbyResult = await kv.get(["lobbies", lobbyId]);
  if (!lobbyResult.value) return error("Lobby not found", 404);

  const lobby = lobbyResult.value;
  if (lobby.ownerId === userId) {
    return error("Owner cannot leave lobby. Delete lobby instead.", 400);
  }
  if (!lobby.memberIds.includes(userId)) {
    return error("User is not in this lobby", 404);
  }

  lobby.memberIds = lobby.memberIds.filter((id) => id !== userId);

  await kv.set(["lobbies", lobbyId], lobby);
  await kv.delete(["user_lobbies", userId, lobbyId]);

  const checkinsIter = kv.list({ prefix: ["checkins", lobbyId] });
  for await (const entry of checkinsIter) {
    if (entry.key[3] === userId) {
      await kv.delete(entry.key);
    }
  }

  return json({ ok: true, lobbyId, userId });
}

async function handleGetUserLobbies(userId) {
  const lobbies = [];
  const iter = kv.list({ prefix: ["user_lobbies", userId] });
  for await (const entry of iter) {
    const lobbyId = entry.key[2];
    const lobbyResult = await kv.get(["lobbies", lobbyId]);
    if (lobbyResult.value) {
      const lobby = lobbyResult.value;
      // Resolve members
      const members = [];
      for (const mId of lobby.memberIds) {
        const u = await kv.get(["users", mId]);
        if (u.value) members.push({ id: u.value.id, username: u.value.username });
      }
      lobbies.push({ ...lobby, members });
    }
  }
  return json({ lobbies });
}

async function handleCheckin(body) {
  const { lobbyId, userId } = body;
  if (!lobbyId || !userId) return error("lobbyId and userId required");

  const lobbyResult = await kv.get(["lobbies", lobbyId]);
  if (!lobbyResult.value) return error("Lobby not found", 404);

  if (!lobbyResult.value.memberIds.includes(userId)) {
    return error("Not a member", 403);
  }

  const date = todayStr();
  const key = ["checkins", lobbyId, date, userId];
  const existing = await kv.get(key);
  if (existing.value) {
    return json({ message: "Already checked in", checkin: existing.value });
  }

  const checkin = { lobbyId, userId, date, checkedAt: new Date().toISOString() };
  await kv.set(key, checkin);
  return json(checkin);
}

async function handleGetCheckins(lobbyId, date) {
  if (!date) date = todayStr();

  const checkins = [];
  const iter = kv.list({ prefix: ["checkins", lobbyId, date] });
  for await (const entry of iter) {
    checkins.push(entry.value);
  }
  return json({ checkins });
}

async function handleGetStats(lobbyId) {
  const lobbyResult = await kv.get(["lobbies", lobbyId]);
  if (!lobbyResult.value) return error("Lobby not found", 404);

  const lobby = lobbyResult.value;
  const today = todayStr();
  const startDate = lobby.createdAt.split("T")[0];

  // Get last 14 days from today (or from creation, whichever is later)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  const rangeStart = startDate > fourteenDaysAgo.toISOString().split("T")[0]
    ? startDate
    : fourteenDaysAgo.toISOString().split("T")[0];

  const dates = dateRange(rangeStart, today);

  // Collect checkins for all dates
  const checkinMap = new Map(); // `${date}:${userId}` -> true
  for (const date of dates) {
    const iter = kv.list({ prefix: ["checkins", lobbyId, date] });
    for await (const entry of iter) {
      if (entry.value) {
        checkinMap.set(`${date}:${entry.value.userId}`, true);
      }
    }
  }

  // Build member stats
  const members = [];
  for (const mId of lobby.memberIds) {
    const u = await kv.get(["users", mId]);
    const username = u.value?.username || "Unknown";

    const days = dates.map((date) => ({
      date,
      checked: checkinMap.has(`${date}:${mId}`),
    }));

    // Calculate streak
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      // Skip today if not yet checked (day isn't over)
      if (i === days.length - 1 && days[i].date === today && !days[i].checked) {
        continue;
      }
      if (days[i].checked) {
        streak++;
      } else {
        break;
      }
    }

    members.push({ id: mId, username, days, streak });
  }

  return json({ lobbyId, dates, members });
}

// --- Router ---

async function handleRequest(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    // Auth
    if (method === "POST" && path === "/api/auth/register") {
      return handleRegister(await req.json());
    }
    if (method === "GET" && path.startsWith("/api/auth/user/")) {
      const userId = decodeURIComponent(path.split("/api/auth/user/")[1]);
      return handleGetUser(userId);
    }

    // Lobbies
    if (method === "POST" && path === "/api/lobbies") {
      return handleCreateLobby(await req.json());
    }
    if (method === "POST" && path === "/api/lobbies/join") {
      return handleJoinLobby(await req.json());
    }
    if (method === "POST" && path === "/api/lobbies/leave") {
      return handleLeaveLobby(await req.json());
    }
    if (method === "GET" && path.startsWith("/api/lobbies/user/")) {
      const userId = decodeURIComponent(path.split("/api/lobbies/user/")[1]);
      return handleGetUserLobbies(userId);
    }
    if (method === "GET" && path.match(/^\/api\/lobbies\/[^/]+$/)) {
      const lobbyId = decodeURIComponent(path.split("/api/lobbies/")[1]);
      return handleGetLobby(lobbyId);
    }
    if (method === "DELETE" && path.match(/^\/api\/lobbies\/[^/]+$/)) {
      const lobbyId = decodeURIComponent(path.split("/api/lobbies/")[1]);
      const userId = url.searchParams.get("userId") || "";
      return handleDeleteLobby(lobbyId, userId);
    }

    // Check-ins
    if (method === "POST" && path === "/api/checkins") {
      return handleCheckin(await req.json());
    }
    if (method === "GET" && path.match(/^\/api\/checkins\/[^/]+$/)) {
      const lobbyId = decodeURIComponent(path.split("/api/checkins/")[1].split("?")[0]);
      const date = url.searchParams.get("date") || todayStr();
      return handleGetCheckins(lobbyId, date);
    }

    // Stats
    if (method === "GET" && path.match(/^\/api\/stats\/[^/]+$/)) {
      const lobbyId = decodeURIComponent(path.split("/api/stats/")[1]);
      return handleGetStats(lobbyId);
    }

    // TEST: seed fake past days for testing missed-day logic
    // POST /api/test/seed { lobbyId, userId, daysAgo, checkedDays }
    if (method === "POST" && path === "/api/test/seed") {
      const body = await req.json();
      const { lobbyId, userId, daysAgo, checkedDays } = body;
      // Move lobby createdAt back
      const lobbyRes = await kv.get(["lobbies", lobbyId]);
      if (!lobbyRes.value) return error("Lobby not found", 404);
      const lobby = lobbyRes.value;
      const past = new Date();
      past.setDate(past.getDate() - daysAgo);
      lobby.createdAt = past.toISOString();
      await kv.set(["lobbies", lobbyId], lobby);
      // Insert checkins for specified days (array of offsets from today, e.g. [5,4,2] = 5,4,2 days ago)
      for (const offset of checkedDays) {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        const dateStr = d.toISOString().split("T")[0];
        await kv.set(["checkins", lobbyId, dateStr, userId], {
          lobbyId, userId, date: dateStr, checkedAt: d.toISOString(),
        });
      }
      return json({ ok: true, message: `Seeded: lobby moved ${daysAgo} days back, checkins on offsets ${checkedDays}` });
    }

    return error("Not found", 404);
  } catch (e) {
    console.error("Error:", e);
    return error("Internal server error", 500);
  }
}

Deno.serve({ port: 8000 }, handleRequest);
