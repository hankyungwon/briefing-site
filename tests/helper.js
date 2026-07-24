// 공용 테스트 도우미 — 정적 서버 + 브라우저 + Supabase 목(mock) 라우팅
// 실행 환경: node + playwright (chromium 경로는 PW_CHROMIUM 환경변수, 기본 /opt/pw-browsers/chromium)
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SB = "https://bpkliumilseyuloutsqt.supabase.co";
const CHROMIUM = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
const VENDOR_SUPABASE = path.join(__dirname, "vendor", "supabase.js");

function b64(o) { return Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

// 가짜 로그인 세션(JWT 서명은 검증되지 않으므로 형식만 갖춤)
function mkSession(email, uid) {
  const jwt = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: uid, email, role: "authenticated", aud: "authenticated", exp: 4102444800 }), "s"].join(".");
  const user = { id: uid, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  return { user, session: { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: 9999999999, refresh_token: "rt", user } };
}

// 저장소 루트를 서빙하는 임시 정적 서버 (포트 자동 할당)
function startServer() {
  const types = { ".html": "text/html", ".js": "application/javascript", ".png": "image/png", ".xml": "text/xml", ".txt": "text/plain" };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html");
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

// 페이지에 목 라우팅 장착 — routes(pathname, method, request)가 undefined를 주면 []로 응답
async function setupPage(page, { user, session, routes }) {
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", r =>
    r.fulfill({ contentType: "application/javascript", body: fs.readFileSync(VENDOR_SUPABASE, "utf8") }));
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", r => r.fulfill({ status: 200, body: "" }));
  await page.route(SB + "/**", route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, m = req.method();
    const json = (x, st) => route.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(x) });
    if (p === "/auth/v1/token") return json(session);
    if (p === "/auth/v1/user") return json(user);
    const out = routes ? routes(p, m, req, url) : undefined;
    return json(out === undefined ? [] : out, out && out.__status);
  });
}

async function newPage(browser, opts = {}) {
  return browser.newPage({ viewport: opts.viewport || { width: 1300, height: 1000 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, acceptDownloads: true });
}

async function login(page, port, email) {
  await page.goto("http://127.0.0.1:" + port + "/index.html");
  await page.waitForSelector(".brief-head");
  await page.click("#auth-btn");
  await page.fill("#login-email", email);
  await page.fill("#login-password", "x");
  await page.click("#login-submit");
  await page.waitForTimeout(700);
}

// 편집기 전체 선택(툴바 적용 대상 만들기)
const selAll = (page, id) => page.evaluate(i => {
  const ed = document.getElementById(i); ed.focus();
  const r = document.createRange(); r.selectNodeContents(ed);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  ed.dispatchEvent(new Event("mouseup"));
}, id);

// 최소 브리핑 목 데이터(홈 화면 렌더용)
function defaultBriefingRoutes(p) {
  if (p === "/rest/v1/briefings") return [{ id: 4, issue_no: 4, published_date: "2026-07-21", edition: "daily" }];
  if (p === "/rest/v1/briefing_items") return [{ id: 40, briefing_id: 4, category: "gov", title: "AI", keyword: "AI", summary: "x", source_url: "https://a.b", source_name: "출처", position: 1 }];
  return undefined;
}

// 간단 검증 러너 — 실패를 모아 마지막에 종료코드로 알림
function makeChecker(name) {
  const fails = [];
  return {
    ok(cond, label) { console.log((cond ? "  ✓ " : "  ✗ ") + label); if (!cond) fails.push(label); },
    async finish(browser) {
      if (browser) await browser.close();
      if (fails.length) { console.error("\n[" + name + "] 실패 " + fails.length + "건:\n - " + fails.join("\n - ")); process.exit(1); }
      console.log("\n[" + name + "] 전체 통과");
    }
  };
}

async function launchBrowser() {
  const { chromium } = require("playwright");
  return chromium.launch({ executablePath: CHROMIUM });
}

module.exports = { SB, mkSession, startServer, setupPage, newPage, login, selAll, defaultBriefingRoutes, makeChecker, launchBrowser };
