-- ============================================================
-- Real-Time Chat Application using WebSockets
-- database/chat.sql — Schema & Sample Data
-- ============================================================

CREATE DATABASE IF NOT EXISTS chatapp
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE chatapp;

-- ── Users Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       INT            AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)    NOT NULL UNIQUE,
  email         VARCHAR(100)   NOT NULL UNIQUE,
  password_hash VARCHAR(255)   NOT NULL,
  status        ENUM('online','offline') DEFAULT 'offline',
  last_seen     DATETIME       DEFAULT NULL,
  created_at    DATETIME       DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Messages Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  message_id  INT          AUTO_INCREMENT PRIMARY KEY,
  sender_id   INT          NOT NULL,
  receiver_id INT          NOT NULL,
  message     TEXT         NOT NULL,
  is_read     TINYINT(1)   DEFAULT 0,
  timestamp   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_conversation (sender_id, receiver_id),
  INDEX idx_timestamp    (timestamp)
) ENGINE=InnoDB;

-- ── Sample Data (optional) ───────────────────────────────────
-- Passwords below are bcrypt hashes of "password123"
INSERT IGNORE INTO users (username, email, password_hash) VALUES
  ('AJIT', 'ajitmoharana515@gmail.com', '$2b$10$eW5mZ0K9G3YQ8h3p7Y1Z5ORLuMpCcHfB1s8vYIJ4qTlkSaW2TdSEW'),
  ('RAKESH',   'barikrakesh867@gmail.com',   '$2b$10$eW5mZ0K9G3YQ8h3p7Y1Z5ORLuMpCcHfB1s8vYIJ4qTlkSaW2TdSEW');
