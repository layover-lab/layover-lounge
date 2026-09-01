'use client'

import { useState } from 'react'
import { KEYS, readJson, writeJson } from '@/lib/storage'
import { useAfterMount } from '@/lib/use-after-mount'

/* ─────────────────────────────────────────────────────────
   숨긴 사람 (기획서 19.2 「숨기기」)

   브라우저에만 둡니다. 로그인이 없으면 서버 차단은 브라우저만 바꿔도 뚫려서
   지키는 척만 하게 됩니다.

   participants.id 는 방마다 새로 생기므로 이 목록은 **자연히 방 단위**입니다 —
   다른 방에 간 같은 사람은 다시 보입니다. 상대에게는 알리지 않습니다 (19.4).
   ───────────────────────────────────────────────────────── */
export function useHidden() {
  const [hidden, setHidden] = useState<string[]>([])

  /* 서버에서 미리 그린 화면과 맞춰야 해서 첫 렌더에는 비워두고 마운트 뒤에 읽습니다 */
  useAfterMount(() => setHidden(readJson<string[]>(KEYS.hidden, [])))

  function hide(participantId: string) {
    const next = Array.from(new Set([...hidden, participantId]))
    setHidden(next)
    writeJson(KEYS.hidden, next)
  }

  function unhideAll() {
    setHidden([])
    writeJson(KEYS.hidden, [])
  }

  return { hidden, hide, unhideAll }
}
