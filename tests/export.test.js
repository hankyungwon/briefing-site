// 인쇄·파일 저장 회귀 테스트 — 출력 범위·형식 선택·WYSIWYG·취합본 저장
const H = require("./helper");
const fs = require("fs");

(async () => {
  const c = H.makeChecker("export");
  const { server, port } = await H.startServer();
  const browser = await H.launchBrowser();

  // A. 연구관 개인 내보내기 (통합/개별 + .doc WYSIWYG)
  {
    const page = await H.newPage(browser);
    // 저장 위치 선택창(showSaveFilePicker)은 헤드리스에서 자동화 불가 — 기본 다운로드 경로를 강제
    await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch (e) { window.showSaveFilePicker = undefined; } });
    const { user, session } = H.mkSession("twopro@hanmail.net", "two");
    await H.setupPage(page, { user, session, routes: H.defaultBriefingRoutes });
    await H.login(page, port, "twopro@hanmail.net");
    await page.click('nav button[data-panel="about"]'); await page.waitForTimeout(500);
    await page.click('#about .member[data-member="two"] [data-memo-edit]'); await page.waitForTimeout(400);

    const ui = await page.evaluate(() => ({
      kinds: [...document.querySelectorAll("#memo-kind option")].map(o => o.value),
      printLabel: document.getElementById("memo-print").textContent.trim(),
      menu: [...document.querySelectorAll("#memo-savemenu button")].map(b => b.dataset.fmt)
    }));
    c.ok(JSON.stringify(ui.kinds) === JSON.stringify(["주간", "수시"]), "원고 구분 선택: 주간/수시");
    c.ok(!/PDF/i.test(ui.printLabel), "인쇄 버튼에서 PDF 분리됨 (" + ui.printLabel + ")");
    c.ok(JSON.stringify(ui.menu) === JSON.stringify(["pdf", "doc"]), "파일 저장 메뉴: PDF + .doc");

    await page.click("#memo-body"); await page.type("#memo-body", "AI 정책 초안을 완성했다");
    await page.evaluate(() => {
      const cv = document.createElement("canvas"); cv.width = 200; cv.height = 120; cv.getContext("2d").fillRect(0, 0, 200, 120);
      const ed = document.getElementById("memo-body");
      ed.innerHTML += '<img src="' + cv.toDataURL("image/png") + '" style="max-width:100%;width:50%;">';
      ed.dispatchEvent(new Event("input"));
    });

    // 원고 저장(.doc) — 한 칸 원고
    await page.click("#memo-download"); await page.waitForTimeout(120);
    const dl = await Promise.all([page.waitForEvent("download"), page.click('#memo-savemenu [data-fmt="doc"]')]).then(a => a[0]);
    const doc = fs.readFileSync(await dl.path(), "utf8");
    c.ok(/AI 정책 초안/.test(doc), "원고 본문 포함");
    c.ok(/font-size:14px/.test(doc) && /@page/.test(doc), "WYSIWYG px 서식 + A4 여백");
    c.ok(/width:\s*50%/.test(doc), "그림 크기(50%) 보존");
    await page.close();
  }

  // B. 취합본(송프로) 보기·저장
  {
    const page = await H.newPage(browser);
    await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch (e) { window.showSaveFilePicker = undefined; } });
    const { user, session } = H.mkSession("syho99@naver.com", "song");
    const packets = [{ id: 1, packet_date: "2026-07-21", title: "주간회의 자료 (7.21)", content: "<h3>연구단 주간회의 자료</h3><h4>[1] 이프로</h4><p>지난주 <b>실적</b></p><table class=\"pk-table\"><tbody><tr><td>가</td><td>나</td></tr></tbody></table>", created_by: "syho99@naver.com" }];
    await H.setupPage(page, { user, session, routes: p => p === "/rest/v1/meeting_packets" ? packets : H.defaultBriefingRoutes(p) });
    await H.login(page, port, "syho99@naver.com");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);
    await page.click("#res-packet-list [data-pk-view]"); await page.waitForTimeout(300);
    c.ok(await page.evaluate(() => document.getElementById("packet-title").textContent) === "주간회의 자료 (7.21)", "취합본 보기 제목");
    await page.click("#packet-download"); await page.waitForTimeout(120);
    const dl = await Promise.all([page.waitForEvent("download"), page.click('#packet-savemenu [data-fmt="doc"]')]).then(a => a[0]);
    const doc = fs.readFileSync(await dl.path(), "utf8");
    c.ok(/이프로/.test(doc) && /<table/.test(doc) && /<b>/.test(doc) && /@page/.test(doc), "취합본 .doc: 이름·표·굵게·A4 포함");
    await page.close();
  }

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
