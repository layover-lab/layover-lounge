'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { dict } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { loadMe } from '@/lib/me'
import LangToggle from '@/components/LangToggle'
import { LINE, dot, tab, ctaBtn, ctaGhost, linkBtn } from '@/lib/ui'
type Member = { id: string; name: string; role: string | null; color_key: string }

/* 같은 방 안의 두 층 (기획서 5.4). 방을 옮기는 게 아니라 탭이 바뀌는 것입니다 */
type Layer = 'stage' | 'backstage'

/* 기획서 19.3 의 11종. 순서를 바꿔도 되지만 값(코드)은 DB check 와 같아야 합니다 */
const REASONS = [
  'harassment', 'abuse', 'sexual', 'stalking', 'personal_info',
  'impersonation', 'copyright', 'banned_image', 'spam', 'scam', 'other',
] as const
type Reason = (typeof REASONS)[number]

/* 숨긴 사람 — 브라우저에만 둡니다.
   로그인이 없으면 서버 차단은 브라우저만 바꿔도 뚫려서 지키는 척만 하게 됩니다.
   participants.id 는 방마다 새로 생기므로 이 목록은 자연히 방 단위입니다 (19.2 「숨기기」) */
const HIDDEN_KEY = 'layover.hidden'

function loadHidden(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[] } catch { return [] }
}

type Msg = {
  id: string
  layer: Layer
  body: string
  client_msg_id: string | null
  created_at: string
  participant_id: string | null
  participants: { name: string; color_key: string; role: string | null } | null
}

const SELECT = 'id, layer, body, client_msg_id, created_at, participant_id, participants(name, color_key, role)'

