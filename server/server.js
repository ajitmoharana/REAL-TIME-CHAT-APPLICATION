// ============================================================
// Real-Time Chat Application using WebSockets
// server/server.js — Main Express + Socket.IO Server
// ============================================================

const express    = require('express');
const http       = require('http');
const path       = require('path');
const mysql      = require('mysql2/promise');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const { Server } = require('socket.io');

// ── App Setup ───────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client')));

app.use(session({
  secret : process.env.SESSION_SECRET || 'chatapp_secret_key',
  resave : false,
  saveUninitialized: false,
  cookie : { secure: false, maxAge: 24 * 60 * 60 * 1000 }   // 1 day
}));

// ── Database Pool ────────────────────────────────────────────
const db = mysql.createPool({
  host    : process.env.DB_HOST     || 'localhost',
  user    : process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME     || 'chatapp',
  waitForConnections: true,
  connectionLimit   : 10
});

// ── Auth Middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── REST Routes ──────────────────────────────────────────────

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hash]
    );
    res.json({ message: 'Registered successfully', userId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Mark online
    await db.execute("UPDATE users SET status='online' WHERE user_id=?", [user.user_id]);

    req.session.userId   = user.user_id;
    req.session.username = user.username;
    res.json({ message: 'Login successful', userId: user.user_id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/logout', requireAuth, async (req, res) => {
  try {
    await db.execute("UPDATE users SET status='offline' WHERE user_id=?", [req.session.userId]);
    req.session.destroy();
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (for contact list)
app.get('/api/users', requireAuth, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT user_id, username, status, last_seen FROM users WHERE user_id != ?',
    [req.session.userId]
  );
  res.json(rows);
});

// Get chat history between two users
app.get('/api/messages/:receiverId', requireAuth, async (req, res) => {
  const senderId   = req.session.userId;
  const receiverId = req.params.receiverId;
  const [rows] = await db.execute(
    `SELECT m.*, u.username AS sender_name
     FROM messages m
     JOIN users u ON m.sender_id = u.user_id
     WHERE (m.sender_id=? AND m.receiver_id=?)
        OR (m.sender_id=? AND m.receiver_id=?)
     ORDER BY m.timestamp ASC
     LIMIT 100`,
    [senderId, receiverId, receiverId, senderId]
  );
  res.json(rows);
});

// ── Socket.IO Logic ──────────────────────────────────────────
// Map: userId → socketId
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User comes online
  socket.on('user_online', async ({ userId, username }) => {
    onlineUsers.set(userId, socket.id);
    socket.userId   = userId;
    socket.username = username;

    try {
      await db.execute("UPDATE users SET status='online' WHERE user_id=?", [userId]);
    } catch (e) { /* ignore */ }

    // Broadcast updated online list
    io.emit('online_users', Array.from(onlineUsers.keys()));
    console.log(`${username} (${userId}) is online`);
  });

  // Send a private message
  socket.on('send_message', async ({ senderId, receiverId, message }) => {
    if (!message.trim()) return;

    try {
      // Save to DB
      const [result] = await db.execute(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [senderId, receiverId, message]
      );

      const [rows] = await db.execute(
        'SELECT timestamp FROM messages WHERE message_id=?', [result.insertId]
      );

      const payload = {
        messageId : result.insertId,
        senderId,
        receiverId,
        message,
        timestamp : rows[0].timestamp,
        senderName: socket.username
      };

      // Send to receiver if online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', payload);
      }

      // Echo back to sender
      socket.emit('message_sent', payload);
    } catch (err) {
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', ({ receiverId, username }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { username });
    }
  });

  socket.on('stop_typing', ({ receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_stop_typing');
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      try {
        await db.execute(
          "UPDATE users SET status='offline', last_seen=NOW() WHERE user_id=?",
          [socket.userId]
        );
      } catch (e) { /* ignore */ }
      io.emit('online_users', Array.from(onlineUsers.keys()));
      console.log(`${socket.username} disconnected`);
    }
  });
});

// ── Start Server ─────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅  Chat server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };
