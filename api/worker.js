// LandingHub API — Cloudflare Worker
// wrangler dev 로 로컬 실행, wrangler deploy 로 배포

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── CORS ───────────────────────────────────────────────
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function json(data, status = 200, env = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function err(msg, status = 400, env = {}) {
  return json({ error: msg }, status, env);
}

// ─── AUTH MIDDLEWARE ────────────────────────────────────
async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return false;

  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    'SELECT id FROM admin_sessions WHERE id = ? AND expires_at > ?'
  ).bind(token, now).first();

  return !!row;
}

// ─── PASSWORD HASH ──────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── RESEND EMAIL ───────────────────────────────────────
async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 'your_resend_api_key_here') {
    console.log(`[MOCK EMAIL] to=${to} subject=${subject}`);
    return { id: 'mock_' + Date.now() };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'LandingHub <noreply@landinghub.kr>',
      to: [to],
      subject,
      html,
      text: text || subject,
    }),
  });
  return res.ok ? await res.json() : null;
}

// ─── ROUTER ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // ── 공개 엔드포인트 ──────────────────────────────────

    // POST /api/subscribe
    if (method === 'POST' && path === '/api/subscribe') {
      return handleSubscribe(request, env, ctx);
    }

    // GET or POST /api/unsubscribe
    if (path === '/api/unsubscribe' && (method === 'GET' || method === 'POST')) {
      return handleUnsubscribe(request, env, url);
    }

    // POST /api/admin/login
    if (method === 'POST' && path === '/api/admin/login') {
      return handleLogin(request, env);
    }

    // ── 인증 필요 엔드포인트 ─────────────────────────────
    if (path.startsWith('/api/admin/')) {
      const authed = await authenticate(request, env);
      if (!authed) return err('인증이 필요합니다.', 401, env);

      // DELETE /api/admin/logout
      if (method === 'DELETE' && path === '/api/admin/logout') {
        return handleLogout(request, env);
      }

      // GET /api/admin/stats
      if (method === 'GET' && path === '/api/admin/stats') {
        return handleStats(url, env);
      }

      // GET /api/admin/subscribers/export
      if (method === 'GET' && path === '/api/admin/subscribers/export') {
        return handleExport(env);
      }

      // GET /api/admin/subscribers
      if (method === 'GET' && path === '/api/admin/subscribers') {
        return handleListSubscribers(url, env);
      }

      // DELETE /api/admin/subscribers/:id
      const subMatch = path.match(/^\/api\/admin\/subscribers\/(\d+)$/);
      if (subMatch) {
        if (method === 'DELETE') return handleDeleteSubscriber(subMatch[1], env);
        if (method === 'PATCH')  return handlePatchSubscriber(subMatch[1], request, env);
      }

      // GET /api/admin/templates
      if (method === 'GET' && path === '/api/admin/templates') {
        return handleListTemplates(env);
      }

      // POST /api/admin/templates
      if (method === 'POST' && path === '/api/admin/templates') {
        return handleCreateTemplate(request, env);
      }

      const tplMatch = path.match(/^\/api\/admin\/templates\/(\d+)$/);
      if (tplMatch) {
        const id = tplMatch[1];
        if (method === 'GET') return handleGetTemplate(id, env);
        if (method === 'PATCH') return handlePatchTemplate(id, request, env);
        if (method === 'DELETE') return handleDeleteTemplate(id, env);
      }

      // POST /api/admin/campaigns
      if (method === 'POST' && path === '/api/admin/campaigns') {
        return handleCreateCampaign(request, env);
      }

      // GET /api/admin/campaigns
      if (method === 'GET' && path === '/api/admin/campaigns') {
        return handleListCampaigns(url, env);
      }

      const campMatch = path.match(/^\/api\/admin\/campaigns\/(\d+)(\/.*)?$/);
      if (campMatch) {
        const id = campMatch[1];
        const sub = campMatch[2] || '';

        // GET /api/admin/campaigns/:id/logs
        if (method === 'GET' && sub === '/logs') return handleCampaignLogs(id, url, env);

        // POST /api/admin/campaigns/:id/send
        if (method === 'POST' && sub === '/send') return handleSend(id, env, ctx);

        // GET /api/admin/campaigns/:id
        if (method === 'GET' && sub === '') return handleGetCampaign(id, env);

        // PATCH /api/admin/campaigns/:id
        if (method === 'PATCH' && sub === '') return handlePatchCampaign(id, request, env);

        // DELETE /api/admin/campaigns/:id  (draft only)
        if (method === 'DELETE' && sub === '') return handleDeleteCampaign(id, env);
      }
    }

    return err('Not Found', 404, env);
  },
};

