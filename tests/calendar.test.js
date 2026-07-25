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

  // 「내 캘린더에」 버튼 — .ics 파일 생성 내용 검증
  await page.click('.cal-views button[data-view="day"]'); await page.waitForTimeout(300);
  c.ok(await page.evaluate(() => document.querySelectorAll("[data-ics-ev]").length) === 4, "일간 뷰에 📅 내 캘린더에 버튼");
  const fs = require("fs");
  const dl = await Promise.all([page.waitForEvent("download"), page.click('[data-ics-ev="2"]')]).then(a => a[0]);
  const ics = fs.readFileSync(await dl.path(), "utf8");
  c.ok(/BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/.test(ics), "ICS 구조 유효");
  c.ok(/DTSTART;TZID=Asia\/Seoul:\d{8}T090000/.test(ics) && /DTEND;TZID=Asia\/Seoul:\d{8}T100000/.test(ics), "ICS 시간 09:00~10:00");
  c.ok(/SUMMARY:\[회의\] 아침회의/.test(ics), "ICS 제목·유형");
  // 종일 일정 → DATE 형식 + 종료 +1일
  const dl2 = await Promise.all([page.waitForEvent("download"), page.click('[data-ics-ev="3"]')]).then(a => a[0]);
  const ics2 = fs.readFileSync(await dl2.path(), "utf8");
  c.ok(/DTSTART;VALUE=DATE:\d{8}/.test(ics2) && /DTEND;VALUE=DATE:\d{8}/.test(ics2), "종일 일정 DATE 형식");

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