export default function Stage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  type Room = {
    id: string; gate_no: number | null; capacity: number | null
    title: string; title_ja: string | null; title_en: string | null
    situation: string | null; situation_ja: string | null; situation_en: string | null
  }
  const [room, setRoom] = useState<Room | null>(null)
  const [full, setFull] = useState(false)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  /* 무대와 백스테이지는 같은 방입니다 — 메시지를 한 번에 받아두고 보여줄 때 가릅니다.
     따로 불러오면 탭을 옮길 때마다 화면이 비었다가 채워집니다 */
  const [layer, setLayer] = useState<Layer>('stage')
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [lang, setLang] = useLang()
  const t = dict(lang).room

  /* 학생 피드백 2026-08-29 (트리파노소마) —
     "방 안에 몇 명이 있는지, 어떤 역할이 있는지 알기 어렵다.
      역할극이 목적인 방인데 이런 정보를 아는 게 중요한 것 같다"

     ⚠️ 「지금 접속 중」이 아니라 「이 방에 들어온 사람」입니다.
        접속 여부는 Realtime presence 가 있어야 알 수 있는데,
        그건 동시 연결을 더 먹어서 지금은 안 씁니다 (5.14 와 같은 이유). */
  const [members, setMembers] = useState<Member[]>([])
  const [showMembers, setShowMembers] = useState(false)

  /* 신고·숨기기 (기획서 19장). 숨기지 않고 1탭 안에 둡니다 (19.1) */
  const [hidden, setHidden] = useState<string[]>([])
  const [menuFor, setMenuFor] = useState<string | null>(null)      /* ⋯ 를 연 참가자 */
  const [reportFor, setReportFor] = useState<Msg | null>(null)
  const [reason, setReason] = useState<Reason | null>(null)
  const [detail, setDetail] = useState('')
  const [reportNote, setReportNote] = useState('')

  const loadMembers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('participants')
      .select('id, name, role, color_key')
      .eq('room_id', roomId)
      .order('joined_at')
    setMembers((data as Member[]) ?? [])
  }, [])

  useEffect(() => { setHidden(loadHidden()) }, [])

  function hidePerson(pid: string) {
    const next = Array.from(new Set([...hidden, pid]))
    setHidden(next)
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch {}
    setMenuFor(null)
  }

  function unhideAll() {
    setHidden([])
    try { localStorage.setItem(HIDDEN_KEY, '[]') } catch {}
  }

  async function sendReport() {
    if (!reportFor || !reason || !room) return
    const { error } = await supabase.from('reports').insert({
      room_id: room.id,
      message_id: reportFor.id,
      reporter_id: participantId,
      target_id: reportFor.participant_id,
      reason,
      detail: detail.trim() || null,
    })
    if (error) console.error('신고 접수 실패:', error)
    /* 접수 여부와 무관하게 같은 문구를 보여줍니다 — 신고했다는 사실이 화면에 오래 남으면
       옆 사람에게 보입니다. 실패는 콘솔로만 남깁니다 */
    setReportFor(null); setReason(null); setDetail('')
    setReportNote(t.reportDone)
    setTimeout(() => setReportNote(''), 4000)
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function join() {
      const me = loadMe()
      if (!me) {
        router.push('/lounge')      /* 이름·색을 아직 안 정한 사람 */
        return
      }

      const { data: r, error: roomError } = await supabase
        .from('rooms')
        .select('id, gate_no, capacity, title, title_ja, title_en, situation, situation_ja, situation_en')
        .eq('slug', slug).single()
      if (roomError) {
        console.error('방 조회 실패:', roomError)
        return
      }
      if (!r || cancelled) return
      setRoom(r)

      /* 브라우저는 participants 를 직접 쓰지 않습니다 — client_id 가 오가면 사칭이 됩니다.
         등록·갱신은 서버 함수 하나로 (20260831140000_join_room_rpc.sql) */
      const { data: joined, error: joinError } = await supabase.rpc('join_room', {
        p_room_id: r.id,
        p_client_id: me.clientId,
        p_name: me.name,
        p_color_key: me.colorKey,
        p_role: me.role || null,
        p_avatar: me.avatar,
      })
      if (joinError) {
        /* 직접 주소로 들어와도 9번째는 못 들어옵니다 — 정원은 서버가 셉니다 (기획서 3.7) */
        if (String(joinError.message).includes('gate_full')) { setFull(true); return }
        console.error('참가자 등록 실패:', joinError)
      }
      const pid = joined as string | null
      if (cancelled) return
      setParticipantId(pid ?? null)
      await loadMembers(r.id)

      const { data: rows } = await supabase
        .from('messages').select(SELECT)
        .eq('room_id', r.id)
        .order('created_at')
      if (cancelled) return
      setMessages((rows as unknown as Msg[]) ?? [])

      channel = supabase
        .channel('room:' + r.id + ':' + crypto.randomUUID())
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room_id=eq.' + r.id },
          async (payload) => {
            const { data } = await supabase
              .from('messages').select(SELECT).eq('id', payload.new.id).single()
            if (!data) return
            const incoming = data as unknown as Msg
            setMessages((prev) =>
              prev.some((m) => m.client_msg_id && m.client_msg_id === incoming.client_msg_id)
                ? prev
                : [...prev, incoming]
            )
          }
        )
        .subscribe()
    }

    join()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [slug, router, loadMembers])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, layer])

  async function send(raw?: string) {
    const body = (raw ?? text).trim()
    if (!body || !room || !participantId) return
    const clientMsgId = crypto.randomUUID()
    const me = loadMe()!
    if (raw === undefined) setText('')

    setMessages((prev) => [
      ...prev,
      {
        id: clientMsgId,
        layer,
        body,
        client_msg_id: clientMsgId,
        created_at: new Date().toISOString(),
        participant_id: participantId,
        participants: { name: me.name, color_key: me.colorKey, role: me.role || null },
      },
    ])

    const { error } = await supabase.from('messages').insert({
      room_id: room.id,
      layer,
      participant_id: participantId,
      body,
      client_msg_id: clientMsgId,
    })
    if (error) console.error('메시지 전송 실패:', error)
  }

  /* 두 층을 한 번에 받아두고 여기서 가릅니다. 숨긴 사람도 여기서 빠집니다 */
  const shown = messages.filter(
    (m) => m.layer === layer && !(m.participant_id && hidden.includes(m.participant_id))
  )

  if (full) {
    return (
      <main style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <p style={{ fontSize: 15, margin: '40px 0 20px', textAlign: 'center' }}>{t.full}</p>
        <button onClick={() => router.push('/lounge')} style={{ ...ctaBtn, width: '100%' }}>
          {t.back}
        </button>
      </main>
    )
  }

  if (!room) return <main style={{ padding: 24 }}>...</main>

  /* 절대 규칙 ④ — 비어 있으면 한국어로 떨어집니다 */
  const roomTitle =
    (lang === 'ja' ? room.title_ja : lang === 'en' ? room.title_en : room.title) || room.title
  const roomSituation =
    (lang === 'ja' ? room.situation_ja : lang === 'en' ? room.situation_en : room.situation) ||
    room.situation

  return (
    <main style={{ width: '100%', maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#FDE3EE', padding: '14px 16px' }}>
        {/* 오른쪽 위는 👥 가 쓰고 있어서 나가기 줄에 둡니다 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <button onClick={() => router.push('/lounge')} style={backStyle}>← {t.back}</button>
          <LangToggle lang={lang} onChange={setLang} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>
            {roomTitle}
            {/* 「1번 방」이 아니라 「1번 게이트」입니다 — 통과하면 다른 세계라는 걸 한 단어로 (3.7) */}
            {room.gate_no && (
              <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-text-sub)' }}>
                {' · ' + t.gate.replace('{n}', String(room.gate_no))}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              const next = !showMembers
              setShowMembers(next)
              if (next) loadMembers(room.id)   /* 열 때마다 최신으로 */
            }}
            aria-expanded={showMembers}
            style={membersBtnStyle}
          >
            👥 {members.length}{room.capacity ? ` / ${room.capacity}` : ''} {showMembers ? '▴' : '▾'}
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-text-sub)', marginTop: 4 }}>
          📌 {roomSituation}
        </div>

        {showMembers && (
          <ul style={memberListStyle}>
            {members.length === 0 && (
              <li style={{ fontSize: 13, color: 'var(--color-text-sub)' }}>{t.membersEmpty}</li>
            )}
            {members.map((m) => (
              <li key={m.id} style={memberRowStyle}>
                <i style={{ ...dot(m.color_key), flex: 'none' }} />
                {m.role && <span style={{ color: 'var(--color-text-sub)' }}>{m.role}</span>}
                <strong>{m.name}</strong>
                {m.id === participantId && <span style={youTagStyle}>{t.you}</span>}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* 무대 · 백스테이지 — 같은 방의 두 층입니다 (기획서 5.4) */}
      <div style={tabBarStyle}>
        {(['stage', 'backstage'] as const).map((l) => (
          <button key={l} onClick={() => setLayer(l)} aria-pressed={layer === l} style={tab(layer === l)}>
            {l === 'stage' ? t.tabStage : t.tabBackstage}
          </button>
        ))}
      </div>
      {layer === 'backstage' && <p style={backstageLeadStyle}>{t.backstageLead}</p>}

      {hidden.length > 0 && (
        <div style={hiddenBarStyle}>
          <span>{t.hidden}</span>
          <button onClick={unhideAll} style={linkBtn}>{t.unhide}</button>
        </div>
      )}
      {reportNote && <p style={reportNoteStyle}>{reportNote}</p>}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: layer === 'backstage' ? BACKSTAGE_BG : 'var(--color-surface-sub)' }}>
        {shown.length === 0 && layer === 'stage' && (
          <p style={{ color: 'var(--color-text-sub)', fontSize: 13, textAlign: 'center' }}>{t.empty}</p>
        )}

        {/* 빈 채팅창을 주지 않습니다 — 무엇을 말해야 할지 모르면 아무도 안 씁니다 (5.4) */}
        {shown.length === 0 && layer === 'backstage' && (
          <div style={tplCardStyle}>
            <b style={{ fontSize: 14 }}>{t.tplTitle}</b>
            <ul style={{ margin: '10px 0 14px', padding: 0, listStyle: 'none', fontSize: 13, lineHeight: 1.9 }}>
              <li>· {t.tplQ1}</li>
              <li>· {t.tplQ2}</li>
              <li>· {t.tplQ3}</li>
            </ul>
            <button
              onClick={() => send([t.tplTitle, '· ' + t.tplQ1, '· ' + t.tplQ2, '· ' + t.tplQ3].join('\n'))}
              style={tplSendStyle}
            >
              {t.tplSend}
            </button>
          </div>
        )}

        {shown.map((m) => {
          /* 내가 친 것과 남이 친 것을 한눈에 가릅니다 (학생 피드백 2026-08-28) */
          const mine = !!participantId && m.participant_id === participantId
          return (
            <div key={m.id} style={{
              marginBottom: 14, display: 'flex', flexDirection: 'column',
              alignItems: mine ? 'flex-end' : 'flex-start',
            }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {/* 백스테이지는 「사람」으로 말하는 자리라 캐릭터 표시(색·역할)를 뺍니다 (5.4) */}
                {layer === 'stage' && (
                  <>
                    <span style={{ ...dot(m.participants?.color_key), marginRight: 6 }} />
                    {m.participants?.role && (
                      <span style={{ color: 'var(--color-text-sub)', marginRight: 4 }}>
                        {m.participants.role}
                      </span>
                    )}
                  </>
                )}
                <strong>{m.participants?.name}</strong>
                {/* 신고·숨기기는 감추지 않습니다 — 1탭 안에 있어야 씁니다 (기획서 19.1) */}
                {!mine && m.participant_id && (
                  <button
                    onClick={() => setMenuFor(menuFor === m.participant_id ? null : m.participant_id)}
                    aria-label={t.more}
                    style={moreStyle}
                  >⋯</button>
                )}
              </div>
              <div style={bubbleFor(layer, mine)}>{m.body}</div>

              {menuFor === m.participant_id && !mine && (
                <div style={menuStyle}>
                  <button onClick={() => hidePerson(m.participant_id!)} style={menuItemStyle}>{t.hide}</button>
                  <button onClick={() => { setMenuFor(null); setReportFor(m) }} style={menuItemStyle}>{t.report}</button>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {reportFor && (
        <div style={sheetWrapStyle} role="dialog" aria-modal="true">
          <div style={sheetStyle}>
            <b style={{ fontSize: 15 }}>{t.reportTitle}</b>
            {/* 빨간 경고문 대신 담백하게. 그리고 직접 항의하지 말라고 안내합니다 (19.1) */}
            <p style={{ fontSize: 12, color: 'var(--color-text-sub)', margin: '6px 0 12px', lineHeight: 1.6 }}>
              {t.reportLead}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} style={tab(reason === r)}>
                  {(t as unknown as Record<string, string>)['r_' + r]}
                </button>
              ))}
            </div>

            {/* 스크린샷을 요구하지 않습니다 — 접수율이 급락합니다 (19.3) */}
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={t.reportDetail}
              maxLength={500}
              rows={3}
              style={textareaStyle}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setReportFor(null); setReason(null); setDetail('') }}
                      style={{ ...ctaGhost, flex: 1, fontSize: 14 }}>{t.close}</button>
              <button onClick={sendReport} disabled={!reason}
                      style={{ ...ctaBtn, flex: 1, fontSize: 14, opacity: reason ? 1 : 0.5 }}>
                {t.reportSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: 12, background: 'var(--color-surface)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) send()
          }}
          placeholder={t.placeholder}
          maxLength={500}
          style={{ flex: 1, padding: 12, borderRadius: 'var(--radius-full)', border: '1px solid #F2E4E8' }}
        />
        <button onClick={() => send()} style={sendStyle}>{t.send}</button>
      </div>
    </main>
  )
}

const membersBtnStyle: CSSProperties = {
  flex: 'none', background: 'var(--color-surface)', border: '1px solid #F2C9DA',
  borderRadius: 'var(--radius-full)', padding: '6px 12px',
  fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
}

const memberListStyle: CSSProperties = {
  listStyle: 'none', margin: '12px 0 0', padding: '12px 0 0',
  borderTop: '1px solid #F2C9DA',
  display: 'flex', flexDirection: 'column', gap: 8,
}

const memberRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, fontSize: 14,
}

const youTagStyle: CSSProperties = {
  fontSize: 11, padding: '1px 7px', borderRadius: 'var(--radius-full)',
  background: 'var(--color-primary)', color: 'var(--color-text)',
}

const backStyle: CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  fontSize: 12, color: 'var(--color-text-sub)', cursor: 'pointer',
}

const bubbleStyle: CSSProperties = {
  display: 'inline-block', background: 'var(--color-surface)',
  border: '1px solid #F2E4E8', borderRadius: 'var(--radius-bubble)',
  padding: '10px 14px', fontSize: 15, maxWidth: '85%', whiteSpace: 'pre-wrap',
}

/* ── 백스테이지 ──────────────────────────────────
   무대는 깅엄·핑크, 백스테이지는 무지·회청색입니다 (기획서 5.4).
   색이 바뀌면 「지금 캐릭터가 아니라 나로 말하는 중」이 설명 없이 읽힙니다 */
const BACKSTAGE_BG = '#F1F4F8'

const moreStyle: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-sub)', fontSize: 15, lineHeight: 1, padding: '0 6px',
}
const menuStyle: CSSProperties = {
  display: 'flex', gap: 6, marginTop: 6,
}
const menuItemStyle: CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-full)',
  border: `1px solid ${LINE}`, background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 12, cursor: 'pointer',
}
const hiddenBarStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  padding: '8px 16px', background: 'var(--color-neutral)',
  fontSize: 12, color: 'var(--color-text-sub)',
}
const reportNoteStyle: CSSProperties = {
  margin: 0, padding: '8px 16px', background: 'var(--color-primary-tint)',
  fontSize: 12.5, color: 'var(--color-text)',
}
const sheetWrapStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(43,34,38,.35)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 20,
}
const sheetStyle: CSSProperties = {
  width: '100%', maxWidth: 480, background: 'var(--color-surface)',
  borderRadius: '20px 20px 0 0', padding: 20,
  maxHeight: '80dvh', overflowY: 'auto',
}
const textareaStyle: CSSProperties = {
  width: '100%', padding: 12, fontSize: 14, lineHeight: 1.6,
  borderRadius: 'var(--radius-card)', border: `1px solid ${LINE}`,
  background: 'var(--color-bg)', resize: 'none',
}

