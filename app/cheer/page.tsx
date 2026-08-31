'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { COLOR_KEYS, type ColorKey } from '@/lib/colors'
import { getClientId } from '@/lib/client-id'
import { dict, type Mode } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { loadMe, saveMe } from '@/lib/me'
import LangToggle from '@/components/LangToggle'
import RoomNav from '@/components/RoomNav'
import { LINE, wrap, box, ctaBtn, ctaGhost, linkBtn, dot } from '@/lib/ui'
import { track } from '@/lib/analytics'
import { ERR, isErr } from '@/lib/errors'

/* ─────────────────────────────────────────────────────────
   응원방 (기획서 5.14)

   멤놀방과 다른 물건입니다 — 정원이 없고, 한 줄 남기고 나가는 곳이라
   실시간을 쓰지 않습니다. 동시 접속 여유를 멤놀방에 남겨둡니다.

   ⚠️ 색깔에만 남깁니다. 실존 인물 이름은 3.5 위반입니다.
   ───────────────────────────────────────────────────────── */

const INSTAGRAM = 'https://www.instagram.com/eugene_k_seoul/'
const YOUTUBE   = 'https://www.youtube.com/@Eugenekseoul'
const MAX_LEN = 200
const COOLDOWN_MS = 10_000

type Row = {
  id: string
  body: string
  created_at: string
  room_id: string
  participants: { name: string; color_key: string } | null
}

const SELECT = 'id, body, created_at, room_id, participants(name, color_key)'

