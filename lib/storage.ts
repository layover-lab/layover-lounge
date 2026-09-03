/* ─────────────────────────────────────────────────────────
   브라우저에 남기는 것들 — 키를 여기 모읍니다.

   ⚠️ 문자열을 파일마다 직접 적으면 오타가 나도 **에러가 안 납니다.**
      기억만 조용히 사라지고, 사용자에겐 「이름이 왜 없어졌지」로 보입니다.

   ⚠️ components/Analytics.tsx 의 인라인 스크립트에는 `layover.qa` 가 문자열로
      박혀 있습니다. 그 코드는 gtag 보다 먼저 돌아야 해서 import 를 못 씁니다.
      키를 바꾸면 거기도 같이 고치세요.
   ───────────────────────────────────────────────────────── */
export const KEYS = {
  me: 'layover.me',          // 이름·색·역할 (lib/me.ts)
  lang: 'layover.lang',      // 언어 (lib/i18n.ts)
  qa: 'layover.qa',          // 내부 트래픽 표시 (lib/analytics.ts)
  hidden: 'layover.hidden',  // 숨긴 사람 (lib/use-hidden.ts)
  from: 'layover.from',      // 어느 테스트에서 왔나
  seen: 'layover.seen',      // 방별 백스테이지 마지막 확인 시각
  lastRoom: 'layover.lastRoom', // 마지막에 들어간 방 (건의에 맥락으로 실립니다)
  client: 'layover.clientId', // 익명 식별자 (lib/client-id.ts). **바꾸면 모두의 참가 이력이 끊깁니다**
} as const

/** 없거나 깨졌으면 fallback. 사파리 프라이빗에서도 화면은 돌아야 합니다 */
export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function readText(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeText(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch {}
}
