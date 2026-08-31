// 편집기 회귀 테스트 — 툴바 구성·색상 팔레트·서체·크기·목록·문자표·그림 편집
const H = require("./helper");

(async () => {
  const c = H.makeChecker("editor");
  const { server, port } = await H.startServer();
  const browser = await H.launchBrowser();
  const page = await H.newPage(browser);
  page.on("dialog", d => d.accept("2x2"));
  const { user, session } = H.mkSession("twopro@hanmail.net", "two");
  await H.setupPage(page, { user, session, routes: H.defaultBriefingRoutes });
  await H.login(page, port, "twopro@hanmail.net");
  await page.click('nav button[data-panel="about"]'); await page.waitForTimeout(500);
  await page.click('#about .member[data-member="two"] [data-memo-new]'); await page.waitForTimeout(400);

  // 1) 툴바 그룹 — 정렬 4개가 한 그룹
  const grp = await page.evaluate(() => {
    const grps = [...document.querySelectorAll("#memo-toolbar .pk-grp")];
    const ag = grps.find(g => g.querySelector('[data-cmd="left"]'));
    return { count: grps.length, alignTogether: !!ag && ["left", "center", "right", "justify"].every(k => !!ag.querySelector('[data-cmd="' + k + '"]')) && !ag.querySelector('[data-cmd="bold"]') };
  });
  c.ok(grp.count >= 8, "툴바 그룹 8개 이상 (" + grp.count + ")");
  c.ok(grp.alignTogether, "정렬 4버튼이 한 그룹에 묶임");

  // 2) 서체 — 명조·바탕 계열 우선, 그룹 순서, 총수
  const f = await page.evaluate(() => {
    const opts = [...document.querySelectorAll("#memo-toolbar .rt-font option")];
    return { groups: [...document.querySelectorAll("#memo-toolbar .rt-font optgroup")].map(o => o.label), first: opts[0].textContent, total: opts.length, texts: opts.map(o => o.textContent) };
  });
  c.ok(f.groups[0] === "명조·바탕 계열" && f.groups[1] === "고딕 계열", "서체 그룹 순서: 명조·바탕 → 고딕 (" + f.groups.slice(0, 2).join(", ") + ")");
  c.ok(f.first === "명조(본문)", "첫 서체가 명조(본문)");
  c.ok(f.total >= 50, "서체 50종 이상 (" + f.total + ")");
  ["중고딕", "신명조", "함초롬바탕", "Helvetica", "Cambria"].forEach(n => c.ok(f.texts.includes(n), "서체 포함: " + n));

  // 3) 글자 크기 — 4단계 유지 + pt 숫자 증감
  await page.click("#memo-body"); await page.type("#memo-body", "크기 시험");
  await H.selAll(page, "memo-body");
  await page.click('#memo-toolbar [data-cmd="size-up"]'); await page.waitForTimeout(100);
  const size = await page.evaluate(() => ({ preset: !!document.querySelector("#memo-toolbar .rt-size"), num: document.querySelector("#memo-toolbar .rt-sizenum").value, html: document.getElementById("memo-body").innerHTML }));
  c.ok(size.preset, "4단계 크기 선택 유지");
  c.ok(size.num === "12" && /font-size:\s*12pt/i.test(size.html), "＋ 클릭 시 11→12pt 실제 적용");

  // 4) 글자색 팔레트 (RGB 입력 없음)
  const pal = await page.evaluate(() => ({ colorInput: !!document.querySelector("#memo-toolbar input[type=color]"), sw: document.querySelectorAll("#memo-toolbar .rt-palette:not(.rt-hilipal) .rt-sw").length }));
  c.ok(!pal.colorInput, "RGB 색 입력 제거됨");
  c.ok(pal.sw === 60, "글자색 팔레트 60색 (" + pal.sw + ")");
  await H.selAll(page, "memo-body");
  await page.click("#memo-toolbar .rt-fore"); await page.waitForTimeout(120);
  await page.click('#memo-toolbar .rt-palette [data-color="#ff0000"]'); await page.waitForTimeout(120);
  const red = await page.evaluate(() => document.getElementById("memo-body").innerHTML);
  c.ok(/rgb\(255,\s*0,\s*0\)|#ff0000/i.test(red), "팔레트 빨강 적용");

  // 5) 형광펜 팔레트
  const hil = await page.evaluate(() => document.querySelectorAll("#memo-toolbar .rt-hilipal .rt-sw").length);
  c.ok(hil === 18, "형광펜 18색 (" + hil + ")");
  await page.click("#memo-body"); await page.type("#memo-body", "강조 문장");
  await H.selAll(page, "memo-body");
  await page.click("#memo-toolbar .rt-hili"); await page.waitForTimeout(100);
  await page.click("#memo-toolbar .rt-hilipal .rt-sw:nth-child(3)"); await page.waitForTimeout(100);
  c.ok(/background-color/i.test(await page.evaluate(() => document.getElementById("memo-body").innerHTML)), "형광펜 적용");

  // 6) 다단계 번호 (1. → 가. → 1) → 가) → (1))
  const markers = await page.evaluate(() => {
    const ed = document.getElementById("memo-body");
    ed.innerHTML = '<ol class="kout"><li>a<ol><li>b<ol><li>c<ol><li>d<ol><li>e</li></ol></li></ol></li></ol></li></ol></li></ol>';
    const g = s => getComputedStyle(ed.querySelector(s)).listStyleType;
    return [g("ol"), g("ol ol"), g("ol ol ol"), g("ol ol ol ol"), g("ol ol ol ol ol")];
  });
  c.ok(JSON.stringify(markers) === JSON.stringify(["kr-num", "kr-hangul", "kr-pnum", "kr-phangul", "kr-ppnum"]), "다단계 번호 체계 (" + markers.join(" → ") + ")");

  // 7) 번호 스타일 변경(원문자)
  await H.selAll(page, "memo-body");
  await page.selectOption("#memo-toolbar .rt-liststyle", "ls-circle"); await page.waitForTimeout(120);
  c.ok(await page.evaluate(() => getComputedStyle(document.querySelector("#memo-body ol")).listStyleType) === "kr-circle", "번호 스타일 ① 변경");

  // 8) 줄 간격
  await page.evaluate(() => { document.getElementById("memo-body").innerHTML = "<p>줄간격 시험 문단</p>"; });
  await H.selAll(page, "memo-body");
  await page.selectOption("#memo-toolbar .rt-linespace", "2.0"); await page.waitForTimeout(100);
  c.ok(/line-height:\s*2/i.test(await page.evaluate(() => document.getElementById("memo-body").innerHTML)), "줄간격 2.0 적용");

  // 9) 문자표 — 자주쓰기 첫 탭·삽입·최근 사용
  await page.evaluate(() => { const ed = document.getElementById("memo-body"); ed.innerHTML = "<p>기호 </p>"; ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.dispatchEvent(new Event("mouseup")); });
  await page.click('#memo-toolbar [data-cmd="char"]'); await page.waitForTimeout(200);
  const cm = await page.evaluate(() => ({
    open: document.getElementById("char-modal").classList.contains("open"),
    firstTab: document.querySelector("#char-tabs button").dataset.cat,
    tabs: document.querySelectorAll("#char-tabs button").length,
    recent: !!document.getElementById("char-recent")
  }));
  c.ok(cm.open && cm.firstTab === "자주쓰기" && cm.tabs >= 12 && cm.recent, "문자표: 열림·자주쓰기 첫 탭·탭 " + cm.tabs + "개·최근줄");
  await page.evaluate(() => { [...document.querySelectorAll("#char-grid button")].find(b => b.dataset.ch === "☑").click(); });
  await page.waitForTimeout(120);
  const ins = await page.evaluate(() => ({ body: document.getElementById("memo-body").innerText, recent: [...document.querySelectorAll("#char-recent button")].map(b => b.dataset.ch) }));
  c.ok(ins.body.includes("☑") && ins.recent[0] === "☑", "☑ 삽입 + 최근 사용 반영");
  // 번호(원·네모) 분류 보강 확인
  await page.evaluate(() => { [...document.querySelectorAll("#char-tabs button")].find(b => b.dataset.cat.startsWith("번호")).click(); });
  await page.waitForTimeout(100);
  const nums = await page.evaluate(() => [...document.querySelectorAll("#char-grid button")].map(b => b.dataset.ch));
  c.ok(nums.length >= 130 && nums.includes("㊱") && nums.includes("㉈"), "번호 분류 " + nums.length + "자 (㊱·㉈ 포함)");
  await page.click("#char-close");

  // 10) 그림 — 8핸들, 모서리=비율고정 / 가장자리=자유
  await page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = 240; cv.height = 160; cv.getContext("2d").fillRect(0, 0, 240, 160);
    const ed = document.getElementById("memo-body"); ed.innerHTML = '<p>사진</p><img src="' + cv.toDataURL("image/png") + '" style="max-width:100%;"><p><br></p>'; ed.dispatchEvent(new Event("input"));
  });
  await page.click("#memo-body img"); await page.waitForTimeout(200);
  c.ok(await page.evaluate(() => document.querySelectorAll("#pk-imgbox .ib-h").length) === 8, "그림 선택 시 8방향 핸들");
  const nat = await page.evaluate(() => { const i = document.querySelector("#memo-body img"); return { w: i.offsetWidth, h: i.offsetHeight }; });
  let hb = await (await page.$("#pk-imgbox .ib-e")).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x + 70, hb.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(80);
  const aE = await page.evaluate(() => { const i = document.querySelector("#memo-body img"); return { w: i.offsetWidth, h: i.offsetHeight }; });
  c.ok(aE.w > nat.w + 20 && Math.abs(aE.h - nat.h) < 4, "가장자리 드래그: 가로만 변경 (" + nat.w + "x" + nat.h + "→" + aE.w + "x" + aE.h + ")");
  hb = await (await page.$("#pk-imgbox .ib-se")).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x - 70, hb.y - 47, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(80);
  const aSE = await page.evaluate(() => { const i = document.querySelector("#memo-body img"); return { w: i.offsetWidth, h: i.offsetHeight }; });
  c.ok(Math.abs(aE.w / aE.h - aSE.w / aSE.h) < 0.05 && aSE.w < aE.w, "모서리 드래그: 비율 고정 축소 (" + aSE.w + "x" + aSE.h + ")");

  // 11) 표 행·열 편집
  page.removeAllListeners("dialog"); page.on("dialog", d => d.accept("2x2"));
  await page.evaluate(() => { const ed = document.getElementById("memo-body"); ed.innerHTML = "<p><br></p>"; ed.focus(); const s = getSelection(); s.selectAllChildren(ed); s.collapseToEnd(); });
  await page.click('#memo-toolbar [data-cmd="table"]'); await page.waitForTimeout(200);
  const putCaret = () => page.evaluate(() => { const td = document.querySelector("#memo-body table td"); const r = document.createRange(); r.selectNodeContents(td); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await putCaret(); await page.click('#memo-toolbar [data-cmd="row-add"]');
  await putCaret(); await page.click('#memo-toolbar [data-cmd="col-add"]'); await page.waitForTimeout(80);
  const t1 = await page.evaluate(() => { const tb = document.querySelector("#memo-body table"); return tb.querySelectorAll("tr").length + "x" + tb.querySelector("tr").children.length; });
  await putCaret(); await page.click('#memo-toolbar [data-cmd="row-del"]');
  await putCaret(); await page.click('#memo-toolbar [data-cmd="col-del"]'); await page.waitForTimeout(80);
  const t2 = await page.evaluate(() => { const tb = document.querySelector("#memo-body table"); return tb.querySelectorAll("tr").length + "x" + tb.querySelector("tr").children.length; });
  c.ok(t1 === "3x3" && t2 === "2x2", "표 행·열 추가/삭제 (2x2→" + t1 + "→" + t2 + ")");

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
