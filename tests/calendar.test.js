// 일정공유 회귀 테스트 — 같은 날 여러 일정의 시간순 정렬(월·주·일·오늘 현황)
const H = require("./helper");

(async () => {
  const c = H.makeChecker("calendar");
  const { server, port } = await H.startServer();
  const browser = await H.launchBrowser();
  const page = await H.newPage(browser);
  const { user, session } = H.mkSession("twopro@hanmail.net", "two");

  const d = new Date();
  const T = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  // 입력 순서(id)를 시간과 어긋나게 배치: 오후 → 아침 → 종일 → 점심
  const events = [
    { id: 1, type: "meeting", title: "오후회의", start_date: T, end_date: null, start_time: "14:00", end_time: "15:00", author_name: "이프로", author_id: "x", location: null },
    { id: 2, type: "meeting", title: "아침회의", start_date: T, end_date: null, start_time: "09:00", end_time: "10:00", author_name: "이프로", author_id: "x", location: null },
    { id: 3, type: "etc", title: "종일행사", start_date: T, end_date: null, start_time: null, end_time: null, author_name: "이프로", author_id: "x", location: null },
    { id: 4, type: "meal", title: "점심약속", start_date: T, end_date: null, start_time: "11:30", end_time: "12:30", author_name: "이프로", author_id: "x", location: null }
  ];
  const EXPECT = ["아침회의", "점심약속", "오후회의", "종일행사"];

  await H.setupPage(page, { user, session, routes: p => {
    if (p === "/rest/v1/events") return events;
    if (p === "/rest/v1/holidays") return [];
    return H.defaultBriefingRoutes(p);
  }});
  await H.login(page, port, "twopro@hanmail.net");
  await page.click('nav button[data-panel="calendar"]'); await page.waitForTimeout(700);

  const pick = t => { const m = t.match(/(아침회의|점심약속|오후회의|종일행사)/); return m ? m[1] : ""; };

  const strip = await page.evaluate(() => [...document.querySelectorAll(".today-strip .ev-pill")].map(e => e.textContent));
  c.ok(JSON.stringify(strip.map(pick)) === JSON.stringify(EXPECT), "오늘의 현황: 시간순 정렬");

  const month = await page.evaluate(t => { const cell = document.querySelector('.cal-day[data-day="' + t + '"]'); return cell ? [...cell.querySelectorAll(".cal-ev")].map(e => e.textContent.trim()) : []; }, T);
  c.ok(JSON.stringify(month) === JSON.stringify(EXPECT.slice(0, 3)), "월간 뷰(앞 3개): 시간순");

  await page.click('.cal-views button[data-view="day"]'); await page.waitForTimeout(300);
  const day = await page.evaluate(() => [...document.querySelectorAll(".cal-devt h4")].map(h => h.textContent.trim()));
  c.ok(JSON.stringify(day) === JSON.stringify(EXPECT), "일간 뷰: 시간순");

  await page.click('.cal-views button[data-view="week"]'); await page.waitForTimeout(300);
  const week = await page.evaluate(() => {
    for (const col of document.querySelectorAll(".cal-wcol")) {
      const evs = [...col.querySelectorAll(".wev")].map(e => e.textContent.replace(/[0-9:]/g, "").trim());
      if (evs.length >= 4) return evs;
    }
    return [];
  });
  c.ok(JSON.stringify(week) === JSON.stringify(EXPECT), "주간 뷰: 시간순");

  // 「내 캘린더에」 버튼 — 구글 캘린더 추가 화면 URL 검증 (다운로드 없이 바로 열림)
  await page.click('.cal-views button[data-view="day"]'); await page.waitForTimeout(300);
  c.ok(await page.evaluate(() => document.querySelectorAll("[data-ics-ev]").length) === 4, "일간 뷰에 📅 내 캘린더에 버튼");
  await page.evaluate(() => { window.__opened = null; window.open = u => { window.__opened = u; return null; }; });
  await page.click('[data-ics-ev="2"]'); await page.waitForTimeout(100);
  const u1 = new URL(await page.evaluate(() => window.__opened));
  c.ok(u1.hostname === "calendar.google.com" && u1.searchParams.get("action") === "TEMPLATE", "구글 캘린더 추가 화면 열림");
  c.ok(/T090000\/\d{8}T100000$/.test(u1.searchParams.get("dates")) && u1.searchParams.get("ctz") === "Asia/Seoul", "시간 09:00~10:00 + 서울 시간대");
  c.ok(u1.searchParams.get("text") === "[회의] 아침회의", "제목·유형 전달");
  // 종일 일정 → 날짜만(종료 +1일)
  await page.click('[data-ics-ev="3"]'); await page.waitForTimeout(100);
  const u2 = new URL(await page.evaluate(() => window.__opened));
  c.ok(/^\d{8}\/\d{8}$/.test(u2.searchParams.get("dates")), "종일 일정은 날짜 형식");

  // 시각 역전 입력 차단 — 같은 날 14:00~11:00 저장 시도 → 오류 표시, 저장 안 됨
  let posted = false;
  await page.route("**/rest/v1/events**", r => { if (r.request().method() === "POST") posted = true; r.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
  await page.click(".cal-add"); await page.waitForTimeout(200);
  await page.fill("#event-name", "역전 시험");
  await page.fill("#event-stime", "14:00");
  await page.fill("#event-etime", "11:00");
  await page.click("#event-submit"); await page.waitForTimeout(300);
  const err = await page.evaluate(() => ({ shown: document.getElementById("event-error").classList.contains("show"), text: document.getElementById("event-error").textContent, kept: document.getElementById("event-name").value }));
  c.ok(err.shown && /빠르|확인/.test(err.text), "종료<시작 시각 저장 차단 + 안내");
  c.ok(!posted, "차단 시 서버 저장 요청 없음");
  c.ok(err.kept === "역전 시험", "입력 내용 유실 없음");

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
