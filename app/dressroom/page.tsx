'use client'

import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import {
  BASE_LAYERS, CATEGORIES, ITEMS, ITEM_IMAGE_DIR, ITEM_IMAGE_EXT,
  type Category, type Item,
} from './items'
import { supabase } from '@/lib/supabase'
import { getClientId } from '@/lib/client-id'
import { dict, type Mode } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { track } from '@/lib/analytics'
import { ERR, isErr } from '@/lib/errors'
import LangToggle from '@/components/LangToggle'
import RoomNav from '@/components/RoomNav'
import { LINE, wrap, ctaBtn, ctaGhost, dot, tab } from '@/lib/ui'

/* ─────────────────────────────────────────────────────────
   드레스룸 (기획서 6장)

   서버가 없습니다. 저장은 주소가 합니다 — `?look=코드,코드`.
   로그인·DB·결제 없음 (절대 규칙 ⑤).

   ⚠️ 학생팀(cube·weave)이 같은 화면을 각자 만들고 있습니다.
      두 팀 심사가 끝난 뒤 더 나은 안이 있으면 이 폴더째 교체합니다.
      그래서 `app/dressroom/` 밖으로 나가는 코드를 두지 않습니다.
   ───────────────────────────────────────────────────────── */

/** 카테고리마다 하나씩만 입습니다. 복원이 단순해지고 겹침 사고가 없습니다 */
type Worn = Partial<Record<Category, string>>

/** 첫 방문에 빈 몸을 보여주면 뭘 해야 할지 모릅니다 — 기본 코디를 입혀둡니다 (심사 기준 3) */
const DEFAULT_LOOK: Worn = {
  dress: 'rose-jsk-ivory',
  blouse: 'white-blouse-01',
  head: 'katyusha-lace',
  accessory: 'peach-bow',
}

const byCode = new Map(ITEMS.map((i) => [i.code, i]))

/* 주소 → 코디. 순서가 달라도 같게 복원되고, 모르는 코드는 조용히 버립니다 */
function parseLook(search: string): Worn | null {
  const m = /[?&]look=([^&]*)/.exec(search)
  if (!m) return null
  const worn: Worn = {}
  for (const raw of decodeURIComponent(m[1]).split(',')) {
    const item = byCode.get(raw.trim())
    if (item) worn[item.category] = item.code      /* 같은 칸이 겹치면 뒤엣것이 이깁니다 */
  }
  return worn
}

/* 코디 → 주소. 카테고리 순서로 고정해야 같은 코디가 같은 주소를 만듭니다 */
function toLook(worn: Worn): string {
  return CATEGORIES.map((c) => worn[c.key]).filter(Boolean).join(',')
}

