'use client'

import { useEffect, useState } from 'react'
import { pickLang, htmlLang, type Mode } from '@/lib/i18n'

/* ─────────────────────────────────────────────────────────
   화면마다 반복되던 언어 초기화를 한 곳에 모읍니다.

   `<html lang>` 을 실제 언어로 맞추는 게 핵심입니다 — 안 맞으면 크롬이
   "다른 언어 페이지"로 보고 번역을 걸어서 글자가 뭉갭니다.

   ⚠️ 첫 렌더의 `lang` 은 아직 기본값(ja)입니다. 서버에서 미리 그린 화면과
      맞춰야 해서 판정을 마운트 뒤로 미루기 때문입니다.
      **마운트 시점에 언어가 필요한 일(계측 등)은 `onReady` 안에서** 하세요.
   ───────────────────────────────────────────────────────── */
export function useLang(onReady?: (mode: Mode) => void) {
  const [lang, setLang] = useState<Mode>('ja')

  useEffect(() => {
    const picked = pickLang()
    setLang(picked)
    document.documentElement.lang = htmlLang(picked)   /* 공부 모드는 한국어로 잡습니다 */
    onReady?.(picked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [lang, setLang] as const
}
