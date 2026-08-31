/* ─────────────────────────────────────────────────────────
   서버가 던지는 예외 이름

   DB 함수·트리거가 `raise exception 'gate_full'` 처럼 던지는 문자열입니다.
   화면에서 직접 비교하지 마세요 — 세 화면이 제각각 `includes('too_many')`,
   `includes('wish_too')` 로 적고 있었고, **서버에서 이름을 바꾸면 조용히 깨집니다.**

   새 예외를 만들면 SQL 과 여기를 **같이** 고치세요.
   ───────────────────────────────────────────────────────── */
export const ERR = {
  gateFull: 'gate_full',           // join_room  — 정원 초과 (3.7)
  cheerTooFast: 'cheer_too_fast',  // 응원방 도배 방지
  cheerTooMany: 'cheer_too_many',
  wishTooFast: 'wish_too_fast',    // 옷 건의 도배 방지
  wishTooMany: 'wish_too_many',
  duplicate: '23505',              // Postgres unique_violation — 이미 넣은 것
} as const

type SupabaseError = { message?: string; code?: string } | null | undefined

/** 코드와 메시지를 같이 봅니다 — 유니크 위반은 code 로만 옵니다 */
export function isErr(e: SupabaseError, ...names: string[]): boolean {
  if (!e) return false
  const hay = `${e.code ?? ''} ${e.message ?? ''}`
  return names.some((n) => hay.includes(n))
}
