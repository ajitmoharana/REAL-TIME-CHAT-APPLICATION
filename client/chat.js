// ============================================================
// Real-Time Chat Application using WebSockets
// client/chat.js — Frontend Socket.IO + REST Logic
// ============================================================

const socket = io();  // Connect to same-origin server

// ── State ────────────────────────────────────────────────────
let currentUserId   = null;
let currentUsername = null;
let activeChatUser  = null;   // { userId, username }
let typingTimer     = null;

// ── DOM Helpers ──────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls)  e.className   = cls;
  if (text) e.textContent = text;
  return e;
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in (session)
  const saved = sessionStorage.getItem('chatUser');
  if (saved) {
    const user = JSON.parse(saved);
    loginSuccess(user.userId, user.username);
  }

  // Auth form toggles
  $('showRegister').addEventListener('click', () => {
    $('loginForm').classList.add('hidden');
    $('registerForm').classList.remove('hidden');
  });
  $('showLogin').addEventListener('click', () => {
    $('registerForm').classList.add('hidden');
    $('loginForm').classList.remove('hidden');
  });

  // Login submit
  $('loginBtn').addEventListener('click', handleLogin);
  // Register submit
  $('registerBtn').addEventListener('click', handleRegister);
  // Logout
  $('logoutBtn').addEventListener('click', handleLogout);
  // Send message
  $('sendBtn').addEventListener('click', sendMessage);
  // Enter key in message input
  $('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  // Typing indicator
  $('messageInput').addEventListener('input', handleTyping);
});

// ── Auth Handlers ─────────────────────────────────────────────
async function handleLogin() {
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  if (!username || !password) return showError('loginError', 'Fill all fields');

  const res  = await fetch('/api/login', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) return showError('loginError', data.error);
  loginSuccess(data.userId, data.username);
}

async function handleRegister() {
  const username = $('regUsername').value.trim();
  const email    = $('regEmail').value.trim();
  const password = $('regPassword').value;
  if (!username || !email || !password) return showError('regError', 'Fill all fields');

  const res  = await fetch('/api/register', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ username, email, password })
  });
  const data = await res.json();
  if (!res.ok) return showError('regError', data.error);
  showError('regError', '✅ Registered! Please login.', 'green');
}

function loginSuccess(userId, username) {
  currentUserId   = userId;
  currentUsername = username;
  sessionStorage.setItem('chatUser', JSON.stringify({ userId, username }));

  $('authSection').classList.add('hidden');
  $('chatSection').classList.remove('hidden');
  $('currentUser').textContent = username;

  // Tell server this user is online
  socket.emit('user_online', { userId, username });
  loadUsers();
}

async function handleLogout() {
  await fetch('/api/logout', { method: 'POST' });
  sessionStorage.removeItem('chatUser');
  currentUserId = currentUsername = activeChatUser = null;
  $('chatSection').classList.add('hidden');
  $('authSection').classList.remove('hidden');
  $('userList').innerHTML    = '';
  $('messagesDiv').innerHTML = '';
}

// ── Users List ────────────────────────────────────────────────
async function loadUsers() {
  const res   = await fetch('/api/users');
  const users = await res.json();
  renderUsers(users);
}

function renderUsers(users) {
  const list = $('userList');
  list.innerHTML = '';
  users.forEach(user => {
    const item = el('div', 'user-item');
    item.dataset.userId   = user.user_id;
    item.dataset.username = user.username;

    const dot   = el('span', `status-dot ${user.status}`);
    const name  = el('span', 'user-name', user.username);
    const badge = el('span', 'status-text', user.status);

    item.append(dot, name, badge);
    item.addEventListener('click', () => openChat(user.user_id, user.username));
    list.appendChild(item);
  });
}

// ── Chat Window ───────────────────────────────────────────────
async function openChat(userId, username) {
  activeChatUser = { userId, username };
  $('chatWith').textContent    = `Chat with ${username}`;
  $('messagesDiv').innerHTML   = '';
  $('chatHeader').classList.remove('hidden');
  $('messageInput').disabled   = false;
  $('sendBtn').disabled        = false;

  // Highlight active user
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.user-item[data-user-id="${userId}"]`);
  if (active) active.classList.add('active');

  // Load history
  const res  = await fetch(`/api/messages/${userId}`);
  const msgs = await res.json();
  msgs.forEach(renderMessage);
  scrollToBottom();
}

function renderMessage(msg) {
  const isOwn = Number(msg.sender_id) === Number(currentUserId);
  const wrap  = el('div', `message-wrap ${isOwn ? 'own' : 'other'}`);
  const bubble = el('div', 'bubble', msg.message);
  const meta   = el('span', 'meta',
    `${isOwn ? 'You' : msg.sender_name || msg.senderName}  •  ${formatTime(msg.timestamp)}`
  );
  wrap.append(bubble, meta);
  $('messagesDiv').appendChild(wrap);
}

function scrollToBottom() {
  const div = $('messagesDiv');
  div.scrollTop = div.scrollHeight;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Send Message ──────────────────────────────────────────────
function sendMessage() {
  const input   = $('messageInput');
  const message = input.value.trim();
  if (!message || !activeChatUser) return;

  socket.emit('send_message', {
    senderId  : currentUserId,
    receiverId: activeChatUser.userId,
    message
  });

  input.value = '';
  socket.emit('stop_typing', { receiverId: activeChatUser.userId });
}

// ── Typing Indicator ──────────────────────────────────────────
function handleTyping() {
  if (!activeChatUser) return;
  socket.emit('typing', { receiverId: activeChatUser.userId, username: currentUsername });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('stop_typing', { receiverId: activeChatUser.userId });
  }, 1500);
}

// ── Socket Events ─────────────────────────────────────────────
socket.on('receive_message', (msg) => {
  // Show in chat if the window is open for this sender
  if (activeChatUser && Number(msg.senderId) === Number(activeChatUser.userId)) {
    renderMessage(msg);
    scrollToBottom();
  }
  // Otherwise show a notification badge (simple alert for demo)
  else {
    showToast(`New message from ${msg.senderName}`);
  }
});

socket.on('message_sent', (msg) => {
  // Confirm sender's own message
  if (activeChatUser && Number(msg.receiverId) === Number(activeChatUser.userId)) {
    renderMessage(msg);
    scrollToBottom();
  }
});

socket.on('online_users', (userIds) => {
  // Refresh user list status dots
  document.querySelectorAll('.user-item').forEach(item => {
    const uid  = Number(item.dataset.userId);
    const dot  = item.querySelector('.status-dot');
    const text = item.querySelector('.status-text');
    const isOnline = userIds.map(Number).includes(uid);
    dot.className   = `status-dot ${isOnline ? 'online' : 'offline'}`;
    text.textContent = isOnline ? 'online' : 'offline';
  });
});

socket.on('user_typing', ({ username }) => {
  $('typingIndicator').textContent = `${username} is typing…`;
});

socket.on('user_stop_typing', () => {
  $('typingIndicator').textContent = '';
});

socket.on('message_error', ({ error }) => {
  showToast(`⚠️ ${error}`, 'error');
});

// ── Utility ───────────────────────────────────────────────────
function showError(elementId, msg, color = 'red') {
  const el = $(elementId);
  el.textContent = msg;
  el.style.color = color;
}

function showToast(msg) {
  const toast = el('div', 'toast', msg);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
