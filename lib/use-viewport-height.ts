'use client'

import { useEffect, useState } from 'react'

/* ─────────────────────────────────────────────────────────
   지금 **실제로 보이는** 화면 높이

   아이폰에서 키보드가 올라오면 화면은 줄어드는데 `100dvh` 는 안 줄어듭니다.
   그래서 맨 아래에 붙여둔 입력창이 키보드 뒤로 숨고, 사람은 자기가 뭘 쓰는지
   못 보면서 칩니다 (기획서 5.12 · 22.1).

   `visualViewport` 는 「키보드를 뺀 나머지」를 알려줍니다. 그 값을 그대로 높이로 씁니다.

   ⚠️ 서버에는 window 가 없습니다. 첫 그림은 null 로 두고 부르는 쪽이 100dvh 로 떨어집니다.
   ───────────────────────────────────────────────────────── */
export function useViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return                       /* 옛 브라우저 — 100dvh 로 그냥 둡니다 */

    const apply = () => {
      setHeight(vv.height)
      /* 사파리는 입력창을 보이게 하려고 페이지를 제 맘대로 밀어올립니다.
         우리 화면은 딱 보이는 높이라 밀 곳이 없으니 되돌려 놓습니다.

         ⚠️ **밀렸을 때만** 부릅니다. 그냥 부르면 대화창이 맨 아래로 내려가던
            스르륵 스크롤을 매번 끊습니다 — 방에 들어가면 맨 위에 서 있게 됩니다 */
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }

    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [])

  return height
}
