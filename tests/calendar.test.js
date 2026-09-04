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

  // 「일정 등록」은 같은 줄의 다른 버튼과 어울리는 조용한 무게 — 채운 파랑으로 시선을 끌지 않는다
  const addBtn = await page.evaluate(() => { const b = document.querySelector(".cal-add"); const cs = getComputedStyle(b); return { bg: cs.backgroundColor, bc: cs.borderTopColor, color: cs.color }; });
  c.ok(/255, 255, 255/.test(addBtn.bg) && addBtn.color === "rgb(14, 95, 168)", "「일정 등록」은 흰 바탕 테두리형 — 시선을 끌지 않음 (" + addBtn.bg + ")");

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

  // 구글 캘린더 연동 제거 — 버튼도, 연동 흔적도 남아 있지 않아야 합니다.
  await page.click('.cal-views button[data-view="day"]'); await page.waitForTimeout(300);
  const 연동 = await page.evaluate(() => ({
    버튼: document.querySelectorAll("[data-ics-ev]").length,
    문구: [...document.querySelectorAll(".cal-devt")].some(e => e.textContent.includes("내 캘린더에")),
    함수: typeof window.gcalAddUrl + "/" + typeof window.openCalendarAdd,
    링크: [...document.querySelectorAll("a[href]")].some(a => a.href.includes("calendar.google.com")),
  }));
  c.ok(연동.버튼 === 0, "일간 뷰에 캘린더 추가 버튼 없음");
  c.ok(연동.문구 === false, "「내 캘린더에」 문구 없음");
  c.ok(연동.함수 === "undefined/undefined", "gcalAddUrl·openCalendarAdd 없음");
  c.ok(연동.링크 === false, "calendar.google.com 링크 없음");
  // 과잉 삭제 방지 — 일정 카드와 그 정보(유형·시간·등록자)는 그대로여야 합니다.
  const 카드 = await page.evaluate(() => ({
    수: document.querySelectorAll(".cal-devt").length,
    유형: document.querySelectorAll(".cal-devt .type-tag").length,
    첫칸: (document.querySelector(".cal-devt .dmeta") || {}).textContent || "",
  }));
  c.ok(카드.수 === 4 && 카드.유형 === 4, "일정 카드 4건 + 유형 태그 유지");
  c.ok(/09:00~10:00/.test(카드.첫칸) && /이프로/.test(카드.첫칸), "시간·등록자 표시 유지");

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

  // 오늘 날짜 칸의 사각 테두리 + 종류별 색 구분(회의 주황 / 식사 보라 — 서로 헷갈리지 않게)
  // 앞 검사에서 열어둔 등록창을 닫고 월간 보기로 되돌린 뒤 확인
  await page.evaluate(() => { document.getElementById("event-modal").classList.remove("open"); });
  await page.click('[data-view="month"]'); await page.waitForTimeout(400);
  const look = await page.evaluate(() => {
    const t = document.querySelector(".cal-day.today");
    const byType = {};
    document.querySelectorAll(".today-strip .ev-pill").forEach(p => {
      const d = p.querySelector(".ev-dot"); const txt = p.textContent;
      if (!d) return;
      if (/회의/.test(txt)) byType.meeting = getComputedStyle(d).backgroundColor;
      if (/식사/.test(txt)) byType.meal = getComputedStyle(d).backgroundColor;
    });
    return { shadow: t ? getComputedStyle(t).boxShadow : "", byType };
  });
  c.ok(/inset/.test(look.shadow) && /1\.5px/.test(look.shadow), "오늘 날짜 칸에 얇은 사각 테두리 (" + look.shadow + ")");
  c.ok(look.byType.meeting && look.byType.meal && look.byType.meeting !== look.byType.meal,
    "회의와 식사 색이 서로 다름 (회의 " + look.byType.meeting + " / 식사 " + look.byType.meal + ")");
  c.ok(look.byType.meal === "rgb(126, 87, 194)", "식사는 주황과 헷갈리지 않는 보라");

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
