// 팀 워크플로 회귀 테스트 — 주간기록 작성·저장(서식 유지) → 취합본에 서식 반영
const H = require("./helper");

(async () => {
  const c = H.makeChecker("workflow");
  const { server, port } = await H.startServer();
  const browser = await H.launchBrowser();

  // A. 연구관이 서식 넣어 작성·저장 → 보드에 서식 렌더
  {
    const page = await H.newPage(browser, { viewport: { width: 900, height: 1100 } });
    const { user, session } = H.mkSession("twopro@hanmail.net", "two");
    let staff = [], saved = null;
    await H.setupPage(page, { user, session, routes: (p, m, req) => {
      if (p === "/rest/v1/staff_notes") {
        if (m === "POST") { saved = JSON.parse(req.postData()); saved.id = 1; staff = [saved]; return [saved]; }
        return staff;
      }
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "twopro@hanmail.net");
    await page.click('nav button[data-panel="about"]'); await page.waitForTimeout(600);
    await page.click('#about .member[data-member="two"] [data-memo-edit]'); await page.waitForTimeout(400);
    c.ok(await page.evaluate(() => document.getElementById("memo-last").isContentEditable), "편집기 contenteditable");

    await page.click("#memo-last"); await page.type("#memo-last", "중요 업무 완료");
    await H.selAll(page, "memo-last");
    await page.click('#memo-toolbar [data-cmd="bold"]'); await page.waitForTimeout(150);
    await page.click("#memo-this"); await page.type("#memo-this", "계획 항목");
    await page.click('#memo-toolbar [data-cmd="ul"]'); await page.waitForTimeout(150);
    await page.click("#memo-submit"); await page.waitForTimeout(800);
    c.ok(saved && /<(b|strong)|font-weight/i.test(saved.last_week), "저장된 지난주 실적에 굵게 서식");
    c.ok(saved && /<(ul|li)/i.test(saved.this_week), "저장된 이번주 계획에 목록");
    const rendered = await page.evaluate(() => { const w = document.querySelector('#about .member[data-member="two"] .wt.rich'); return w ? w.innerHTML : ""; });
    c.ok(/<(b|strong)|font-weight/i.test(rendered), "보드 표시에 서식 렌더");
    await page.close();
  }

  // B. 송프로 취합 — 연구관 서식이 취합본에 반영
  {
    const page = await H.newPage(browser, { viewport: { width: 900, height: 1100 } });
    const { user, session } = H.mkSession("syho99@naver.com", "song");
    const staff = [{ id: 1, member_email: "twopro@hanmail.net", week_start: "2026-07-20", last_week: "<b>굵은 실적</b>", this_week: "<ul><li>계획1</li></ul>", updated_at: "2026-07-20T00:00:00Z" }];
    let packets = [], nid = 1;
    await H.setupPage(page, { user, session, routes: (p, m, req) => {
      if (p === "/rest/v1/staff_notes") return staff;
      if (p === "/rest/v1/meeting_packets") {
        if (m === "POST") { const row = JSON.parse(req.postData()); row.id = nid++; packets.push(row); return [row]; }
        return [...packets].sort((a, b) => b.id - a.id);
      }
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "syho99@naver.com");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);
    await page.click("#res-packet-new"); await page.waitForTimeout(500);
    c.ok(packets.length === 1, "취합본 1건 생성");
    c.ok(/<b>굵은 실적|<ul>|<li>/i.test(packets[0].content), "취합본에 연구관 서식 반영");
    await page.close();
  }

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
