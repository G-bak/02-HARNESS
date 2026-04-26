-- LandingHub Newsletter DB Schema
-- 로컬 적용: wrangler d1 execute landinghub-newsletter --local --file=schema.sql

CREATE TABLE IF NOT EXISTS subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,
  status          TEXT    NOT NULL DEFAULT 'active',
  source          TEXT    DEFAULT 'notify_form',
  ip              TEXT,
  user_agent      TEXT,
  tags            TEXT    DEFAULT '[]',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sub_email   ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_sub_status  ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_sub_created ON subscribers(created_at DESC);

CREATE TABLE IF NOT EXISTS templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subject       TEXT    NOT NULL,
  preview_text   TEXT,
  body_html     TEXT    NOT NULL,
  body_text     TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tpl_created ON templates(created_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subject       TEXT NOT NULL,
  preview_text  TEXT,
  body_html     TEXT NOT NULL,
  body_text     TEXT,
  template_id   INTEGER REFERENCES templates(id),
  status        TEXT NOT NULL DEFAULT 'draft',
  scheduled_at  TEXT,
  sent_at       TEXT,
  total_sent    INTEGER DEFAULT 0,
  total_failed  INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_camp_status  ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_camp_created ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_camp_template ON campaigns(template_id);

CREATE TABLE IF NOT EXISTS send_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id),
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
  email         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  resend_id     TEXT,
  error_msg     TEXT,
  sent_at       TEXT DEFAULT (datetime('now')),
  UNIQUE(campaign_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_log_campaign ON send_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_log_status   ON send_logs(status);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sess_expires ON admin_sessions(expires_at);