// ═══════════════════════════════════════════════════════
// 핸들러 구현
// ═══════════════════════════════════════════════════════

// ── 구독 ────────────────────────────────────────────────
async function handleSubscribe(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return err('잘못된 요청입니다.', 400, env); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return err('올바른 이메일 주소를 입력해주세요.', 400, env);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = request.headers.get('User-Agent') || '';

  const existing = await env.DB.prepare(
    'SELECT id, status FROM subscribers WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    if (existing.status === 'active') {
      return json({ message: '이미 구독 중인 이메일입니다.' }, 200, env);
    }
    await env.DB.prepare(
      "UPDATE subscribers SET status='active', updated_at=datetime('now'), unsubscribed_at=NULL WHERE id=?"
    ).bind(existing.id).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO subscribers (email, ip, user_agent) VALUES (?, ?, ?)'
    ).bind(email, ip, ua).run();
  }

  // 환영 이메일 백그라운드 발송
  ctx.waitUntil(sendEmail(env, {
    to: email,
    subject: '🎉 LandingHub 구독을 환영합니다!',
    html: `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:800;color:#7c6af5">LandingHub</span>
        </div>
        <h2 style="color:#111;font-size:20px;margin:0 0 12px">구독해 주셔서 감사합니다! 🎉</h2>
        <p style="color:#444;line-height:1.6;margin:0 0 20px">안녕하세요!<br>새 랜딩페이지가 등록되면 가장 먼저 알려드릴게요.</p>
        <p style="margin:32px 0 0;font-size:0.8rem;color:#999">
          구독을 취소하려면 <a href="${new URL(request.url).origin}/api/unsubscribe?email=${encodeURIComponent(email)}" style="color:#7c6af5">여기</a>를 클릭하세요.
        </p>
      </div>
    </body></html>`,
  }));

  return json({ message: '구독이 완료되었습니다! 환영 이메일을 확인해보세요.' }, 201, env);
}

