# CLAUDE.md — 관악구 AI혁신정책연구단 지식 플랫폼

이 파일은 클로드 코드가 이 저장소에서 작업할 때 반드시 따르는 수칙이다.
제1부는 모든 프로젝트 공통(새 프로젝트 시작 시 그대로 복사), 제2부는 이 프로젝트 전용.

---

## 제1부 — 일반 운영 원칙 (모든 프로젝트 공통)

1. **사용자**: 한경원 (비개발자, 정책 전문가). 모든 소통은 한국어로 한다.
   기술 개념은 비유로 풀어 설명하고, 외부 서비스(포털·대시보드) 안내는
   추측하지 말고 사용자의 실제 화면(캡처) 기준으로 단계별 안내한다.
2. **계획 먼저, 코드는 그다음.** 요구가 모호하면 추측으로 만들지 말고 확인한다.
3. **수술식 수정**: 요청된 범위만 최소한으로 고친다. 시키지 않은 리팩터링·
   기능 추가·파일 재구성 금지. 개선 아이디어는 제안만 하고 승인 후 실행한다.
4. **단순함 우선**: 요구에 없는 추상화, 방어 코드, 라이브러리 추가 금지.
5. **증명 없는 완료 보고 금지**: 변경은 실제 실행·렌더링으로 검증하고 근거
   (스크린샷, 테스트 결과)를 제시한다. 실패·미완성은 숨기지 않고 그대로 보고한다.
6. **파괴적 작업 금지선**: 데이터 삭제, 되돌리기 어려운 변경, 외부 발송은
   실행 전 반드시 사용자 확인을 받는다.
7. **작업 마무리 절차**: 검증 → 커밋(한국어 메시지) → 푸시 → PR 생성 →
   한국어 요약 보고. 머지는 사용자가 한다. 머지 후 브랜치를 origin/main에서 재시작한다.

---

## 제2부 — 이 프로젝트(briefing-site) 규칙

### 구조와 배포
- 정적 사이트. **index.html 단일 파일**(CSS/JS 인라인, 빌드 없음). 파일을 분리하지 말 것.
- 배포: main 머지 → Vercel 자동 배포 → https://hanpro.io (www는 hanpro.io로 308 리디렉션).
- 백엔드: Supabase(프로젝트 `bpkliumilseyuloutsqt`)를 브라우저에서 직접 호출.
  publishable key는 코드 노출 OK — 보안은 전적으로 RLS가 담당하므로 RLS 정책을 함부로 완화하지 말 것.

### 데이터
- 테이블: briefings·briefing_items(브리핑) / posts(자료마당) / free_posts·free_comments(게시판)
  / events(일정) / attachments(첨부) / research_requests(조사 요청) / site_config(수집 설정)
  / admin_emails(관리자) / holidays(공휴일).
- briefing_items.category는 gov / seoul / world / ahead 만 허용. 모든 브리핑 항목에
  출처(source_name·source_url)를 붙이는 것이 원칙. **실제 존재하는 기사만 싣고 URL 창작 금지.**
- 브리핑 발행 규칙: 화~금 일일판, 월요일 주말 종합(edition='weekend', ahead 항목 포함),
  토·일·공휴일 휴간, 연휴 뒤 첫 영업일 종합판(edition='holiday'). 발행은 예약 루틴이 담당하며
  수집 조건은 site_config(key='briefing_collect')를 매회 읽어 따른다.
- DB 구조 변경은 Supabase MCP의 apply_migration으로 하고, 운영 데이터를 다룰 때는 신중히.

### 화면·디자인
- 사용자 대면 텍스트는 전부 한국어, `word-break: keep-all`(한 글자 줄넘김 금지).
- 팔레트: 관악 블루 #0E5FA8 · 딥 #0B4A86 · 스카이 #1489A7 · 강조 노랑 #FFE600 · 골드 #B47E12.
- 서체: 제목 Noto Serif KR, 본문 Noto Sans KR, 단장 인사말 Gowun Batang.
- 로고: G가 노란 AI·✦를 감싸는 SVG(헤더·파비콘·og.png 공통). 도시브랜드 이미지는 푸터에.
- **모바일 우선**: 390~412px 뷰포트에서 반드시 확인. 달력 7열 균등 구조
  (`minmax(0,1fr)` + overflow 차단)와 `text-size-adjust:100%`를 훼손하지 말 것.

### 검증
- 모든 화면 변경은 Playwright로 확인: chromium 경로 `/opt/pw-browsers/chromium`,
  Supabase 응답은 mock 라우팅(scratchpad의 기존 테스트 스크립트 참고), PC와 모바일 둘 다.
- 등록·수정 흐름을 고칠 때는 "입력 내용이 유실되지 않는가"를 항상 검증 항목에 포함한다.
