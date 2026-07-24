# 회귀 테스트 (Playwright)

화면을 실제 브라우저(Chromium)로 열어 핵심 기능이 깨지지 않았는지 확인하는 자동 검사입니다.
Supabase는 목(mock)으로 대체하므로 **실제 DB를 건드리지 않으며**, 네트워크 없이 동작합니다.

## 구성

| 파일 | 검사 내용 |
|---|---|
| `editor.test.js` | 편집기 — 툴바 그룹, 서체(순서·구성), 크기 pt 증감, 색상·형광펜 팔레트, 다단계 번호, 줄간격, 문자표(자주쓰기·최근사용), 그림 8핸들(모서리 비율고정/가장자리 자유), 표 행·열 편집 |
| `export.test.js` | 인쇄·파일 저장 — 출력 범위(통합/개별), 파일 형식 선택(PDF/.doc), WYSIWYG(px) 서식, 그림 크기 보존, 취합본 저장 |
| `calendar.test.js` | 일정공유 — 같은 날 여러 일정의 시간순 정렬(월·주·일·오늘 현황) |
| `workflow.test.js` | 팀 워크플로 — 주간기록 서식 저장·표시, 송프로 취합본에 서식 반영 |
| `helper.js` | 공용: 정적 서버·브라우저·가짜 로그인·Supabase 목 라우팅 |
| `vendor/supabase.js` | supabase-js UMD 사본 (CDN 요청을 이 파일로 대체) |

## 실행 방법

전제: `node`와 `playwright` 패키지, Chromium 실행 파일.
(클로드 코드 환경에는 이미 설치되어 있음 — Chromium 경로 `/opt/pw-browsers/chromium`)

```bash
# 저장소 루트에서
node tests/editor.test.js
node tests/export.test.js
node tests/calendar.test.js
node tests/workflow.test.js

# 전부 실행
for t in editor export calendar workflow; do node tests/$t.test.js || break; done
```

- Chromium 경로가 다르면: `PW_CHROMIUM=/path/to/chromium node tests/editor.test.js`
- 각 검사 항목은 `✓/✗`로 표시되고, 하나라도 실패하면 종료 코드 1로 끝납니다.

## 원칙

- **화면(index.html)을 고친 PR은 이 테스트를 통과한 뒤 올린다.**
- 새 기능을 추가하면 해당 검사도 함께 추가한다.
- 실제 Supabase 대신 목을 쓰므로, DB 정책(RLS)·스키마 변경은 이 테스트로 잡히지 않는다 — DB 변경은 별도로 검증할 것.
