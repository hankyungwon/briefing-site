// 레이아웃 회귀 테스트 — 서체·브라우저가 달라져도 글자가 쪼개지거나 화면이 넘치지 않는지 검사
//
// 배경: 이 환경에는 Noto 한글 서체가 없어 테스트가 대체 서체(폭이 좁음)로 렌더된다.
// 실제 사용자(맥·윈도우)는 Noto가 로드돼 글자 폭이 더 넓으므로, 로컬에서 멀쩡해 보여도
// 실제 화면에서는 배지가 두 줄로 갈라지는 사고가 났다(「최신」 배지).
// 그래서 여기서는 서체를 흉내 내는 대신 **폭을 실제보다 좁혀** 최악 조건을 만들어 검사한다.
// 좁은 폭에서 한 줄을 지키면, 서체가 넓어져도 지킨다.
const H = require("./helper");

const WIDTHS = [1400, 1280, 1024, 900, 820, 768, 640, 540, 430, 412, 390, 375, 360, 320];

(async () => {
  const c = H.makeChecker("layout");
  const { server, port } = await H.startServer();
  const browser = await H.launchBrowser();
  const { user, session } = H.mkSession("twopro@hanmail.net", "two");

  const briefings = [
    { id: 12, issue_no: 12, published_date: "2026-07-31", edition: "daily" },
    { id: 11, issue_no: 11, published_date: "2026-07-30", edition: "daily" },
    { id: 8, issue_no: 8, published_date: "2026-07-27", edition: "weekend" },
    { id: 7, issue_no: 7, published_date: "2026-07-24", edition: "holiday" }
  ];
  const items = briefings.flatMap(b => ["gov", "seoul", "world", "ahead"].map((cat, i) => ({
    id: b.id * 10 + i, briefing_id: b.id, category: cat, title: "긴 제목도 상자를 넘지 않아야 한다",
    keyword: "AI 정부 사례집", summary: "요약", implication: "함의",
    source_url: "https://example.com/a/very/long/path/that/cannot/be/broken/anywhere",
    source_name: "출처", position: i + 1
  })));
  const today = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
  const events = [
    { id: 1, type: "meeting", title: "회의", start_date: today, end_date: null, start_time: "09:00", end_time: "10:00", author_name: "이프로", author_id: "two", location: "구청" },
    { id: 2, type: "meal", title: "식사", start_date: today, end_date: null, start_time: "12:00", end_time: "13:00", author_name: "한프로", author_id: "x", location: null }
  ];

  const page = await H.newPage(browser);
  await H.setupPage(page, { user, session, routes: p => {
    if (p === "/rest/v1/briefings") return briefings;
    if (p === "/rest/v1/briefing_items") return items;
    if (p === "/rest/v1/events") return events;
    if (p === "/rest/v1/holidays") return [{ day: today, name: "부처님오신날" }];
    return [];
  }});
  await H.login(page, port, "twopro@hanmail.net");

  // 한 줄을 지켜야 하는 요소들 — 갈라지면 상자가 두 동강 나 눈에 바로 띈다
  const ONELINE = ".arch-card .an, .edition-chip, .type-tag, .kind-tag, .pin-badge, .att-badge, .mlog-badge, .cat-label, .cd-label";

  // 요소가 몇 줄을 차지하는지 = 실제 높이 ÷ 한 줄 높이. 1줄을 넘으면 갈라진 것.
  const measure = sel => page.evaluate(s => {
    const bad = [];
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;                 // 숨겨진 요소는 건너뜀
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      if (r.height > lh * 1.6) bad.push((el.className || el.tagName) + " h=" + r.height.toFixed(0) + " lh=" + lh.toFixed(0) + " «" + el.textContent.trim().slice(0, 12) + "»");
    }
    return bad;
  }, sel);

  const overflow = () => page.evaluate(() => {
    const de = document.documentElement;
    const over = [];
    if (de.scrollWidth > de.clientWidth + 1) over.push("문서 가로 스크롤 " + de.scrollWidth + ">" + de.clientWidth);
    return over;
  });

  const TABS = [["archive", "지난브리핑"], ["today", "이슈브리핑"], ["calendar", "일정공유"]];

  for (const [panel, label] of TABS) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.click('nav button[data-panel="' + panel + '"]');
    await page.waitForTimeout(600);

    const splits = [], overflows = [];
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.waitForTimeout(120);
      const bad = await measure(ONELINE);
      if (bad.length) splits.push(w + "px: " + bad[0]);
      const ov = await overflow();
      if (ov.length) overflows.push(w + "px: " + ov[0]);
    }
    c.ok(splits.length === 0, label + ": 배지·라벨이 어느 폭에서도 갈라지지 않음" + (splits.length ? " — " + splits.slice(0, 3).join(" / ") : ""));
    c.ok(overflows.length === 0, label + ": 가로 스크롤 없음" + (overflows.length ? " — " + overflows.slice(0, 3).join(" / ") : ""));
  }

  // 실제보다 가혹한 조건 — 카드 폭을 강제로 좁혀 서체가 넓어진 상황을 흉내
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.click('nav button[data-panel="archive"]'); await page.waitForTimeout(500);
  const squeezed = [];
  for (const cw of [230, 200, 170, 150, 140]) {
    await page.evaluate(w => {
      let s = document.getElementById("__squeeze");
      if (!s) { s = document.createElement("style"); s.id = "__squeeze"; document.head.appendChild(s); }
      s.textContent = "#archive-list{grid-template-columns:repeat(auto-fill,minmax(" + w + "px," + w + "px))!important;}";
    }, cw);
    await page.waitForTimeout(120);
    const bad = await measure(".arch-card .an, .edition-chip");
    if (bad.length) squeezed.push(cw + "px 카드: " + bad[0]);
  }
  c.ok(squeezed.length === 0, "카드 폭 140px까지 좁혀도 호수·배지가 한 줄 유지" + (squeezed.length ? " — " + squeezed.slice(0, 3).join(" / ") : ""));

  // 전역 원칙이 실제로 적용됐는지 — 요소마다 손으로 바르지 않아도 상속되어야 한다
  const base = await page.evaluate(() => {
    const p = document.querySelector("#archive .arch-kw .k .kt") || document.body;
    const cs = getComputedStyle(p);
    return { wb: getComputedStyle(document.body).wordBreak, ow: getComputedStyle(document.body).overflowWrap, inherited: cs.wordBreak };
  });
  c.ok(base.wb === "keep-all", "본문 전역 word-break:keep-all (현재 " + base.wb + ")");
  c.ok(base.ow === "break-word", "긴 문자열 안전장치 overflow-wrap:break-word (현재 " + base.ow + ")");
  c.ok(base.inherited === "keep-all", "하위 요소에도 상속됨 (현재 " + base.inherited + ")");

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
