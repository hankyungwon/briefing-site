// 공휴일 이름 크기 확인용 스크린샷 (모바일 390px / PC 1280px)
// 실행: node tests/shot-holiday.js   → /tmp/hol-390.png, /tmp/hol-pc.png
const H = require("./helper");

(async () => {
  const { server, port } = await H.startServer();
  const browser = await H.launchBrowser();
  const { user, session } = H.mkSession("twopro@hanmail.net", "two");

  const d = new Date();
  const Y = d.getFullYear(), M = String(d.getMonth() + 1).padStart(2, "0");
  const ymd = (n) => Y + "-" + M + "-" + String(n).padStart(2, "0");
  // 이름 길이를 달리해 잘림·줄바꿈을 함께 봅니다.
  const holidays = [
    { day: ymd(3), name: "삼일절" },
    { day: ymd(12), name: "부처님오신날" },
    { day: ymd(18), name: "대통령선거일" },
    { day: ymd(25), name: "성탄절" },
  ];
  const events = [
    { id: 1, type: "meeting", title: "정책회의", start_date: ymd(12), end_date: null, start_time: "14:00", end_time: "15:00", author_name: "이프로", author_id: "x", location: null },
  ];

  for (const [이름, 폭, 높이] of [["hol-390", 390, 900], ["hol-pc", 1280, 1000]]) {
    const page = await H.newPage(browser);
    await page.setViewportSize({ width: 폭, height: 높이 });
    await H.setupPage(page, { user, session, routes: p => {
      if (p === "/rest/v1/events") return events;
      if (p === "/rest/v1/holidays") return holidays;
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "twopro@hanmail.net");
    await page.click('nav button[data-panel="calendar"]');
    await page.waitForTimeout(900);
    const 잰값 = await page.evaluate(() => {
      const 들 = [...document.querySelectorAll(".cal-holname")];
      return 들.map(e => {
        const s = getComputedStyle(e);
        return { 글: e.textContent, 크기: s.fontSize, 굵기: s.fontWeight, 잘림: e.scrollWidth > e.clientWidth + 1 };
      });
    });
    console.log(이름, 폭 + "px:", JSON.stringify(잰값, null, 0));
    const 달력 = await page.$(".cal-grid, .cal-month, #calendar-root") || page;
    await 달력.screenshot({ path: "/tmp/" + 이름 + ".png" });
    await page.close();
  }

  server.close();
  await browser.close();
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
