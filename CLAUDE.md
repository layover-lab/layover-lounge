# CLAUDE.md — layover-lounge

## 이 저장소

Layover 라운지의 **채팅방**. 기획서 5장 ①단계에 해당한다.

기획서는 `~/.claude/skills/layover-lounge/SKILL.md`에 있다(사용자 레벨이라 어느 폴더에서 열어도 읽힌다).
**코드를 짜거나 화면·문구·테이블을 건드리기 전에 항상 먼저 읽는다.**

## 작업 방식

- **파일을 만들거나 고치거나 지우기 전에 무엇을 왜 할지 먼저 말하고 컨펌을 받는다.** 읽기(파일 열람·DB 조회·상태 점검)는 예외
- 실행한 뒤에는 `git status --short` 처럼 **직접 확인할 방법**을 함께 알려준다
- **터미널 명령어와 코드는 본인이 직접 친다.** 대신 실행하지 말고, 명령어는 한 블록에 하나씩 각 옵션의 뜻과 함께 준다
- 긴 파일은 heredoc으로 한 번에 붙여넣을 수 있게 만든다
- **명령어가 아닌 예시는 코드 블록에 넣지 않는다** — 터미널에 그대로 붙여넣는 사고가 실제로 있었다
- 에러가 나면 답부터 주지 말고 **원인을 진단해서 보여준 다음** 고치는 법을 준다

## 폴더가 둘인 이유

| 폴더 | 내용 |
| :-- | :-- |
| `~/layover-lounge` | 이 저장소. 채팅방. Next.js + Supabase. **공개** |
| `~/layover_lab` | `cutie-type` — 백엔드 없는 정적 테스트 사이트. 별개 git 저장소 |

기획서 E.1 — 저장소 하나 = 배포 주소 하나 = 주인 한 명.

## ⚠️ 공개 저장소다

- 기획서·비용·수요 데이터·팀 운영 문서를 여기 넣지 않는다
- `.env.local`은 `.gitignore`(`.env*`)로 막혀 있다. **push 전에 `git status`에 `.env`가 없는지 확인**

## Supabase

- 프로젝트 `layover-dev` · Region **Tokyo (ap-northeast-1)**
- 테이블 3개: `rooms` · `participants` · `messages` (기획서 5.6)
- **스키마 변경은 로컬 마이그레이션 파일이 먼저**, 그다음 `supabase db push`
- `supabase/migrations/`의 파일은 **한 번 적용하면 수정하지 않는다.** 새 파일을 추가한다
- `supabase db reset --linked`는 **dev에서만.** prod에서 쓰면 대화 기록이 전부 사라진다
- 시드 데이터는 `supabase/seed.sql`에 (스키마와 분리)
- `messages`는 Realtime publication에 등록되어 있어야 한다. 빠지면 **에러 없이** 실시간만 죽는다

## 키

- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`는 현재 코드에서 쓰지 않는다. **`NEXT_PUBLIC_` 접두사를 붙이면 그 순간 끝**
- Vercel 환경변수에도 public 2개만 등록되어 있다

## 지금 있는 것 / 없는 것

**있음** — 입장 화면 `/lounge` · 무대 채팅 `/lounge/[slug]` · 실시간 · 역할 컬러 8종 · 문구 분리

**없음** — 백스테이지 · 방 목록 · 내 방 만들기 · 프리셋 아바타 · 대사/행동 구분 · 리액션 · 접속 인원 · 게이트 자동 증식 · 참여 도장 · 신고 · 일본어

## 지켜야 할 규칙 (기획서 10.0)

1. 색 키 8종: `yellow` `red` `green` `blue` `orange` `lightblue` `purple` `pink` — **바꾸지 않는다**
2. 경로: `/test` · `/lounge` · `/dressroom`
3. 아이템 코드: 소문자-하이픈 (`rose-jsk-ivory`)
4. 코디 URL: `?look=코드,코드`
5. CSS 변수명은 기획서 17장 그대로 (`app/globals.css`)
6. 화면에 보이는 글자는 `messages/ko.json`에. 코드에 직접 쓰지 않는다
7. 계측 이벤트 이름: `test_completed` `item_equipped` `look_shared` `chat_joined`

## 알려진 함정

- **한글·일본어 IME** — Enter로 전송할 때 `e.nativeEvent.isComposing`을 확인하지 않으면 메시지가 두 번 간다. 기획서 5.12에 없는 항목인데, **유저의 95%가 일본어 사용자라 저 셋보다 자주 터진다**
- **React StrictMode가 `useEffect`를 두 번 실행한다** — Realtime 채널 이름에 고유값을 붙이고, cleanup에서 `removeChannel`. 비동기 작업 중엔 `cancelled` 플래그로 중단 확인
- **내 메시지 중복** — `client_msg_id`로 대조해서 실시간으로 돌아온 것을 무시 (기획서 5.12①)
- **Supabase 에러를 삼키지 말 것** — `const { data, error }`에서 `error`를 항상 확인. 안 하면 화면이 로딩 상태로 멈추고 원인을 못 찾는다

## 남은 작업

- 백스테이지 (`messages.layer = 'backstage'` — 테이블은 이미 준비되어 있다)
- 방 목록 · 내 방 만들기
- 재연결 시 놓친 메시지 불러오기 (기획서 5.12②)
- 맨 아래일 때만 자동 스크롤 (기획서 5.12③)
- 일본어 `messages/ja.json`
- 정식 RLS 정책 (지금은 dev용으로 읽기·쓰기 전체 허용)
