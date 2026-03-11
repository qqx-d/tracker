// API base URL - in production, point to your Deno Deploy URL
const API_BASE = import.meta.env.PROD
  ? 'https://your-app.deno.dev'
  : '';

async function request(path, options = {}) {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  register: (username) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  getUser: (userId) => request(`/auth/user/${encodeURIComponent(userId)}`),

  // Lobbies
  createLobby: (name, ownerId) =>
    request('/lobbies', {
      method: 'POST',
      body: JSON.stringify({ name, ownerId }),
    }),

  joinLobby: (code, userId) =>
    request('/lobbies/join', {
      method: 'POST',
      body: JSON.stringify({ code, userId }),
    }),

  leaveLobby: (lobbyId, userId) =>
    request('/lobbies/leave', {
      method: 'POST',
      body: JSON.stringify({ lobbyId, userId }),
    }),

  getLobby: (lobbyId) => request(`/lobbies/${encodeURIComponent(lobbyId)}`),

  deleteLobby: (lobbyId, userId) =>
    request(`/lobbies/${encodeURIComponent(lobbyId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),

  getUserLobbies: (userId) =>
    request(`/lobbies/user/${encodeURIComponent(userId)}`),

  // Check-ins
  checkin: (lobbyId, userId) =>
    request('/checkins', {
      method: 'POST',
      body: JSON.stringify({ lobbyId, userId }),
    }),

  getCheckins: (lobbyId, date) =>
    request(`/checkins/${encodeURIComponent(lobbyId)}?date=${encodeURIComponent(date)}`),

  // Stats
  getStats: (lobbyId) => request(`/stats/${encodeURIComponent(lobbyId)}`),
};