// ── 구독 취소 ───────────────────────────────────────────
async function handleUnsubscribe(request, env, url) {
  let email = url.searchParams.get('email') || '';
  if (!email && request.method === 'POST') {
    try { const b = await request.json(); email = b.email || ''; } catch {}
  }
  email = email.trim().toLowerCase();

  const htmlPage = (title, msg, sub) => new Response(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} — LandingHub</title>
    <style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{background:#fff;border-radius:16px;padding:48px 40px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{font-size:48px;margin-bottom:16px}.title{font-size:22px;font-weight:800;color:#111;margin:0 0 10px}
    .msg{font-size:14px;color:#666;line-height:1.6;margin:0 0 24px}.email{font-size:13px;color:#6366f1;font-weight:600;word-break:break-all}
    a{color:#6366f1;font-size:13px}</style></head>
    <body><div class="box"><div class="icon">${sub ? '✅' : '⚠️'}</div>
    <div class="title">${title}</div>
    <div class="msg">${msg}${email ? `<br><span class="email">${email}</span>` : ''}</div>
    <a href="/">LandingHub 홈으로 →</a></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
  );

  if (!email) return htmlPage('잘못된 요청', '이메일 주소가 없습니다.', false);

  await env.DB.prepare(
    "UPDATE subscribers SET status='unsubscribed', updated_at=datetime('now'), unsubscribed_at=datetime('now') WHERE email=?"
  ).bind(email).run();

  return htmlPage('구독이 취소되었습니다', '더 이상 LandingHub 뉴스레터를 받지 않습니다.', true);
}

// ── 관리자 로그인 ────────────────────────────────────────
async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('잘못된 요청입니다.', 400, env); }

  const { password } = body;
  if (!password) return err('비밀번호를 입력해주세요.', 400, env);

  const hash = await sha256(password);
  const stored = env.ADMIN_PASSWORD_HASH || '';

  if (!stored || stored === 'your_sha256_hash_here') {
    return err('.dev.vars 에 ADMIN_PASSWORD_HASH 를 설정해주세요.', 500, env);
  }

  if (hash !== stored) return err('비밀번호가 올바르지 않습니다.', 401, env);

  // 오래된 세션 정리
  await env.DB.prepare(
    "DELETE FROM admin_sessions WHERE expires_at < datetime('now')"
  ).run();

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const ip = request.headers.get('CF-Connecting-IP') || '';

  await env.DB.prepare(
    'INSERT INTO admin_sessions (id, expires_at, ip) VALUES (?, ?, ?)'
  ).bind(token, expiresAt, ip).run();

  return json({ token, expiresAt }, 200, env);
}

// ── 로그아웃 ────────────────────────────────────────────
async function handleLogout(request, env) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(token).run();
  return json({ message: '로그아웃 되었습니다.' }, 200, env);
}

// ── 대시보드 통계 ────────────────────────────────────────
async function handleStats(url, env) {
  const recentSubscribersLimit = clampInt(url.searchParams.get('recentSubscribers'), 4, 24, 5);
  const recentCampaignsLimit = clampInt(url.searchParams.get('recentCampaigns'), 3, 20, 3);
  const [total, thisMonth, campaigns, successRate, recent, recentCamps] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as n FROM subscribers WHERE status='active'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM subscribers WHERE status='active' AND created_at >= date('now','start of month')").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM campaigns WHERE status='sent'").first(),
    env.DB.prepare("SELECT ROUND(SUM(CASE WHEN status='sent' THEN 1.0 ELSE 0 END)/COUNT(*)*100,1) as r FROM send_logs").first(),
    env.DB.prepare(`SELECT id,email,created_at FROM subscribers WHERE status='active' ORDER BY created_at DESC LIMIT ${recentSubscribersLimit}`).all(),
    env.DB.prepare(`SELECT id,subject,status,sent_at,total_sent FROM campaigns ORDER BY created_at DESC LIMIT ${recentCampaignsLimit}`).all(),
  ]);

  const resendKey = env.RESEND_API_KEY;
  const resendConnected = !!(resendKey && resendKey !== 'your_resend_api_key_here');

  return json({
    totalSubscribers: total?.n ?? 0,
    thisMonthSubscribers: thisMonth?.n ?? 0,
    totalCampaigns: campaigns?.n ?? 0,
    successRate: successRate?.r ?? 0,
    recentSubscribers: recent.results,
    recentCampaigns: recentCamps.results,
    resendConnected,
  });
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ── 구독자 목록 ─────────────────────────────────────────
async function handleListSubscribers(url, env) {
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit  = 20;
  const offset = (page - 1) * limit;
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';

  let where = '1=1';
  const params = [];
  if (status !== 'all') { where += ' AND status=?'; params.push(status); }
  if (search) { where += ' AND email LIKE ?'; params.push(`%${search}%`); }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM subscribers WHERE ${where}`)
    .bind(...params).first();
  const rows = await env.DB.prepare(
    `SELECT id,email,status,source,created_at FROM subscribers WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return json({
    subscribers: rows.results,
    total: countRow?.n ?? 0,
    page,
    totalPages: Math.ceil((countRow?.n ?? 0) / limit),
  });
}

