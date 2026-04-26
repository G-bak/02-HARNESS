#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env 자동 로드 (process.env에 없을 때만)
if (!process.env.SLACK_WEBHOOK_URL) {
  const envPath = resolve(__dirname, "../.env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
}

const args = parseArgs(process.argv.slice(2));

const webhookUrl = process.env.SLACK_WEBHOOK_URL;
if (!webhookUrl) {
  console.error("SLACK_WEBHOOK_URL is not set.");
  process.exit(2);
}

const event = {
  type: "NOTIFICATION_EVENT",
  task_id: args["task-id"] || "TASK-UNKNOWN",
  severity: args.severity || "INFO",
  notification_status: args["notification-status"] || args.status || "RUNNING",
  title: args.title || "Harness notification",
  summary: args.summary || "",
  report_path: args["report-path"] || "",
};

const payload = {
  text: `[${event.task_id}] ${event.title}`,
  blocks: [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `[${event.task_id}] ${event.title}`,
        emoji: false,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*상태*\n${statusLabel(event.notification_status)}` },
        { type: "mrkdwn", text: `*심각도*\n${severityLabel(event.severity)}` },
      ],
    },
  ],
};

if (event.summary) {
  payload.blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*Summary*\n${event.summary}` },
  });
}

if (event.report_path) {
  payload.blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*보고서*\n${event.report_path || "N/A"}` },
    ],
  });
}

try {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Slack notification failed: HTTP ${response.status} ${maskSensitive(body)}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`Slack notification failed: ${maskSensitive(error.message)}`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;

    const normalized = key.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[normalized] = "true";
      continue;
    }

    parsed[normalized] = next;
    index += 1;
  }

  return parsed;
}

function maskSensitive(value) {
  return String(value).replace(/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g, "[SLACK_WEBHOOK_URL]");
}

function severityLabel(value) {
  switch (value) {
    case "INFO":
      return "안내";
    case "ACTION_REQUIRED":
      return "조치 필요";
    case "CRITICAL":
      return "긴급";
    default:
      return value;
  }
}

function statusLabel(value) {
  switch (value) {
    case "RUNNING":
      return "진행 중";
    case "HOLD":
      return "대기";
    case "ACTION_REQUIRED":
      return "조치 필요";
    case "COMPLETE":
      return "완료";
    case "FAILED":
      return "실패";
    default:
      return value;
  }
}
