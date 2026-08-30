'use client'

/* ─────────────────────────────────────────────────────────
   「나」 — 이름·색을 기억하는 한 칸

   입장 화면 · 채팅방 · 응원방이 **같은 칸**을 씁니다. 한 번 정하면
   다른 화면에서 다시 안 물어봅니다.

   ⚠️ 키 문자열을 화면마다 따로 적지 마세요. 하나만 어긋나도 에러는 안 나고
      기억만 조용히 사라집니다 — 사용자에겐 "이름이 왜 없어졌지"로 보입니다.
   ───────────────────────────────────────────────────────── */
const ME_KEY = 'layover.me'

export type Me = {
  clientId: string
  colorKey: string
  name: string
  role: string
  avatar: string
}

export function loadMe(): Me | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ME_KEY)
    return raw ? (JSON.parse(raw) as Me) : null
  } catch {
    return null            /* 사파리 프라이빗 등 — 기억이 없을 뿐, 화면은 돌아야 합니다 */
  }
}

export function saveMe(me: Me) {
  try { localStorage.setItem(ME_KEY, JSON.stringify(me)) } catch {}
}