// ── 구독자 삭제 ─────────────────────────────────────────
async function handleDeleteSubscriber(id, env) {
  await env.DB.prepare('DELETE FROM subscribers WHERE id=?').bind(id).run();
  return json({ message: '삭제되었습니다.' });
}

// ── 구독자 상태 변경 ────────────────────────────────────
async function handlePatchSubscriber(id, request, env) {
  let body;
  try { body = await request.json(); } catch { return err('잘못된 요청입니다.', 400, env); }
  const allowed = ['active','unsubscribed','bounced','complained'];
  if (!allowed.includes(body.status)) return err('올바른 상태값이 아닙니다.', 400, env);

  const unsubAt = body.status === 'unsubscribed' ? ",unsubscribed_at=datetime('now')" : '';
  await env.DB.prepare(
    `UPDATE subscribers SET status=?, updated_at=datetime('now')${unsubAt} WHERE id=?`
  ).bind(body.status, id).run();

  return json({ message: '상태가 변경되었습니다.' });
}

// ── CSV 내보내기 ────────────────────────────────────────
async function handleExport(env) {
  const rows = await env.DB.prepare(
    'SELECT email,status,source,created_at,unsubscribed_at FROM subscribers ORDER BY created_at DESC'
  ).all();

  const header = 'email,status,source,created_at,unsubscribed_at\n';
  const body = rows.results.map(r =>
    `${r.email},${r.status},${r.source || ''},${r.created_at},${r.unsubscribed_at || ''}`
  ).join('\n');

  return new Response(header + body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
      ...corsHeaders(env),
    },
  });
}

// ── 캠페인 생성 ─────────────────────────────────────────
// ── 템플릿 ────────────────────────────────────────────
async function ensureTemplateSeed(env) {
  const countRow = await env.DB.prepare('SELECT COUNT(*) as n FROM templates').first();
  if ((countRow?.n ?? 0) > 0) return;

  await env.DB.prepare(`
    INSERT INTO templates (subject, preview_text, body_html, body_text)
    SELECT subject, preview_text, body_html, body_text
    FROM campaigns
    WHERE status='draft'
    ORDER BY created_at DESC
  `).run();
}

async function handleListTemplates(env) {
  await ensureTemplateSeed(env);
  const rows = await env.DB.prepare(
    'SELECT id,subject,preview_text,created_at,updated_at FROM templates ORDER BY updated_at DESC, created_at DESC'
  ).all();
  return json({ templates: rows.results });
}

async function handleCreateTemplate(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('??? ?????.', 400, env); }
  if (!body.subject || !body.body_html) return err('??? ??? ?????.', 400, env);

  const result = await env.DB.prepare(
    'INSERT INTO templates (subject,preview_text,body_html,body_text) VALUES (?,?,?,?) RETURNING id'
  ).bind(body.subject, body.preview_text || null, body.body_html, body.body_text || null).first();

  return json({ id: result.id, message: '???? ???????.' }, 201, env);
}

async function handleGetTemplate(id, env) {
  const row = await env.DB.prepare('SELECT * FROM templates WHERE id=?').bind(id).first();
  if (!row) return err('템플릿을 찾을 수 없습니다.', 404, env);
  return json(row);
}

async function handlePatchTemplate(id, request, env) {
  let body;
  try { body = await request.json(); } catch { return err('?섎せ???붿껌?낅땲??', 400, env); }

  const tpl = await env.DB.prepare('SELECT id FROM templates WHERE id=?').bind(id).first();
  if (!tpl) return err('템플릿을 찾을 수 없습니다.', 404, env);
  if (!body.subject || !body.body_html) return err('?쒕ぉ怨?蹂몃Ц? ?꾩닔?낅땲??', 400, env);

  await env.DB.prepare(
    "UPDATE templates SET subject=?, preview_text=?, body_html=?, body_text=?, updated_at=datetime('now') WHERE id=?"
  ).bind(body.subject, body.preview_text || null, body.body_html, body.body_text || null, id).run();

  return json({ message: '템플릿이 수정되었습니다.' });
}

