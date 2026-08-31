'use client'

import { useEffect, useState } from 'react'
import { KEYS, readJson, writeJson } from '@/lib/storage'

/* ─────────────────────────────────────────────────────────
   「한국어 같이 보기」 (기획서 15.9)

   ⚠️ 언어 선택과 **다른 축**입니다.
      일본어를 고른 사람이라고 다 한국어를 배우러 온 게 아닙니다 —
      멤놀만 하러 온 사람에게 병기는 그냥 노이즈입니다.

   기본은 꺼둡니다. 한 번 켜면 기억합니다.
   ───────────────────────────────────────────────────────── */
export function useStudy() {
  const [study, setStudy] = useState(false)

  /* 서버에서 미리 그린 화면과 맞춰야 해서 첫 렌더는 꺼진 상태로 시작합니다 */
  useEffect(() => { setStudy(readJson<boolean>(KEYS.study, false)) }, [])

  function toggle() {
    const next = !study
    setStudy(next)
    writeJson(KEYS.study, next)
  }

  return { study, toggle }
}