const tabBarStyle: CSSProperties = {
  display: 'flex', gap: 6, padding: '10px 16px 0', background: 'var(--color-surface)',
}
const backstageLeadStyle: CSSProperties = {
  margin: 0, padding: '8px 16px', background: BACKSTAGE_BG,
  fontSize: 12, color: 'var(--color-text-sub)',
}
const tplCardStyle: CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid #DDE5EE',
  borderRadius: 'var(--radius-card)', padding: 16, textAlign: 'center',
}
const tplSendStyle: CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-full)',
  border: '1px solid #C9D6E6', background: '#E6EDF6',
  color: 'var(--color-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
const backBubbleStyle: CSSProperties = {
  display: 'inline-block', background: '#FFFFFF',
  border: '1px solid #DDE5EE', borderRadius: 'var(--radius-bubble)',
  padding: '10px 14px', fontSize: 15, maxWidth: '85%', whiteSpace: 'pre-wrap',
}
const myBackBubbleStyle: CSSProperties = {
  ...backBubbleStyle, background: '#E6EDF6', border: '1px solid #C9D6E6',
}
function bubbleFor(layer: Layer, mine: boolean): CSSProperties {
  if (layer === 'backstage') return mine ? myBackBubbleStyle : backBubbleStyle
  return mine ? myBubbleStyle : bubbleStyle
}

/* 내 말풍선 — 핑크 틴트. 글자는 --color-text 라 대비가 유지됩니다 */
const myBubbleStyle: CSSProperties = {
  ...bubbleStyle,
  background: 'var(--color-primary-tint)',
  border: '1px solid var(--color-primary)',
}

const sendStyle: CSSProperties = {
  padding: '0 18px', borderRadius: 'var(--radius-full)', border: 'none',
  background: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer',
}