async function handleDeleteTemplate(id, env) {
  const tpl = await env.DB.prepare('SELECT id FROM templates WHERE id=?').bind(id).first();
  if (!tpl) return err('템플릿을 찾을 수 없습니다.', 404, env);
  await env.DB.prepare('DELETE FROM templates WHERE id=?').bind(id).run();
  return json({ message: '템플릿이 삭제되었습니다.' });
}

async function handleCreateCampaign(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('??? ?????.', 400, env); }
  if (!body.subject || !body.body_html) return err('??? ??? ?????.', 400, env);
  const templateId = body.template_id === undefined || body.template_id === null || body.template_id === "" ? null : Number(body.template_id);
  if (templateId !== null && !Number.isFinite(templateId)) return err('??? ?????.', 400, env);
  if (templateId !== null) {
    const tpl = await env.DB.prepare('SELECT id FROM templates WHERE id=?').bind(templateId).first();
    if (!tpl) return err('???? ?? ? ????.', 404, env);
  }

  const result = await env.DB.prepare(
    'INSERT INTO campaigns (subject,preview_text,body_html,body_text,template_id) VALUES (?,?,?,?,?) RETURNING id'
  ).bind(body.subject, body.preview_text || null, body.body_html, body.body_text || null, templateId).first();

  return json({ id: result.id, message: '?????????.' }, 201, env);
}

// ???? ???????? ??????????????????????????????????????????????????????????????????????????????????
async function handleListCampaigns(url, env) {
  const status = url.searchParams.get('status') || 'all';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit  = 20;
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];
  if (status !== 'all') { where += ' AND c.status=?'; params.push(status); }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM campaigns c WHERE ${where}`).bind(...params).first();
  const rows = await env.DB.prepare(
    `SELECT c.id,c.subject,c.status,c.sent_at,c.total_sent,c.total_failed,c.created_at,c.template_id,t.subject as template_subject
     FROM campaigns c
     LEFT JOIN templates t ON t.id = c.template_id
     WHERE ${where}
     ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return json({
    campaigns: rows.results,
    total: countRow?.n ?? 0,
    page,
    totalPages: Math.ceil((countRow?.n ?? 0) / limit),
  });
}

// ── 캠페인 상세 ─────────────────────────────────────────
async function handleGetCampaign(id, env) {
  const row = await env.DB.prepare(
    'SELECT c.*, t.subject as template_subject FROM campaigns c LEFT JOIN templates t ON t.id = c.template_id WHERE c.id=?'
  ).bind(id).first();
  if (!row) return err('캠페인을 찾을 수 없습니다.', 404, env);
  return json(row);
}

// ── 캠페인 수정 ─────────────────────────────────────────
async function handlePatchCampaign(id, request, env) {
  let body;
  try { body = await request.json(); } catch { return err('잘못된 요청입니다.', 400, env); }

  const camp = await env.DB.prepare("SELECT status FROM campaigns WHERE id=?").bind(id).first();
  if (!camp) return err('캠페인을 찾을 수 없습니다.', 404, env);
  if (camp.status === 'sent') return err('이미 발송된 캠페인은 수정할 수 없습니다.', 400, env);

  await env.DB.prepare(
    "UPDATE campaigns SET subject=COALESCE(?,subject), preview_text=COALESCE(?,preview_text), body_html=COALESCE(?,body_html), body_text=COALESCE(?,body_text), template_id=COALESCE(?,template_id), updated_at=datetime('now') WHERE id=?"
  ).bind(body.subject || null, body.preview_text || null, body.body_html || null, body.body_text || null, body.template_id || null, id).run();

  return json({ message: '저장되었습니다.' });
}

