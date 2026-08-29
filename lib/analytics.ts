'use client'

/* ─────────────────────────────────────────────────────────
   GA4 — 실명 테스트(daretype)와 「같은 속성」으로 보냅니다.
   테스트 → 응원방이 한 깔때기로 보여야 하므로 속성을 나누지 않습니다.

   ⚠️ 두 사이트는 도메인이 다릅니다(daretype.vercel.app ↔ layover-lounge.vercel.app).
      GA4 관리 → 데이터 스트림 → 태그 설정 구성 → 「도메인 구성」에 두 도메인을
      넣어야 한 세션으로 이어집니다. 안 넣으면 라운지 방문이 새 세션 + 추천 유입이 됩니다.

   ⚠️ 매개변수 이름은 테스트 쪽과 맞춰 씁니다 (result·from·via·lang).
      새 이름을 만들면 GA4 맞춤 측정기준을 그만큼 더 등록해야 합니다.
   ───────────────────────────────────────────────────────── */

export const GA_ID = 'G-570M25BWKE'
const QA_KEY = 'layover.qa'

/* ?qa=1 로 한 번 들어오면 이 브라우저는 계속 internal 로 찍힙니다 (해제는 ?qa=0).
   테스트 쪽에서 넘어올 때도 주소에 qa=1 을 들려 보냅니다 — 도메인이 달라
   localStorage 가 안 넘어오기 때문입니다 */
export function isQA(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const m = /[?&]qa=([01])/.exec(window.location.search)
    if (m) localStorage.setItem(QA_KEY, m[1])
    return localStorage.getItem(QA_KEY) === '1'
  } catch {
    return false
  }
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

type Props = Record<string, string | number | undefined>

/* gtag.js 는 afterInteractive 로 늦게 옵니다. 화면이 뜨자마자 쏘는 도착 이벤트가
   태그보다 빠를 수 있어서, 준비될 때까지 잠깐 들고 있다가 보냅니다.
   태그가 끝내 안 오면(광고 차단기) 조용히 버립니다 — 계측 때문에 화면이 멈추면 안 됩니다 */
const pending: Array<[string, Props]> = []
let waiting = false

function flush() {
  while (pending.length && window.gtag) {
    const [name, data] = pending.shift()!
    try {
      window.gtag('event', name, data)
    } catch {}
  }
}

export function track(name: string, props: Props = {}) {
  if (typeof window === 'undefined') return
  const data: Props = { ...props }
  if (isQA()) data.traffic_type = 'internal'

  pending.push([name, data])
  if (window.gtag) return flush()
  if (waiting) return

  waiting = true
  let tries = 0
  const timer = window.setInterval(() => {
    tries += 1
    if (window.gtag) {
      flush()
      window.clearInterval(timer)
      waiting = false
    } else if (tries > 20) {          /* 5초까지만 기다립니다 */
      window.clearInterval(timer)
      waiting = false
      pending.length = 0
    }
  }, 250)
}
