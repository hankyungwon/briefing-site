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
    await page.click('#about .member[data-member="two"] [data-memo-new]'); await page.waitForTimeout(400);

    const ui = await page.evaluate(() => ({
      kinds: [...document.querySelectorAll("#memo-kind option")].map(o => o.value),
      printLabel: document.getElementById("memo-print").textContent.trim(),
      menu: [...document.querySelectorAll("#memo-savemenu button")].map(b => b.dataset.fmt)
    }));
    c.ok(JSON.stringify(ui.kinds) === JSON.stringify(["주간", "수시"]), "원고 구분 선택: 주간/수시");
    c.ok(!/PDF/i.test(ui.printLabel), "인쇄 버튼에서 PDF 분리됨 (" + ui.printLabel + ")");
    c.ok(JSON.stringify(ui.menu) === JSON.stringify(["pdf", "doc", "md"]), "파일 저장 메뉴: PDF + .doc + .md");

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
    const packets = [{ id: 1, packet_date: "2026-07-21", title: "주간회의 자료 (7.21)", content: "<h3 style=\"text-align:center;\">관악구 AI혁신정책연구단 · 주간회의 자료</h3><p style=\"text-align:center;color:#667;font-size:12px;\">취합 7.21(화) 22:03 · 취합 송프로</p><hr><h4>[1] 이프로</h4><p>지난주 <b>실적</b></p><table class=\"pk-table\"><tbody><tr><td>가</td><td>나</td></tr></tbody></table>", created_by: "syho99@naver.com" }];
    await H.setupPage(page, { user, session, routes: p => p === "/rest/v1/meeting_packets" ? packets : H.defaultBriefingRoutes(p) });
    await H.login(page, port, "syho99@naver.com");
    await page.click('nav button[data-panel="resources"]'); await page.waitForTimeout(400);
    await page.click('.res-subnav [data-ressec="packets"]'); await page.waitForTimeout(400);
    await page.click("#res-packet-list [data-pk-view]"); await page.waitForTimeout(300);
    c.ok(await page.evaluate(() => document.getElementById("packet-title").textContent) === "주간회의 자료 (7.21)", "취합본 보기 제목");

    // 이미 게시된 옛 취합본도 보여줄 때 머리글 표기가 정리된다(저장된 원문은 그대로)
    const head = await page.evaluate(() => {
      const b = document.querySelector("#packet-doc .packet-body");
      return { h3: (b.querySelector("h3") || {}).textContent || "", stamp: (b.querySelector("p") || {}).textContent || "",
               h3px: parseFloat(getComputedStyle(b.querySelector("h3")).fontSize) };
    });
    c.ok(head.h3 === "관악구 AI혁신정책연구단 주간회의 자료", "옛 취합본 제목의 가운뎃점 정리 (" + head.h3 + ")");
    c.ok(/^7\.21\(화\) 22:03\s+by 송프로$/.test(head.stamp.trim()), "옛 머리글 「취합 …·취합 …」 → 「날짜  by 취합자」 (" + head.stamp.trim() + ")");
    c.ok(head.h3px >= 22, "본문보다 확실히 큰 제목 (" + head.h3px + "px)");

    // 보기 확대·축소·전체보기 — 인쇄하지 않고 노트북 화면으로 회의를 진행할 때
    const z0 = await page.evaluate(() => document.getElementById("packet-zoom-label").textContent);
    await page.click("#packet-zoom-in"); await page.waitForTimeout(80);
    const z1 = await page.evaluate(() => ({ label: document.getElementById("packet-zoom-label").textContent, zoom: document.getElementById("packet-doc").style.zoom }));
    c.ok(z0 === "100%" && z1.label === "110%" && z1.zoom === "110%", "취합본 보기 확대 (" + z0 + " → " + z1.label + ")");
    await page.click("#packet-zoom-out"); await page.click("#packet-zoom-out"); await page.waitForTimeout(80);
    c.ok(await page.evaluate(() => document.getElementById("packet-zoom-label").textContent) === "90%", "취합본 보기 축소");
    await page.click("#packet-zoom-label"); await page.waitForTimeout(80);
    c.ok(await page.evaluate(() => document.getElementById("packet-zoom-label").textContent) === "100%", "가운데를 눌러 100% 복귀");
    await page.click("#packet-full"); await page.waitForTimeout(150);
    const full = await page.evaluate(() => ({ on: document.getElementById("packet-modal").classList.contains("pk-full"), label: document.getElementById("packet-full").textContent.trim() }));
    c.ok(full.on && /창으로/.test(full.label), "전체보기로 전환 (" + full.label + ")");
    await page.click("#packet-full"); await page.waitForTimeout(150);
    c.ok(await page.evaluate(() => !document.getElementById("packet-modal").classList.contains("pk-full")), "전체보기 해제");
    await page.click("#packet-download"); await page.waitForTimeout(120);
    const dl = await Promise.all([page.waitForEvent("download"), page.click('#packet-savemenu [data-fmt="doc"]')]).then(a => a[0]);
    const doc = fs.readFileSync(await dl.path(), "utf8");
    c.ok(/이프로/.test(doc) && /<table/.test(doc) && /<b>/.test(doc) && /@page/.test(doc), "취합본 .doc: 이름·표·굵게·A4 포함");

    // 마크다운(.md) 저장 — AI·옵시디언 친화 형식(제목·굵게·표가 마크다운으로)
    // (헤드리스에서는 blob 다운로드의 파일명이 노출되지 않아 .doc와 마찬가지로 내용만 검사)
    await page.click("#packet-download"); await page.waitForTimeout(120);
    const dlm = await Promise.all([page.waitForEvent("download"), page.click('#packet-savemenu [data-fmt="md"]')]).then(a => a[0]);
    const md = fs.readFileSync(await dlm.path(), "utf8");
    c.ok(/^# 주간회의 자료/m.test(md), "md: 문서 제목이 # 제목으로");
    c.ok(/#{3,4} \[1\] 이프로/.test(md), "md: 단원 소제목이 마크다운 제목으로");
    c.ok(/\*\*실적\*\*/.test(md), "md: 굵게가 **강조**로");
    c.ok(/\|\s*가\s*\|\s*나\s*\|/.test(md) && /\| --- \|/.test(md), "md: 표가 마크다운 표로");
    c.ok(!/<table|<b>|<h4/.test(md), "md: HTML 태그가 남지 않음");
    await page.close();
  }

  server.close();
  await c.finish(browser);
})().catch(e => { console.error("FAIL", e.message, e.stack); process.exit(1); });