export default function DressroomPage() {
  const [worn, setWorn] = useState<Worn>(DEFAULT_LOOK)
  const [cat, setCat] = useState<Category>('dress')
  const [note, setNote] = useState('')

  /* 「이런 옷도 입고 싶어요」 (기획서 8.2 · 9장).
     행동으로 수요를 추정하는 것과 별개로, 사람이 직접 말해주는 신호를 받습니다.
     남의 건의는 안 보여줍니다 — 공개하면 모더레이션이 또 하나 생깁니다 */
  const [wish, setWish] = useState('')
  const [wishNote, setWishNote] = useState('')
  const [wishBusy, setWishBusy] = useState(false)

  /* 첫 진입에 한 번. useLang 이 언어를 정한 직후 불립니다 (lib/use-lang.ts) */
  function onFirstOpen(picked: Mode) {
    const fromUrl = parseLook(window.location.search)
    if (fromUrl) {
      setWorn(fromUrl)
      track('look_shared_view', { lang: picked })   /* 남의 코디를 열어본 것 */
    } else {
      track('dressroom_view', { lang: picked })
    }
  }

  /* ⚠️ `useLang` 은 **`onFirstOpen` 아래**에 둡니다 — 응원방과 같은 이유입니다 */
  const [lang, setLang] = useLang((picked) => onFirstOpen(picked))
  const t = dict(lang).dressroom

  /* 주소를 계속 최신 코디로 맞춥니다 — 새로고침해도, 주소를 복사해도 그대로 */
  const writeUrl = useCallback((next: Worn) => {
    const look = toLook(next)
    const q = new URLSearchParams(window.location.search)
    /* 다 벗은 것도 하나의 코디입니다. 빈 값이라도 남겨야 공유 링크가 그대로 열립니다 —
       파라미터를 지우면 받는 사람에게는 「처음 방문」이 되어 기본 코디가 뜹니다 */
    q.set('look', look)
    /* 쉼표를 %2C 로 두면 사람이 읽는 공유 링크가 지저분해집니다. 쉼표는 주소에 그대로 써도 됩니다 */
    const s = q.toString().replace(/%2C/g, ',')
    try { history.replaceState(null, '', window.location.pathname + (s ? '?' + s : '')) } catch {}
  }, [])

  const apply = useCallback((next: Worn) => {
    setWorn(next)
    setNote('')
    writeUrl(next)
  }, [writeUrl])

  const wear = (item: Item) => {
    const next = { ...worn }
    if (next[item.category] === item.code) delete next[item.category]   /* 다시 누르면 벗습니다 */
    else next[item.category] = item.code
    apply(next)
    /* 기획서 9.3 — 이 이벤트가 쌓여서 생산 라인업을 정합니다 */
    track('item_equipped', { item: item.code, lang })
  }

  const takeOff = (category: Category) => {
    const next = { ...worn }
    delete next[category]
    apply(next)
  }

  const random = () => {
    const next: Worn = {}
    for (const c of CATEGORIES) {
      const pool = ITEMS.filter((i) => i.category === c.key)
      next[c.key] = pool[Math.floor(Math.random() * pool.length)].code
    }
    apply(next)
    track('look_random', { lang })
  }

  const sendWish = async () => {
    const body = wish.trim()
    if (!body || wishBusy) return
    setWishBusy(true)
    const { error } = await supabase.from('wishes').insert({
      client_id: getClientId(),
      body,
      look: toLook(worn),        /* 무슨 옷을 보다가 이런 생각을 했나 — 그게 맥락입니다 */
      lang,
    })
    setWishBusy(false)
    if (error) {
      /* 도배 방지에 걸린 것. 쓴 걸 지우지 않습니다 */
      setWishNote(isErr(error, ERR.wishTooFast, ERR.wishTooMany) ? t.wishTooFast : t.wishFailed)
      return
    }
    setWish('')
    setWishNote(t.wishDone)
    track('wish_submitted', { lang })
  }

  const share = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setNote(t.copied)
      track('look_shared', { lang })
    } catch {
      setNote(t.copyFailed)      /* 「복사 실패」라고 쓰지 않습니다 (19.7 카피 규칙) */
    }
  }

  /* 겹치는 순서는 z 하나로 정합니다. ★ 파니에(40)가 드레스(50)보다 아래입니다 */
  const layers = useMemo(() => {
    const on = CATEGORIES.map((c) => worn[c.key]).filter(Boolean)
      .map((code) => byCode.get(code as string)!)
    return [...BASE_LAYERS.map((b) => ({ code: b.code, z: b.z })), ...on.map((i) => ({ code: i.code, z: i.z }))]
      .sort((a, b) => a.z - b.z)
  }, [worn])

  /* 비어 있으면 한국어로 떨어집니다 — 9월에 실물 상품 코드로 갈아끼울 때
     한 언어를 빠뜨려도 화면이 비지 않게 */
  const name = (i: Item) =>
    (lang === 'ja' ? i.nameJa : lang === 'en' ? i.nameEn : i.nameKo) || i.nameKo

  /* 「이 소품이 무슨 색 담당인지」는 학습이 아니라 정보입니다 —
     보는 사람의 언어로 보여줍니다 */
  const colorNames = dict(lang).colors as Record<string, string>
  const colorName = (i: Item) => (i.colorKey ? colorNames[i.colorKey] : '')
  const tabName = (c: Category) =>
    ({ dress: t.tabDress, blouse: t.tabBlouse, head: t.tabHead, accessory: t.tabAccessory }[c])

  const wornList = CATEGORIES.map((c) => worn[c.key]).filter(Boolean)
    .map((code) => byCode.get(code as string)!)

  return (
    <main style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-sub)', margin: '4px 0 0' }}>{t.lead}</p>
      </header>

      {/* ── 아바타 ── */}
      <div style={stage}>
        {layers.map((l) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={l.code} src={`${ITEM_IMAGE_DIR}/${l.code}${ITEM_IMAGE_EXT}`} alt=""
               style={{ ...layerImg, zIndex: l.z }} />
        ))}
      </div>

      {/* ── 지금 입은 것 — 여기서 바로 벗을 수 있습니다 ── */}
      <div style={{ margin: '10px 0 14px', minHeight: 26 }}>
        {wornList.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-sub)' }}>{t.nothingOn}</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {wornList.map((i) => (
              <button key={i.code} onClick={() => takeOff(i.category)} style={chipWorn}
                      aria-label={`${name(i)} ${t.off}`}>
                {i.colorKey && <i style={dot(i.colorKey)} />}
                {name(i)} <span style={{ color: 'var(--color-text-sub)' }}>✕</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button onClick={share} style={{ ...ctaBtn, flex: 1 }}>{t.share}</button>
        <button onClick={random} style={{ ...ctaGhost, flex: 1 }}>{t.random}</button>
      </div>
      {note && <p style={{ margin: '-10px 0 16px', fontSize: 12, color: 'var(--color-primary-strong)' }}>{note}</p>}

      {/* ── 카테고리 ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} style={tab(cat === c.key)}>
            {tabName(c.key)}
          </button>
        ))}
      </div>

      {cat === 'accessory' && (
        <p style={{ fontSize: 12, color: 'var(--color-text-sub)', margin: '0 0 10px' }}>{t.colorNote}</p>
      )}

      {/* ── 아이템 ── */}
      <div style={grid}>
        {ITEMS.filter((i) => i.category === cat).map((i) => {
          const on = worn[i.category] === i.code
          return (
            <button key={i.code} onClick={() => wear(i)} style={card(on, i)} aria-pressed={on}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ITEM_IMAGE_DIR}/${i.code}${ITEM_IMAGE_EXT}`} alt="" style={thumb} />
              <span style={{ fontSize: 11.5, lineHeight: 1.35, wordBreak: 'keep-all' }}>{name(i)}</span>
              {colorName(i) && <span style={subStyle}>{colorName(i)}</span>}
            </button>
          )
        })}
      </div>

      <button onClick={() => apply(DEFAULT_LOOK)} style={{ ...ctaGhost, marginTop: 16 }}>
        {t.reset}
      </button>

      {/* 맨 아래에 둡니다 — 입혀보는 걸 방해하지 않고, 다 본 뒤에 눈에 들어옵니다 */}
      <section style={wishBoxStyle}>
        <b style={{ fontSize: 14 }}>{t.wishTitle}</b>
        <div style={{ display: 'flex', gap: 8, margin: '10px 0 8px' }}>
          <input
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendWish() }}
            placeholder={t.wishPlaceholder}
            maxLength={300}
            style={wishInputStyle}
          />
          <button onClick={sendWish} disabled={!wish.trim() || wishBusy}
                  style={{ ...ctaBtn, fontSize: 14, padding: '11px 16px', opacity: wish.trim() ? 1 : 0.5 }}>
            {t.wishSend}
          </button>
        </div>
        {/* 옷 이야기라 위험은 낮지만 자유 입력입니다 (기획서 3.5) */}
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text-sub)' }}>
          {wishNote || t.wishNotice}
        </p>
      </section>

      <RoomNav lang={lang} here="dressroom" />
    </main>
  )
}

/* 이 화면에서만 쓰는 조각들. 공통은 lib/ui.ts 에 있습니다 */
const stage: CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '3 / 4',
  background: 'var(--color-surface-sub)', border: `1px solid ${LINE}`,
  borderRadius: 'var(--radius-card)', overflow: 'hidden',
}
const layerImg: CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
  pointerEvents: 'none',
}
const grid: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8,
}
const thumb: CSSProperties = {
  width: '100%', aspectRatio: '1', objectFit: 'contain', background: 'var(--color-surface-sub)',
  borderRadius: 10, marginBottom: 6,
}
const wishBoxStyle: CSSProperties = {
  marginTop: 24, padding: 16, borderRadius: 'var(--radius-card)',
  background: 'var(--color-surface)', border: `1px solid ${LINE}`,
}
const wishInputStyle: CSSProperties = {
  flex: 1, minWidth: 0, padding: 11, fontSize: 14,
  borderRadius: 'var(--radius-full)', border: `1px solid ${LINE}`,
  background: 'var(--color-bg)',
}

/* 주 언어보다 작고 흐리게 — 읽고 싶은 사람만 읽으면 됩니다 */
const subStyle: CSSProperties = {
  display: 'block', marginTop: 3, fontSize: 10.5, lineHeight: 1.3,
  color: 'var(--color-text-sub)', wordBreak: 'keep-all',
}

function card(on: boolean, i: Item): CSSProperties {
  /* border 축약형과 borderTop 을 같이 쓰면 리렌더 때 서로 덮어씁니다 — 네 변을 따로 씁니다 */
  const line = on ? '2px solid var(--color-text)' : `1px solid ${LINE}`
  return {
    padding: 8, cursor: 'pointer', textAlign: 'center',
    background: 'var(--color-surface)',
    borderTop: i.colorKey ? `3px solid var(--role-${i.colorKey})` : line,
    borderRight: line, borderBottom: line, borderLeft: line,
    borderRadius: 'var(--radius-card)', color: 'var(--color-text)',
  }
}
const chipWorn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 10px', borderRadius: 'var(--radius-full)',
  background: 'var(--color-surface)', border: `1px solid ${LINE}`,
  color: 'var(--color-text)', fontSize: 12, cursor: 'pointer',
}
