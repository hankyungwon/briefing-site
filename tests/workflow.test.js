// 팀 워크플로 회귀 테스트 — 주간기록 작성·저장(서식 유지) → 취합본 게시(누구나·책임기록·수정없음·삭제권한)
const H = require("./helper");

const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

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

  // B. 송프로 취합 — 「취합」은 바로 저장이 아니라 편집기(초안)를 연다 → 다듬어 「올리기」 → 게시
  //    게시본에 취합자(created_by)·연구관 서식이 남고, 목록에 '취합 송프로'·'최신'이 보인다.
  {
    const page = await H.newPage(browser, { viewport: { width: 900, height: 1100 } });
    const { user, session } = H.mkSession("syho99@naver.com", "song");
    const staff = [{ id: 1, member_email: "twopro@hanmail.net", week_start: "2026-07-20", last_week: "<b>굵은 실적</b>", this_week: "<ul><li>계획1</li></ul>", updated_at: "2026-07-20T00:00:00Z" }];
    let packets = [], nid = 1;
    await H.setupPage(page, { user, session, routes: (p, m, req) => {
      if (p === "/rest/v1/staff_notes") return staff;
      if (p === "/rest/v1/meeting_packets") {
        if (m === "POST") { const row = JSON.parse(req.postData()); row.id = nid++; packets.push(row); return [row]; }
        return [...packets].sort((a, b) => (b.packet_date || "").localeCompare(a.packet_date || "") || b.id - a.id);
      }
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "syho99@naver.com");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);

    await page.click("#res-packet-new"); await page.waitForTimeout(500);
    c.ok(packets.length === 0, "「취합」만으로는 아직 게시되지 않음(초안 편집 단계)");
    const editorOpen = await page.evaluate(() => !document.getElementById("packet-edit-view").hidden && document.getElementById("packet-save").textContent.includes("올리기"));
    c.ok(editorOpen, "취합 시 편집기가 열리고 버튼이 「올리기」");
    const draftHasFmt = await page.evaluate(() => document.getElementById("packet-edit-body").innerHTML);
    c.ok(/굵은 실적|<b>|<ul>|<li>/i.test(draftHasFmt), "초안에 연구관 서식이 실려 있음");

    await page.click("#packet-save"); await page.waitForTimeout(500);
    c.ok(packets.length === 1, "「올리기」로 게시본 1건 생성");
    c.ok(packets[0].created_by === "syho99@naver.com", "게시본에 취합자(created_by) 기록");
    c.ok(/굵은 실적|<ul>|<li>/i.test(packets[0].content), "게시본에 연구관 서식 반영");

    const row = await page.evaluate(() => {
      const r = document.querySelector(".pk-row");
      return { by: (r.querySelector(".pk-by") || {}).textContent || "", latest: !!r.querySelector(".pk-latest"),
               del: !!r.querySelector("[data-pk-del]"), edit: !!r.querySelector("[data-pk-edit]") };
    });
    c.ok(/송프로/.test(row.by), "목록에 '취합 송프로' 표시");
    c.ok(row.latest, "최신 자료에 「최신」 배지");
    c.ok(row.del, "송프로는 이번 주(오늘) 자료 삭제 버튼 보임");
    c.ok(!row.edit, "게시본에 「수정」 버튼 없음(수정 불가)");
    await page.close();
  }

  // C. 대직 — 일반 연구관도 취합해 올릴 수 있다. 단, 본인은 삭제 권한이 없다.
  {
    const page = await H.newPage(browser, { viewport: { width: 900, height: 1100 } });
    const { user, session } = H.mkSession("twopro@hanmail.net", "two");
    let packets = [], nid = 1;
    await H.setupPage(page, { user, session, routes: (p, m, req) => {
      if (p === "/rest/v1/staff_notes") return [];
      if (p === "/rest/v1/meeting_packets") {
        if (m === "POST") { const row = JSON.parse(req.postData()); row.id = nid++; packets.push(row); return [row]; }
        return [...packets].sort((a, b) => (b.packet_date || "").localeCompare(a.packet_date || "") || b.id - a.id);
      }
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "twopro@hanmail.net");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);
    c.ok(await page.evaluate(() => !!document.getElementById("res-packet-new")), "일반 연구관에게도 「취합」 버튼 노출(대직)");
    await page.click("#res-packet-new"); await page.waitForTimeout(400);
    await page.click("#packet-save"); await page.waitForTimeout(500);
    c.ok(packets.length === 1 && packets[0].created_by === "twopro@hanmail.net", "연구관이 올린 취합본 게시 + 취합자 기록");
    const view = await page.evaluate(() => {
      const r = document.querySelector(".pk-row");
      return { by: (r.querySelector(".pk-by") || {}).textContent || "", del: !!r.querySelector("[data-pk-del]") };
    });
    c.ok(/오프로/.test(view.by), "목록에 '취합 오프로' 표시");
    c.ok(!view.del, "일반 연구관은 삭제 버튼이 없음");
    await page.close();
  }

  // D. 송프로 삭제 권한 — 이번 주(최근 7일) 자료만. 지난주 이전 확정본은 삭제 버튼이 없다.
  {
    const page = await H.newPage(browser, { viewport: { width: 900, height: 1100 } });
    const { user, session } = H.mkSession("syho99@naver.com", "song");
    const packets = [
      { id: 20, packet_date: today(), title: "이번 주", content: "<p>x</p>", created_by: "syho99@naver.com" },
      { id: 10, packet_date: daysAgo(10), title: "지난주 이전", content: "<p>y</p>", created_by: "syho99@naver.com" }
    ];
    await H.setupPage(page, { user, session, routes: (p, m) => {
      if (p === "/rest/v1/meeting_packets") return packets;
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "syho99@naver.com");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);
    const del = await page.evaluate(() => [...document.querySelectorAll(".pk-row")].map(r => ({
      title: (r.querySelector(".pk-title") || {}).textContent || "", del: !!r.querySelector("[data-pk-del]") })));
    const recent = del.find(x => /이번 주/.test(x.title)), old = del.find(x => /지난주/.test(x.title));
    c.ok(recent && recent.del, "송프로: 이번 주 자료는 삭제 버튼 보임");
    c.ok(old && !old.del, "송프로: 지난주 이전 자료는 삭제 버튼 없음");
    await page.close();
  }

  // E. 관리자(단장)는 오래된 자료도 삭제할 수 있다.
  {
    const page = await H.newPage(browser, { viewport: { width: 900, height: 1100 } });
    const { user, session } = H.mkSession("hanpro@hanmail.net", "boss");
    const packets = [{ id: 10, packet_date: daysAgo(30), title: "한 달 전", content: "<p>y</p>", created_by: "syho99@naver.com" }];
    await H.setupPage(page, { user, session, routes: (p, m) => {
      if (p === "/rest/v1/admin_emails") return [{ email: "hanpro@hanmail.net" }];
      if (p === "/rest/v1/meeting_packets") return packets;
      return H.defaultBriefingRoutes(p);
    }});
    await H.login(page, port, "hanpro@hanmail.net");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);
    c.ok(await page.evaluate(() => !!document.querySelector(".pk-row [data-pk-del]")), "관리자는 오래된 자료도 삭제 버튼 보임");
    await page.close();
  }

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
