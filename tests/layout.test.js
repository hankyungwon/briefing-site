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

  // 지난브리핑 카드 머리(호수+배지+날짜)는 한 줄을 지켜야 한다.
  // 두 줄로 밀리면 카드마다 날짜 위치와 키워드 시작 높이가 어긋나 목록이 들쭉날쭉해진다.
  // 실제 Noto 서체는 이 환경의 대체 서체보다 넓으므로, 자간을 벌려 그 상황을 흉내 낸 뒤 검사한다.
  await page.evaluate(() => { const s = document.getElementById("__squeeze"); if (s) s.textContent = ""; });
  await page.setViewportSize({ width: 1280, height: 1000 }); await page.waitForTimeout(150);
  const wide = [];
  for (const ls of [0, 0.4, 0.8]) {
    await page.evaluate(v => {
      let s = document.getElementById("__wide");
      if (!s) { s = document.createElement("style"); s.id = "__wide"; document.head.appendChild(s); }
      s.textContent = ".arch-card .an,.arch-card .ad,.edition-chip{letter-spacing:" + v + "px !important;}"
                    + ".arch-card.latest .an::after{letter-spacing:" + v + "px !important;}";
    }, ls);
    await page.waitForTimeout(120);
    const bad = await page.evaluate(() => [...document.querySelectorAll(".arch-head")]
      .filter(h => h.getBoundingClientRect().height > 34)
      .map(h => h.textContent.trim().slice(0, 14)));
    if (bad.length) wide.push("자간+" + ls + "px: " + bad[0]);
  }
  c.ok(wide.length === 0, "지난브리핑: 서체가 넓어져도 호수·배지·날짜가 한 줄" + (wide.length ? " — " + wide.join(" / ") : ""));

  // 최신호 표시 — 글자 배지 대신 네 변을 모두 붉게 두른다.
  // 배지를 쓰면 「종합·연휴」와 나란히 놓여 산만하고, 호수가 세 자리가 되면 날짜가 아랫줄로 밀린다.
  await page.evaluate(() => { const s = document.getElementById("__wide"); if (s) s.textContent = ""; });
  await page.waitForTimeout(120);
  const latestMark = await page.evaluate(() => {
    const card = document.querySelector(".arch-card.latest");
    const af = getComputedStyle(card.querySelector(".an"), "::after");
    const cs = getComputedStyle(card);
    // 붉은색 판정: 빨강 성분이 크고, 초록·파랑보다 뚜렷이 높아야 한다.
    // (자릿수만 보면 옅은 회색 rgb(215,224,234)도 통과해버린다)
    const red = c => { const m = c.match(/(\d+), *(\d+), *(\d+)/);
      return !!m && +m[1] > 180 && +m[1] - +m[2] > 80 && +m[1] - +m[3] > 80; };
    return {
      배지글자: (af.content || "none").replace(/"/g, ""),
      사면: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor],
      모두빨강: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].every(red)
    };
  });
  c.ok(!/최신/.test(latestMark.배지글자), "최신호에 「최신」 글자 배지가 없음");
  c.ok(latestMark.모두빨강, "최신호는 네 변이 모두 붉은 테두리 (" + latestMark.사면.join(" / ") + ")");

  // 호수는 세 자리(제999호)까지 커진다. 그때도 날짜가 아랫줄로 밀리면 안 된다.
  // 실제 Noto 서체는 이 환경의 대체 서체보다 넓으므로 자간을 벌려 확인한다.
  const big = [];
  for (const ls of [0, 0.4, 0.8]) {
    await page.evaluate(v => {
      const card = document.querySelector(".arch-card");
      card.querySelector(".an").textContent = "제999호";          // 세 자리 호수로 바꿔 최악을 만든다
      let s = document.getElementById("__wide");
      if (!s) { s = document.createElement("style"); s.id = "__wide"; document.head.appendChild(s); }
      s.textContent = ".arch-card .an,.arch-card .ad,.edition-chip{letter-spacing:" + v + "px !important;}";
    }, ls);
    await page.waitForTimeout(120);
    const h = await page.evaluate(() => document.querySelector(".arch-head").getBoundingClientRect().height);
    if (h > 34) big.push("자간+" + ls + "px에서 " + Math.round(h) + "px(2줄)");
  }
  c.ok(big.length === 0, "지난브리핑: 호수가 세 자리(제999호)여도 날짜가 한 줄에 남음" + (big.length ? " — " + big.join(" / ") : ""));

  // 전역 원칙이 실제로 적용됐는지 — 요소마다 손으로 바르지 않아도 상속되어야 한다
  const base = await page.evaluate(() => {
    const p = document.querySelector("#archive .arch-kw .k .kt") || document.body;
    const cs = getComputedStyle(p);
    return { wb: getComputedStyle(document.body).wordBreak, ow: getComputedStyle(document.body).overflowWrap, inherited: cs.wordBreak };
  });
  c.ok(base.wb === "keep-all", "본문 전역 word-break:keep-all (현재 " + base.wb + ")");
  c.ok(base.ow === "break-word", "긴 문자열 안전장치 overflow-wrap:break-word (현재 " + base.ow + ")");
  c.ok(base.inherited === "keep-all", "하위 요소에도 상속됨 (현재 " + base.inherited + ")");

  // 자료마당 '회의 자료' 안내 문단 — 좁은 폭(360px)에서 flex 최소폭 붕괴로 글자가 한 자씩
  // 세로로 쌓이면 폭이 매우 좁아지고 높이가 폭발한다. 그 회귀를 폭으로 잡는다.
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(500);
  const note = await page.evaluate(() => { const n = document.querySelector(".res-packet-note"); if (!n) return null; const r = n.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  c.ok(note && note.w >= 180, "회의 자료 안내 문단이 좁은 폭에서 붕괴하지 않음 (폭 " + (note ? note.w : "없음") + "px)");
  const rov = await overflow();
  c.ok(rov.length === 0, "자료마당(회의 자료): 가로 스크롤 없음" + (rov.length ? " — " + rov[0] : ""));

  // 로그인 줄(비밀번호 변경·로그아웃)은 탭 아래로 내려가는데, 아래 여백이 없으면
  // 버튼 테두리가 nav의 아래 선에 딱 붙어 두 선이 겹쳐 보인다. 데스크톱 전 구간에서 확인.
  for (const w of [1400, 1300, 1024, 900, 800, 700]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(120);
    const gap = await page.evaluate(() => {
      const nav = document.querySelector("nav"), btn = document.getElementById("auth-btn");
      return +(nav.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom).toFixed(1);
    });
    c.ok(gap >= 6, w + "px: 로그인 줄 버튼이 nav 아래 선에서 떨어짐 (" + gap + "px)");
  }

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
