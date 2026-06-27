/**
 * IFchan — App Logic (versão PHP/fetch)
 */

// ---------- STATE ----------
let currentUser    = null;
let currentChannel = 'todos';
let currentThreadId = null;
let newThreadImageData = null;
let replyImageData     = null;

const CHANNELS = [
  { id: 'todos',      label: 'Todos'      },
  { id: 'geral',      label: 'Geral'      },
  { id: 'computacao', label: 'Computação' },
  { id: 'biologia',   label: 'Biologia'   },
  { id: 'memes',      label: 'Memes'      },
  { id: 'jogos',      label: 'Jogos'      },
  { id: 'skate',      label: 'Skate'      },
];

const NOTIF_ICONS = {
  reply:  '💬',
  like:   '❤️',
  thread: '🧵',
  default:'🔔',
};

// ---------- INIT ----------
window.addEventListener('DOMContentLoaded', async () => {
  // Tenta recuperar sessão ativa via PHP
  try {
    const user = await API.getMe();
    currentUser = user;
    launchApp();
  } catch {
    // Não autenticado — tela de login já aparece por padrão
  }
});

// ---------- AUTH ----------
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');

  if (!username || !password) {
    showError(errEl, 'Preencha todos os campos.'); return;
  }

  setLoading('login-btn', true);
  try {
    const user  = await API.login(username, password);
    currentUser = user;
    errEl.classList.add('hidden');
    launchApp();
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading('login-btn', false);
  }
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const errEl    = document.getElementById('reg-error');

  if (!username || !password || !confirm) {
    showError(errEl, 'Preencha todos os campos.'); return;
  }
  if (password !== confirm) {
    showError(errEl, 'As senhas não coincidem.'); return;
  }
  if (password.length < 4) {
    showError(errEl, 'Senha deve ter ao menos 4 caracteres.'); return;
  }

  try {
    const user  = await API.register(username, email, password);
    currentUser = user;
    errEl.classList.add('hidden');
    launchApp();
  } catch (err) {
    showError(errEl, err.message);
  }
}

async function doLogout() {
  try { await API.logout(); } catch { /* ignora */ }
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function showLogin() {
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

function showRegister() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.remove('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Aguarde...' : 'Entrar';
}

// ---------- APP LAUNCH ----------
function launchApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Tema (preferência local)
  const theme = API.getTheme();
  if (theme === 'light') document.body.classList.add('light');
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.checked = (theme === 'light');

  updateSidebar();
  renderChannelTabs();
  renderThreads();
  updateNotifBadge();
  showPanel('feed');
  populateProfile();
}

// ---------- SIDEBAR ----------
function updateSidebar() {
  if (!currentUser) return;
  document.getElementById('sidebar-username').textContent = currentUser.username;
  document.getElementById('sidebar-handle').textContent   = currentUser.handle || '@' + currentUser.username.toLowerCase();
  document.getElementById('sidebar-avatar').textContent   = (currentUser.avatar || currentUser.username.charAt(0)).toUpperCase();
  document.getElementById('new-thread-author').textContent = currentUser.username;
  document.getElementById('new-thread-avatar').textContent = (currentUser.avatar || currentUser.username.charAt(0)).toUpperCase();
}

// ---------- PANEL NAVIGATION ----------
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  if (name === 'feed')    document.querySelectorAll('.nav-item')[0]?.classList.add('active');
  if (name === 'profile') document.querySelectorAll('.nav-item')[1]?.classList.add('active');
  if (name === 'history') document.querySelectorAll('.nav-item')[2]?.classList.add('active');

  if (name === 'notifications') renderNotifications();
  if (name === 'history')       renderHistory();
  if (name === 'profile')       populateProfile();
  if (name === 'feed')          renderThreads();
}

// ---------- CHANNELS ----------
function renderChannelTabs() {
  const container = document.getElementById('channel-list');
  container.innerHTML = CHANNELS.map(ch => `
    <button class="channel-tab ${ch.id === currentChannel ? 'active' : ''}"
            onclick="selectChannel('${ch.id}')">
      ${ch.label}
    </button>
  `).join('');
}