export default function CheerRoom() {
  const [lang, setLang] = useLang((picked) => onFirstOpen(picked))
  const t = dict(lang).cheer
  const colorNames = dict(lang).colors as Record<string, string>

  const [rooms, setRooms] = useState<Record<ColorKey, string>>({} as Record<ColorKey, string>)
  const [rows, setRows] = useState<Row[]>([])
  /* 색깔별 개수 — 화면은 최근 50개만 불러와서, 로드된 것으로 세면 51개째부터 틀어집니다 */
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<ColorKey | null>(null)
  const [target, setTarget] = useState<ColorKey>('pink')
  const [name, setName] = useState('')
  const [myColor, setMyColor] = useState<ColorKey>('pink')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const lastSent = useRef(0)
  /* 방금 남긴 색 — 남긴 직후 확인 줄에 씁니다.
     확인이 없으면 내 글이 폼 「위쪽」 목록에 붙어서 남겨졌는지도 모릅니다 */
  const [sent, setSent] = useState<ColorKey | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* 방 목록 → 색 ↔ room_id 표 */
  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('id, slug').eq('world', 'cheer')
    const map = {} as Record<ColorKey, string>
    for (const r of data ?? []) map[r.slug.replace('cheer-', '') as ColorKey] = r.id
    setRooms(map)
    return map
  }, [])

  const loadCounts = useCallback(async () => {
    const { data } = await supabase.from('cheer_counts').select('color_key, n')
    const next: Record<string, number> = {}
    for (const r of data ?? []) next[r.color_key as string] = Number(r.n)
    setCounts(next)
  }, [])

  const loadRows = useCallback(async (map: Record<ColorKey, string>) => {
    const ids = Object.values(map)
    if (!ids.length) return
    const { data } = await supabase
      .from('messages').select(SELECT)
      .in('room_id', ids)
      .order('created_at', { ascending: false })
      .limit(50)
    setRows((data as unknown as Row[]) ?? [])
  }, [])

  /* 첫 진입에 한 번. useLang 이 언어를 정한 직후 불립니다 (lib/use-lang.ts) —
     계측에 언어가 실려야 해서 상태가 갱신되기를 기다리지 않고 여기서 받습니다 */
  function onFirstOpen(picked: Mode) {
    /* cutie-type 에서 ?c=pink 로 넘어옵니다. 색 하나만 넘어옵니다 — 이름은 넘어오지 않습니다.
       기획서 4.16 에서 c 는 「내 색」입니다. 대상 색은 여기 응원방에서 고릅니다.
       필터는 전체로 둡니다 — 한 색만 걸어두면 초기에 썰렁해 보입니다 (4.6 빈 방 문제). */
    const c = /[?&]c=([a-z]+)/.exec(window.location.search)?.[1]
    if (c && (COLOR_KEYS as readonly string[]).includes(c)) {
      setMyColor(c as ColorKey)
      setTarget(c as ColorKey)
    }

    /* 테스트의 bridge_click 과 짝이 되는 도착 지점입니다.
       이게 없으면 다리를 건넌 사람이 실제로 도착했는지 알 수 없습니다 */
    const from = /[?&]from=([a-z0-9-]+)/i.exec(window.location.search)?.[1]
    track(from ? 'bridge_arrive' : 'cheer_landing', {
      from: from ?? 'direct', result: c, lang: picked,
    })

    const me = loadMe()
    if (me) {
      setName(me.name ?? '')
      /* 이름만 가져옵니다. 색은 ?c= 로 온 게 있으면 그쪽이 최신입니다 */
      if (!c && (COLOR_KEYS as readonly string[]).includes(me.colorKey)) {
        setMyColor(me.colorKey as ColorKey)
      }
    }

    loadRooms().then(loadRows)
    loadCounts()
  }

  const colorOf = (roomId: string) =>
    (Object.keys(rooms) as ColorKey[]).find((k) => rooms[k] === roomId) ?? 'pink'

  /* 아직 하나도 없는 색을 먼저 권합니다 — 칩이 전부 0 인 화면이 제일 썰렁합니다 (기획서 4.6).
     남은 색 중 무작위로 고릅니다. 순서대로 고르면 모두가 같은 색으로 몰립니다 */
  function nextColor(): ColorKey {
    const rest = COLOR_KEYS.filter((k) => k !== target)
    const empty = rest.filter((k) => !(counts[k] ?? 0))
    const pool = empty.length ? empty : rest
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function again() {
    const next = nextColor()
    track('cheer_again', { result: next, lang })
    setTarget(next)
    setSent(null)
    setNote('')
    inputRef.current?.focus()
  }

  const shown = filter ? rows.filter((r) => rooms[filter] === r.room_id) : rows
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  async function send() {
    const body = text.trim()
    if (!body || busy) return
    if (!name.trim()) return
    if (Date.now() - lastSent.current < COOLDOWN_MS) { setNote(t.cooldown); return }

    const roomId = rooms[target]
    if (!roomId) return

    setBusy(true)
    setNote('')
    const clientId = getClientId()

    /* 이름·색을 기억해둡니다 — 라운지 입장 화면과 같은 칸을 씁니다 */
    saveMe({ clientId, colorKey: myColor, name: name.trim(), role: '', avatar: 'preset-01' })

    /* 채팅방과 같은 함수를 씁니다. client_id 는 브라우저에서 서버로만 가고 돌아오지 않습니다 */
    const { data: pid, error: joinError } = await supabase.rpc('join_room', {
      p_room_id: roomId,
      p_client_id: clientId,
      p_name: name.trim(),
      p_color_key: myColor,
    })
    if (joinError || !pid) { console.error('참가자 등록 실패:', joinError); setBusy(false); return }

    const { error } = await supabase.from('messages').insert({
      room_id: roomId, layer: 'stage', participant_id: pid,
      body, client_msg_id: crypto.randomUUID(),
    })

    /* 서버 쪽 도배 방지에 걸리면 입력을 지우지 않습니다 — 쓴 걸 잃으면 안 됩니다 */
    if (error) {
      console.error('응원 저장 실패:', error)
      setNote(isErr(error, ERR.cheerTooMany) ? t.tooMany : t.cooldown)
      setBusy(false)
      return
    }

    lastSent.current = Date.now()
    setText('')
    setBusy(false)
    setSent(target)
    /* 이 방의 목표 행동입니다 — 4.11 의 등록 수와 함께 제일 위에서 봐야 합니다 */
    track('cheer_sent', { result: target, lang })
    await loadRows(rooms)
    await loadCounts()
  }

  return (
    <main style={wrap}>
      {/* 언어 버튼 — 제목 위 한 줄. 떠 있으면 모바일에서 제목을 덮습니다 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-sub)', margin: '4px 0 0' }}>{t.lead}</p>
      </header>

      {/* 색 필터 — 전체가 기본입니다. 8개로 나누면 초기에 방마다 두세 개라 썰렁합니다 */}
      {/* 칩이 9개라 접으면 둘째 줄에 하나만 남습니다. 한 줄로 두고 옆으로 밀리게 합니다 */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 14,
        overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        <button onClick={() => setFilter(null)} style={chip(filter === null)}>
          {t.all}{total > 0 ? ` ${total}` : ''}
        </button>
        {COLOR_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={chip(filter === k, k)}
            aria-label={`${colorNames[k]} ${counts[k] ?? 0}`}
          >
            <i style={dot(k)} />
            {/* 0 일 땐 숫자를 안 씁니다 — 0 이 여덟 개 늘어서 있으면 더 썰렁해 보입니다 */}
            {(counts[k] ?? 0) > 0 && (
              <span style={{ marginLeft: 5, fontSize: 12, fontWeight: 600 }}>{counts[k]}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => { loadRows(rooms); loadCounts() }} style={linkBtn}>{t.refresh}</button>
      </div>

      <section style={{ marginBottom: 26 }}>
        {shown.length === 0 && <p style={emptyStyle}>{t.empty}</p>}
        {shown.map((r) => (
          <article key={r.id} style={{ ...item, borderLeftColor: `var(--role-${colorOf(r.room_id)})` }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-sub)', marginBottom: 3 }}>
              <i style={dot(r.participants?.color_key as ColorKey)} />
              <strong style={{ color: 'var(--color-text)', marginLeft: 6 }}>{r.participants?.name}</strong>
              <span style={{ margin: '0 5px' }}>→</span>
              {colorNames[colorOf(r.room_id)]}
            </div>
            <div style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{r.body}</div>
          </article>
        ))}
      </section>

      <section style={box}>
        {/* 규칙은 입력칸 위 — 쓰고 나서 보면 늦습니다 */}
        <p style={noticeStrong}>{t.noticeColor}</p>
        <p style={{ ...noticeSoft, marginBottom: 16 }}>{t.noticeRealPerson}</p>

        <label style={label}>{t.toWhom}</label>
        {/* 8개가 한 줄에 들어가도록 크기를 맞춥니다 — 하나만 다음 줄로 넘어가면 덜 만든 것처럼 보입니다 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {COLOR_KEYS.map((k) => (
            <button key={k} onClick={() => setTarget(k)} style={swatch(target === k, k)} aria-label={colorNames[k]} />
          ))}
        </div>

        <label style={label}>{t.nameLabel}</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
               placeholder={t.namePlaceholder} maxLength={12} style={input} />

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); if (sent) setSent(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
            placeholder={t.placeholder}
            maxLength={MAX_LEN}
            style={{ ...input, flex: 1, marginBottom: 0 }}
          />
          <button onClick={send} disabled={busy || !text.trim() || !name.trim()} style={sendBtn}>
            {busy ? t.sending : t.send}
          </button>
        </div>
        {note && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-primary-strong)' }}>{note}</p>}

        {/* 남긴 직후 — 확인과 재참여를 한 줄에서 끝냅니다.
            버튼이 아니라 링크입니다. 아래 팔로우 버튼과 경쟁하면 안 됩니다 (기획서 4.15) */}
        {sent && !note && (
          <div style={sentRow}>
            <span><i style={{ ...dot(sent), marginRight: 6 }} />{t.sentOk}</span>
            <button onClick={again} style={againBtn}>{t.sendAnother}</button>
          </div>
        )}

        {/* 안내는 입력칸 아래에 둡니다 — 위에 있으면 쓰기도 전에 혼나는 화면이 됩니다 */}
        <div style={noticeBox}>
          <p style={noticeSoft}>{t.noticeDelete}</p>
        </div>
      </section>

      {/* 응원을 남긴 직후가 가장 우호적인 순간입니다 (기획서 4.11 — 등록 수가 가장 중요) */}
      <section style={{ ...box, textAlign: 'center', marginTop: 14 }}>
        <b style={{ fontSize: 15 }}>{t.notifyTitle}</b>
        {/* 멤놀방이 뭔지 모르는 사람이 있어서 한 줄 설명을 답니다 */}
        <p style={{ fontSize: 13, color: 'var(--color-text-sub)', margin: '6px 0 0' }}>{t.notifyLead}</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-sub)', margin: '4px 0 14px' }}>{t.notifyBody}</p>
        {/* 「초대합니다」라고 했으면 들어가는 문이 같은 자리에 있어야 합니다.
            그리고 라운지로 가는 버튼이 팔로우보다 위입니다 (기획서 4.15) */}
        <Link href="/lounge" style={ctaBtn}
              onClick={() => track('bridge_click', { to: 'lounge', lang })}>{t.notifyEnter}</Link>
        {/* 팔로우는 보조입니다 — 주 버튼이 둘이면 아무것도 안 눌립니다 */}
        <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" style={{ ...ctaGhost, marginTop: 8 }}
           onClick={() => track('notify_signup', { via: 'instagram', lang })}>{t.notifyButton}</a>
        <a href={YOUTUBE} target="_blank" rel="noopener noreferrer" style={{ ...ctaGhost, marginTop: 8 }}
           onClick={() => track('notify_signup', { via: 'youtube', lang })}>{t.notifyYoutube}</a>
      </section>

      <RoomNav lang={lang} here="cheer" />
    </main>
  )
}

/* 이 화면에서만 쓰는 조각들. 공통은 lib/ui.ts 에 있습니다 */
const item: CSSProperties = {
  borderLeft: '3px solid', paddingLeft: 12, marginBottom: 16,
}
const emptyStyle: CSSProperties = {
  fontSize: 13, color: 'var(--color-text-sub)', textAlign: 'center', padding: '28px 0',
}
const noticeBox: CSSProperties = {
  marginTop: 16, paddingTop: 14, borderTop: '1px solid #F7EDF1',
  display: 'flex', flexDirection: 'column', gap: 6,
}
const noticeStrong: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55 }
const noticeSoft: CSSProperties = { margin: 0, fontSize: 12, color: 'var(--color-text-sub)', lineHeight: 1.55 }

const label: CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--color-text-sub)', marginBottom: 6,
}
const input: CSSProperties = {
  width: '100%', padding: 12, marginBottom: 4, fontSize: 15,
  borderRadius: 'var(--radius-full)', border: '1px solid #F2E4E8', background: 'var(--color-bg)',
}
const sendBtn: CSSProperties = {
  padding: '0 18px', borderRadius: 'var(--radius-full)', border: 'none',
  background: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer',
}
const sentRow: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 10, marginTop: 10, fontSize: 13,
}
/* 링크 크기로 두되, 회색은 벗깁니다 — 회색이면 안내문으로 보여서 안 눌립니다 */
const againBtn: CSSProperties = {
  ...linkBtn, fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
}
function chip(on: boolean, k?: ColorKey): CSSProperties {
  return {
    flex: 'none', whiteSpace: 'nowrap',   /* 가로 스크롤 줄에서 칩이 찌그러지지 않게 */
    padding: k ? '7px 9px' : '7px 12px', borderRadius: 'var(--radius-full)',
    border: on ? '1px solid var(--color-text)' : `1px solid ${LINE}`,
    background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center',
  }
}
function swatch(on: boolean, k: ColorKey): CSSProperties {
  return {
    flex: 1, aspectRatio: '1', maxWidth: 38, borderRadius: 'var(--radius-full)',
    background: `var(--role-${k})`,
    border: on ? '3px solid var(--color-text)' : '3px solid transparent',
    cursor: 'pointer',
  }
}
