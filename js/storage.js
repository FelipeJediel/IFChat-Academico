/**
 * IFchan — API Layer
 * Todas as chamadas vão para o PHP via fetch().
 * credentials: 'include' é obrigatório para o cookie de sessão funcionar.
 */

const API_BASE = 'php';

const API = {

  // ---------- HELPERS ----------
  async _post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',                          // <-- envia o cookie de sessão
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
    return data;
  },

  async _get(url) {
    const res = await fetch(url, {
      credentials: 'include',                          // <-- envia o cookie de sessão
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
    return data;
  },

  async _delete(url) {
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',                          // <-- envia o cookie de sessão
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
    return data;
  },

  // ---------- AUTH ----------
  async login(username, password) {
    return this._post(`${API_BASE}/auth.php?action=login`, { username, password });
  },

  async register(username, email, password) {
    return this._post(`${API_BASE}/auth.php?action=register`, { username, email, password });
  },

  async logout() {
    return this._post(`${API_BASE}/auth.php?action=logout`, {});
  },

  async getMe() {
    return this._get(`${API_BASE}/auth.php?action=me`);
  },

  async updateProfile(username, handle, email) {
    return this._post(`${API_BASE}/auth.php?action=update`, { username, handle, email });
  },

  // ---------- THREADS ----------
  async getThreads(channel = 'todos', page = 1) {
    const ch = channel && channel !== 'todos' ? `&channel=${channel}` : '';
    return this._get(`${API_BASE}/threads.php?page=${page}${ch}`);
  },

  async getThread(id) {
    return this._get(`${API_BASE}/threads.php?id=${id}`);
  },

  async createThread(title, body, channel, image = null) {
    return this._post(`${API_BASE}/threads.php`, { title, body, channel, image });
  },

  async addReply(threadId, text, image = null) {
    return this._post(`${API_BASE}/threads.php?action=reply&id=${threadId}`, { text, image });
  },

  async deleteThread(id) {
    return this._delete(`${API_BASE}/threads.php?id=${id}`);
  },

  // ---------- NOTIFICATIONS ----------
  async getNotifications() {
    return this._get(`${API_BASE}/notifications.php`);
  },

  async markNotificationsRead() {
    return this._post(`${API_BASE}/notifications.php?action=read`, {});
  },

  // ---------- PREFERÊNCIAS DE UI ----------
  getTheme() {
    return localStorage.getItem('ifchan_theme') || 'dark';
  },
  setTheme(theme) {
    localStorage.setItem('ifchan_theme', theme);
  },
};