function selectChannel(id) {
  currentChannel = id;
  renderChannelTabs();
  renderThreads();
}

// ---------- THREADS ----------
async function renderThreads() {
  const list = document.getElementById('threads-list');
  list.innerHTML = `<div class="empty-state"><p>Carregando...</p></div>`;

  try {
    const data    = await API.getThreads(currentChannel);
    const threads = data.threads;

    if (!threads || threads.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <p>Nenhuma thread por aqui ainda.</p>
        </div>`;
      return;
    }

    list.innerHTML = threads.map(t => threadCardHTML(t)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar threads: ${escHtml(err.message)}</p></div>`;
  }
}

function threadCardHTML(t) {
  // O PHP retorna snake_case — normaliza para camelCase aqui
  const authorName = t.author_name  || t.authorName  || '?';
  const channel    = t.channel_id   || t.channel     || '';
  const replyCount = t.reply_count  !== undefined ? t.reply_count : (t.replies?.length ?? 0);
  const createdAt  = t.created_at   || t.createdAt   || '';
  const imagePath  = t.image_path   || t.image       || null;

  const timeAgo  = formatTimeAgo(createdAt);
  const chLabel  = CHANNELS.find(c => c.id === channel)?.label || channel;
  const initials = authorName.charAt(0).toUpperCase();
  const preview  = (t.body || '').replace(/\n/g, ' ').substring(0, 100);

  return `
    <div class="thread-card" onclick="openThread('${t.id}')">
      <div class="thread-card-avatar">
        <div class="avatar sm" style="background:${avatarColor(authorName)}">${initials}</div>
      </div>
      <div class="thread-card-body">
        <div class="thread-card-meta">
          <span class="thread-card-author">${escHtml(authorName)}</span>
          <span class="thread-card-channel">#${chLabel}</span>
          <span class="thread-card-time">${timeAgo}</span>
        </div>
        <div class="thread-card-title">${escHtml(t.title)}</div>
        <div class="thread-card-preview">${escHtml(preview)}</div>
        <div class="thread-card-footer">
          <span class="thread-card-stat">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            ${replyCount}
          </span>
        </div>
      </div>
      ${imagePath ? `<img src="${imagePath}" class="thread-card-img" alt="">` : ''}
    </div>
  `;
}

async function openThread(id) {
  currentThreadId = id;
  showPanel('thread');

  // Mostra loading enquanto busca
  document.getElementById('thread-content').innerHTML = `<p style="color:var(--text2);padding:20px">Carregando...</p>`;
  document.getElementById('replies-list').innerHTML   = '';

  try {
    const thread = await API.getThread(id);

    // Normaliza campos snake_case → camelCase
    const authorName = thread.author_name || thread.authorName || '?';
    const channel    = thread.channel_id  || thread.channel    || '';
    const createdAt  = thread.created_at  || thread.createdAt  || '';
    const imagePath  = thread.image_path  || thread.image      || null;

    // Header
    document.getElementById('thread-author-avatar').textContent    = authorName.charAt(0).toUpperCase();
    document.getElementById('thread-author-avatar').style.background = avatarColor(authorName);
    document.getElementById('thread-author').textContent  = authorName;
    document.getElementById('thread-board').textContent   = '#' + (CHANNELS.find(c => c.id === channel)?.label || channel);

    // Conteúdo
    document.getElementById('thread-content').innerHTML = `
      <h2 class="thread-full-title">${escHtml(thread.title)}</h2>
      <p class="thread-full-text">${escHtml(thread.body)}</p>
      ${imagePath ? `<img src="${imagePath}" class="thread-full-img" alt="">` : ''}
    `;

    renderReplies(thread.replies || []);

    document.getElementById('reply-input').value = '';
    replyImageData = null;
    document.getElementById('reply-image-preview').classList.add('hidden');

  } catch (err) {
    document.getElementById('thread-content').innerHTML =
      `<p style="color:var(--red);padding:20px">Erro ao carregar thread: ${escHtml(err.message)}</p>`;
  }
}

function renderReplies(replies) {
  const list = document.getElementById('replies-list');

  if (!replies || replies.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:30px"><p>Sem respostas ainda. Seja o primeiro!</p></div>`;
    return;
  }

  list.innerHTML = replies.map(r => {
    const authorName = r.author_name || r.authorName || '?';
    const createdAt  = r.created_at  || r.createdAt  || '';
    const imagePath  = r.image_path  || r.image      || null;

    return `
      <div class="reply-item">
        <div class="avatar sm" style="background:${avatarColor(authorName)}">${authorName.charAt(0).toUpperCase()}</div>
        <div class="reply-body">
          <div class="reply-meta">
            <span class="reply-author">${escHtml(authorName)}</span>
            <span class="reply-time">${formatTimeAgo(createdAt)}</span>
          </div>
          <div class="reply-text">${escHtml(r.text)}</div>
          ${imagePath ? `<img src="${imagePath}" class="reply-img" alt="">` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function submitReply() {
  if (!currentUser || !currentThreadId) return;

  const input = document.getElementById('reply-input');
  const text  = input.value.trim();
  if (!text && !replyImageData) return;

  const btn = document.querySelector('.reply-send');
  if (btn) btn.disabled = true;

  try {
    await API.addReply(currentThreadId, text, replyImageData);

    input.value    = '';
    replyImageData = null;
    document.getElementById('reply-image-preview').classList.add('hidden');
    document.getElementById('reply-file-input').value = '';

    // Recarrega a thread completa para mostrar a nova resposta
    const thread = await API.getThread(currentThreadId);
    renderReplies(thread.replies || []);

    const section = document.querySelector('.replies-section');
    if (section) section.scrollTop = section.scrollHeight;

  } catch (err) {
    alert('Erro ao enviar resposta: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- NEW THREAD ----------
function openNewThread() {
  document.getElementById('new-thread-title').value = '';
  document.getElementById('new-thread-text').value  = '';
  newThreadImageData = null;
  document.getElementById('new-thread-image-preview').classList.add('hidden');
  document.getElementById('new-thread-file').value  = '';
  showPanel('new-thread');
}

async function publishThread() {
  if (!currentUser) return;

  const title   = document.getElementById('new-thread-title').value.trim();
  const body    = document.getElementById('new-thread-text').value.trim();
  const channel = document.getElementById('new-thread-channel').value;

  if (!title) {
    const titleEl = document.getElementById('new-thread-title');
    titleEl.focus();
    titleEl.style.borderColor = '#e53e3e';
    setTimeout(() => { titleEl.style.borderColor = ''; }, 1500);
    return;
  }

  const btn = document.querySelector('.btn-publish');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    await API.createThread(title, body, channel, newThreadImageData);
    newThreadImageData = null;
    currentChannel     = channel;
    renderChannelTabs();
    showPanel('feed');
    await renderThreads();
  } catch (err) {
    alert('Erro ao publicar: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
  }
}

// ---------- NOTIFICATIONS ----------
async function renderNotifications() {
  if (!currentUser) return;
  const list = document.getElementById('notifications-list');
  list.innerHTML = `<div class="empty-state"><p>Carregando...</p></div>`;

  try {
    const data   = await API.getNotifications();
    const notifs = data.notifications || [];

    // Marca como lidas em paralelo
    API.markNotificationsRead().catch(() => {});
    updateNotifBadge();

    if (notifs.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:60px"><p>Nenhuma notificação.</p></div>`;
      return;
    }

    list.innerHTML = notifs.map(n => {
      const isRead    = n.is_read || n.read;
      const text      = n.message || n.text || '';
      const createdAt = n.created_at || n.createdAt || '';
      const link      = n.link_thread_id || n.link || '';

      return `
        <div class="notif-item ${isRead ? '' : 'unread'}" onclick="handleNotifClick('${link}')">
          <span class="notif-icon">${NOTIF_ICONS[n.type] || NOTIF_ICONS.default}</span>
          <span class="notif-text">${escHtml(text)}</span>
          <span class="notif-time">${formatTimeAgo(createdAt)}</span>
        </div>
      `;
    }).join('');

  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar notificações.</p></div>`;
  }
}

function handleNotifClick(link) {
  if (link) openThread(link);
}

async function updateNotifBadge() {
  if (!currentUser) return;
  try {
    const data   = await API.getNotifications();
    const unread = data.unread ?? 0;
    const dot    = document.getElementById('notif-dot');
    if (dot) {
      if (unread > 0) dot.classList.remove('hidden');
      else            dot.classList.add('hidden');
    }
  } catch { /* silencia erro do badge */ }
}

// ---------- HISTORY ----------
async function renderHistory() {
  if (!currentUser) return;
  const list = document.getElementById('history-list');
  list.innerHTML = `<div class="empty-state"><p>Carregando...</p></div>`;

  try {
    // Busca todas as threads e filtra pelo usuário logado no cliente
    // (Em produção, criar rota GET /threads.php?author_id=X no PHP)
    const data    = await API.getThreads('todos');
    const threads = (data.threads || []).filter(t =>
      (t.author_name || t.authorName) === currentUser.username
    );

    if (threads.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:60px"><p>Você ainda não criou nenhuma thread.</p></div>`;
      return;
    }

    list.innerHTML = threads.map(t => threadCardHTML(t)).join('');
  } catch {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar histórico.</p></div>`;
  }
}

// ---------- PROFILE ----------
function populateProfile() {
  if (!currentUser) return;
  document.getElementById('profile-avatar-lg').textContent   = (currentUser.avatar || currentUser.username.charAt(0)).toUpperCase();
  document.getElementById('profile-name-input').value   = currentUser.username;
  document.getElementById('profile-handle-input').value = currentUser.handle || '';
  document.getElementById('profile-email-input').value  = currentUser.email  || '';
  document.getElementById('profile-msg').classList.add('hidden');
}

async function saveProfile() {
  if (!currentUser) return;

  const username = document.getElementById('profile-name-input').value.trim();
  const handle   = document.getElementById('profile-handle-input').value.trim();
  const email    = document.getElementById('profile-email-input').value.trim();

  try {
    const updated = await API.updateProfile(username, handle, email);
    currentUser = { ...currentUser, username, handle, email, avatar: username.charAt(0).toUpperCase() };
    updateSidebar();

    const msg = document.getElementById('profile-msg');
    msg.textContent = '✓ Alterações salvas!';
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

// ---------- SETTINGS ----------
function toggleTheme(checkbox) {
  if (checkbox.checked) {
    document.body.classList.add('light');
    API.setTheme('light');
  } else {
    document.body.classList.remove('light');
    API.setTheme('dark');
  }
}

// ---------- FILE / IMAGE HANDLING ----------
function triggerFileInput() {
  document.getElementById('reply-file-input').click();
}

function previewReplyImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    replyImageData = e.target.result;
    const preview  = document.getElementById('reply-image-preview');
    preview.innerHTML = `
      <img src="${replyImageData}" alt="preview">
      <button onclick="clearReplyImage()" title="Remover">✕</button>
    `;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearReplyImage() {
  replyImageData = null;
  document.getElementById('reply-image-preview').classList.add('hidden');
  document.getElementById('reply-file-input').value = '';
}

function triggerNewThreadFile() {
  document.getElementById('new-thread-file').click();
}

function previewNewThreadImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    newThreadImageData = e.target.result;
    const preview      = document.getElementById('new-thread-image-preview');
    preview.innerHTML  = `
      <img src="${newThreadImageData}" alt="preview" style="max-height:180px;border-radius:6px;border:1px solid var(--border)">
      <button onclick="clearNewThreadImage()" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;margin-left:8px">✕</button>
    `;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearNewThreadImage() {
  newThreadImageData = null;
  document.getElementById('new-thread-image-preview').classList.add('hidden');
  document.getElementById('new-thread-file').value = '';
}

// ---------- UTILITIES ----------
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

function avatarColor(name) {
  const colors = [
    '#1a4a6a','#3a1a6a','#1a6a3a','#6a3a1a',
    '#1a5a5a','#5a1a1a','#2a4a2a','#4a2a4a',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Enter no login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-username')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password')?.focus();
  });
});
