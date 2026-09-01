'use client'

import { KEYS, readJson, writeJson } from '@/lib/storage'

/* 「나」 — 이름·색을 기억하는 한 칸.
   입장 화면 · 채팅방 · 응원방이 **같은 칸**을 씁니다. 한 번 정하면 다시 안 물어봅니다 */

export type Me = {
  clientId: string
  colorKey: string
  name: string
  role: string
  avatar: string
}

export function loadMe(): Me | null {
  return readJson<Me | null>(KEYS.me, null)
}

/* 통째로 덮어쓰기. **밖으로 내보내지 않습니다** — 아래 patchMe 만 씁니다.
   화면은 저마다 「나」의 일부만 압니다. 응원방은 역할을 안 물어보고, 라운지는
   아바타를 안 물어봅니다. 그 상태로 이걸 부르면 모르는 칸이 빈 값으로 덮입니다 —
   에러가 안 나고 기억만 조용히 없어져서 눈에 잘 안 띕니다 (lib/storage.ts 의 경고와 같은 것) */
function saveMe(me: Me) {
  writeJson(KEYS.me, me)
}

/* 기억을 바꾸는 유일한 문. 아는 것만 넘기면 모르는 칸은 그대로 남습니다.
   지우는 것도 됩니다 — 역할 칸을 비운 사람은 `role: ''` 을 넘기면 실제로 지워집니다
   (`??` 라서 빈 문자열은 값으로 삽니다. `||` 로 바꾸면 못 지웁니다) */
export function patchMe(part: Partial<Me> & { clientId: string }) {
  const prev = loadMe()
  saveMe({
    clientId: part.clientId,
    colorKey: part.colorKey ?? prev?.colorKey ?? 'pink',
    name: part.name ?? prev?.name ?? '',
    role: part.role ?? prev?.role ?? '',
    avatar: part.avatar ?? prev?.avatar ?? 'preset-01',
  })
}