// ── 캠페인 삭제 (초안만) ────────────────────────────────
async function handleDeleteCampaign(id, env) {
  const camp = await env.DB.prepare("SELECT status FROM campaigns WHERE id=?").bind(id).first();
  if (!camp) return err('캠페인을 찾을 수 없습니다.', 404, env);
  if (camp.status !== 'draft') return err('초안 상태의 캠페인만 삭제할 수 있습니다.', 400, env);
  await env.DB.prepare('DELETE FROM campaigns WHERE id=?').bind(id).run();
  return json({ message: '초안이 삭제되었습니다.' });
}

// ── 캠페인 발송 ─────────────────────────────────────────
async function handleSend(id, env, ctx) {
  const camp = await env.DB.prepare('SELECT * FROM campaigns WHERE id=?').bind(id).first();
  if (!camp) return err('캠페인을 찾을 수 없습니다.', 404, env);
  if (camp.status !== 'draft') return err('초안 상태의 캠페인만 발송할 수 있습니다.', 400, env);

  // 즉시 sending으로 변경하고 응답 반환
  await env.DB.prepare("UPDATE campaigns SET status='sending', updated_at=datetime('now') WHERE id=?").bind(id).run();

  // 백그라운드에서 발송 처리
  ctx.waitUntil(doSend(id, camp, env));

  const subCount = await env.DB.prepare("SELECT COUNT(*) as n FROM subscribers WHERE status='active'").first();
  return json({ message: `발송을 시작했습니다. 대상: ${subCount?.n ?? 0}명`, status: 'sending' }, 200, env);
}

async function doSend(id, camp, env) {
  try {
    const subscribers = await env.DB.prepare(
      "SELECT id,email FROM subscribers WHERE status='active'"
    ).all();

    let sent = 0, failed = 0;
    for (const sub of subscribers.results) {
      try {
        const unsubUrl = `https://landinghub-api.lanfinghub-kr.workers.dev/api/unsubscribe?email=${encodeURIComponent(sub.email)}`;
        const html = (camp.body_html || '')
          .replaceAll('{{unsubscribe_url}}', unsubUrl)
          .replace(/href="#"/g, `href="${unsubUrl}"`);
        const result = await sendEmail(env, {
          to: sub.email,
          subject: camp.subject,
          html,
          text: camp.body_text,
        });
        await env.DB.prepare(
          "INSERT OR IGNORE INTO send_logs (campaign_id,subscriber_id,email,status,resend_id) VALUES (?,?,?,'sent',?)"
        ).bind(id, sub.id, sub.email, result?.id || null).run();
        sent++;
      } catch (e) {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO send_logs (campaign_id,subscriber_id,email,status,error_msg) VALUES (?,?,?,'failed',?)"
        ).bind(id, sub.id, sub.email, String(e)).run();
        failed++;
      }
    }

    await env.DB.prepare(
      "UPDATE campaigns SET status='sent', sent_at=datetime('now'), total_sent=?, total_failed=?, updated_at=datetime('now') WHERE id=?"
    ).bind(sent, failed, id).run();
  } catch (e) {
    await env.DB.prepare(
      "UPDATE campaigns SET status='failed', updated_at=datetime('now') WHERE id=?"
    ).bind(id).run();
  }
}

// ── 발송 로그 ───────────────────────────────────────────
async function handleCampaignLogs(id, url, env) {
  const status = url.searchParams.get('status') || 'all';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit  = 50;
  const offset = (page - 1) * limit;

  let where = 'campaign_id=?';
  const params = [id];
  if (status !== 'all') { where += ' AND status=?'; params.push(status); }

  const countRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM send_logs WHERE ${where}`).bind(...params).first();
  const rows = await env.DB.prepare(
    `SELECT id,email,status,resend_id,error_msg,sent_at FROM send_logs WHERE ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return json({
    logs: rows.results,
    total: countRow?.n ?? 0,
    page,
    totalPages: Math.ceil((countRow?.n ?? 0) / limit),
  });
}
