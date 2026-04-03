# 💬 Real-Time Chat Application using WebSockets

A full-stack real-time chat application built with **Node.js**, **Socket.IO**, **Express**, and **MySQL**.

---

## 📁 Folder Structure

```
Real_Time_Chat_App/
├── server/
│   └── server.js        ← Express + Socket.IO server
├── client/
│   ├── index.html       ← Chat UI
│   ├── chat.js          ← Frontend Socket.IO logic
│   └── style.css        ← Styles
├── database/
│   └── chat.sql         ← MySQL schema
├── package.json
└── README.md
```

---

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js v16+
- MySQL 5.7+ or MariaDB

### 2. Database Setup
```sql
mysql -u root -p < database/chat.sql
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment (optional)
Create a `.env` file or edit `server.js` variables:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=chatapp
PORT=3000
SESSION_SECRET=your_secret
```

### 5. Run the Server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 6. Open Browser
Visit `http://localhost:3000`

---

## 🚀 Features

| Feature | Status |
|---------|--------|
| User Registration & Login | ✅ |
| WebSocket Persistent Connection | ✅ |
| Real-Time Private Messaging | ✅ |
| Typing Indicator | ✅ |
| Online / Offline Status | ✅ |
| Chat History (MySQL) | ✅ |
| Session-based Authentication | ✅ |
| Responsive Dark-Mode UI | ✅ |

---

## 🛠️ Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Socket.IO Client
- **Backend**: Node.js, Express.js, Socket.IO
- **Database**: MySQL (via `mysql2`)
- **Auth**: bcryptjs + express-session
- **Protocol**: WebSocket (via Socket.IO)
