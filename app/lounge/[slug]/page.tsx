'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { dict, field } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { useHidden } from '@/lib/use-hidden'
import { loadMe } from '@/lib/me'
import { KEYS, readJson, writeJson } from '@/lib/storage'
import { ERR, isErr } from '@/lib/errors'
import LangToggle from '@/components/LangToggle'
import ReportSheet from '@/components/ReportSheet'
import { LINE, dot, tab, ctaBtn, linkBtn } from '@/lib/ui'
import { useAfterMount } from '@/lib/use-after-mount'
import { useViewportHeight } from '@/lib/use-viewport-height'
import { track } from '@/lib/analytics'
type Member = { id: string; name: string; role: string | null; color_key: string }

/* 같은 방 안의 두 층 (기획서 5.4). 방을 옮기는 게 아니라 탭이 바뀌는 것입니다 */
type Layer = 'stage' | 'backstage'

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

type Room = {
  id: string; gate_no: number | null; capacity: number | null
  title: string; title_ja: string | null; title_en: string | null
  situation: string | null; situation_ja: string | null; situation_en: string | null
}

/* 화면에 못 들어간 이유. 둘 다 나가는 버튼만 있는 한 장짜리 화면입니다 */
type Blocked = 'full' | 'missing' | null

export default function Stage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [blocked, setBlocked] = useState<Blocked>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  /* 무대와 백스테이지는 같은 방입니다 — 메시지를 한 번에 받아두고 보여줄 때 가릅니다.
     따로 불러오면 탭을 옮길 때마다 화면이 비었다가 채워집니다 */
  const [layer, setLayer] = useState<Layer>('stage')
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  /* 「지금 맨 아래를 보고 있나」 — 상태가 아니라 ref 입니다.
     스크롤할 때마다 다시 그리면 대화 중에 화면이 계속 깜빡입니다 */
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [hasNew, setHasNew] = useState(false)

  /* 키보드가 가리지 않게 (기획서 22.1) */
  const vh = useViewportHeight()
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
  const { hidden, hide, unhideAll } = useHidden()
  const [menuFor, setMenuFor] = useState<string | null>(null)      /* ⋯ 를 연 참가자 */
  const [reportFor, setReportFor] = useState<Msg | null>(null)
  const [reportNote, setReportNote] = useState('')

  /* 첨삭을 요청한 내 문장들. 새로고침해도 남아야 합니다 —
     안 그러면 다시 「고쳐주세요」로 보여서 또 누르게 됩니다 */
  const [asked, setAsked] = useState<string[]>([])

  /* 백스테이지를 마지막으로 본 시각 (방별).
     로그인이 없어서 푸시도 메일도 못 씁니다 — 다시 들어왔을 때 점으로 알리는 게 최선입니다.
     첨삭 답변만이 아니라 백스테이지 대화 전체에 필요합니다.

     보고 있는 **동안에는** 이 값이 화면에 쓰이지 않습니다 — 점은 무대 탭에만 뜨니까요.
     그래서 상태는 백스테이지를 **떠날 때** 한 번만 바꾸고, 저장소만 계속 갱신합니다 */
  const [seenAt, setSeenAt] = useState<string | null>(null)

  const loadMembers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('participants')
      .select('id, name, role, color_key')
      .eq('room_id', roomId)
      .order('joined_at')
    setMembers((data as Member[]) ?? [])
  }, [])

  /* 무대에서 빨간 줄을 긋지 않습니다 — 요청한 문장만 받습니다 (기획서 5.4 · 15.9) */
  async function askFix(m: Msg) {
    if (!room || !participantId) return
    setAsked((prev) => [...prev, m.id])          /* 눌린 티가 바로 나야 합니다 */

    const { error } = await supabase.from('corrections').insert({
      room_id: room.id,
      message_id: m.id,
      requester_id: participantId,
      body: m.body,                               /* 메시지가 지워져도 원문은 남습니다 */
    })

    /* 이미 넣은 문장이면 성공으로 봅니다 (같은 문장을 두 번 눌렀을 뿐) */
    if (error && !isErr(error, ERR.duplicate)) {
      /* ⚠️ 신고와 다릅니다. 신고는 실패해도 같은 문구를 보여줍니다 — 티가 나면 안 되니까요.
         첨삭은 **답을 기다리는** 기능이라 실패를 숨기면 오지 않는 답을 기다리게 됩니다 */
      setAsked((prev) => prev.filter((id) => id !== m.id))
      setReportNote(t.fixFailed)
      setTimeout(() => setReportNote(''), 4000)
      console.error('첨삭 요청 실패:', error)
      return
    }

    writeJson(KEYS.asked, Array.from(new Set([...readJson<string[]>(KEYS.asked, []), m.id])))
    track('correction_requested', { lang })
  }

  function noteAndClose(note: string) {
    setReportFor(null)
    setReportNote(note)
    setTimeout(() => setReportNote(''), 4000)
  }

  useAfterMount(() => setAsked(readJson<string[]>(KEYS.asked, [])))

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
      if (roomError || !r) {
        /* 없는 주소·네트워크 끊김. 여기서 안 잡으면 「…」 화면에 갇힙니다 */
        if (!cancelled) setBlocked('missing')
        return
      }
      if (cancelled) return
      setRoom(r)
      setSeenAt(readJson<Record<string, string>>(KEYS.seen, {})[r.id] ?? null)

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
        if (isErr(joinError, ERR.gateFull)) { setBlocked('full'); return }
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
            setMessages((prev) => {
              /* 내가 방금 낙관적으로 그려둔 그 문장이면 **진짜 행으로 갈아끼웁니다.**
                 그냥 두면 화면은 맞게 보이지만 id 가 브라우저에서 만든 값 그대로라,
                 그 id 로 첨삭을 넣는 순간 DB 에 없는 메시지라며 거절당합니다
                 (corrections.message_id 가 messages 를 참조합니다) */
              const i = prev.findIndex(
                (m) => m.client_msg_id && m.client_msg_id === incoming.client_msg_id
              )
              if (i === -1) return [...prev, incoming]
              const next = [...prev]
              next[i] = incoming
              return next
            })
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

  /* 맨 아래에 있을 때만 따라 내려갑니다. 위쪽 대화를 읽는 중에 새 글이 오면
     화면을 뺏지 않고 [새 메시지 ↓] 만 띄웁니다 (기획서 5.12 ③)

     ⚠️ 스르륵(`behavior: 'smooth'`)은 쓰지 않습니다. 새 글마다 화면이 미끄러지면
        읽는 눈이 계속 따라다녀야 하고, 무엇보다 **중간에 끊기면 안 내려갑니다** —
        다른 코드가 스크롤을 한 번만 건드려도 애니메이션이 취소됩니다.
        조용히 실패하는 쪽이라 눈치채기도 어렵습니다 */
  const toBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView()
    atBottomRef.current = true
    setHasNew(false)
  }, [])

  /* 탭을 옮겼을 때도 같이 처리합니다 — 두 층은 대화가 따로 흐르니
     옮겨간 층의 맨 아래에서 시작해야 합니다 (이때는 스르륵 없이 바로) */
  const shownLayer = useRef(layer)

  useEffect(() => {
    const layerChanged = shownLayer.current !== layer
    shownLayer.current = layer
    if (layerChanged || atBottomRef.current) toBottom()
    else setHasNew(true)
  }, [messages, layer, toBottom])

  /* 백스테이지를 보고 있는 동안에는 계속 「봤음」으로 저장해 둡니다.
     **저장소만 건드립니다** — 화면 상태는 탭을 떠날 때 한 번만 바꾸면 됩니다 (아래 탭 버튼).
     effect 가 할 일은 원래 이런 것(바깥 세계와 맞추기)입니다 */
  useEffect(() => {
    if (layer !== 'backstage' || !room) return
    const all = readJson<Record<string, string>>(KEYS.seen, {})
    writeJson(KEYS.seen, { ...all, [room.id]: new Date().toISOString() })
  }, [layer, room, messages])

  async function send(raw?: string) {
    const body = (raw ?? text).trim()
    if (!body || !room || !participantId) return
    const clientMsgId = crypto.randomUUID()
    const me = loadMe()!
    if (raw === undefined) setText('')
    /* 내가 보낸 것은 위를 읽던 중이라도 따라 내려갑니다 */
    atBottomRef.current = true

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

    /* participant_id 를 넘기지 않습니다 — 이 방에서의 내 id 는 서버가 client_id 로 찾습니다.
       브라우저가 지목할 수 있으면 남의 이름·색으로 글을 넣을 수 있습니다
       (20260901120000_send_message_rpc.sql) */
    const { data: saved, error } = await supabase.rpc('send_message', {
      p_room_id: room.id,
      p_client_id: me.clientId,
      p_layer: layer,
      p_body: body,
      p_client_msg_id: clientMsgId,
    })
    if (error) {
      console.error('메시지 전송 실패:', error)
      return
    }
    /* 돌아온 진짜 id 로 곧바로 갈아끼웁니다. Realtime 도 같은 일을 하지만,
       그쪽이 늦거나 끊긴 사이에 「고쳐주세요」를 누르면 없는 id 로 첨삭이 거절됩니다 */
    if (saved) {
      setMessages((prev) =>
        prev.map((m) => (m.id === clientMsgId ? { ...m, id: saved as string } : m))
      )
    }
  }

  /* 두 층을 한 번에 받아두고 여기서 가릅니다. 숨긴 사람도 여기서 빠집니다 */
  const shown = messages.filter(
    (m) => m.layer === layer && !(m.participant_id && hidden.includes(m.participant_id))
  )

  if (blocked) {
    return (
      <main style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <p style={{ fontSize: 15, margin: '40px 0 20px', textAlign: 'center' }}>
          {blocked === 'full' ? t.full : t.notFound}
        </p>
        <button onClick={() => router.push('/lounge')} style={{ ...ctaBtn, width: '100%' }}>
          {t.back}
        </button>
      </main>
    )
  }

  if (!room) return <main style={{ padding: 24 }}>...</main>

  /* 버튼은 **내가 방금 보낸 한 문장에만** 붙입니다.
     모든 말풍선에 달면 롤플레이 화면이 학습 도구처럼 보이고, ⋯ 안에 숨기면 아무도 못 찾습니다 */
  const lastMine = [...shown].reverse().find((m) => m.participant_id === participantId)

  /* 내가 쓴 글로 점이 뜨면 이상합니다 — 남이 쓴 것만 셉니다 */
  const backstageNew =
    layer !== 'backstage' &&
    messages.some(
      (m) =>
        m.layer === 'backstage' &&
        m.participant_id !== participantId &&
        (!seenAt || m.created_at > seenAt)
    )

  const roomTitle = field(room, 'title', lang)
  const roomSituation = field(room, 'situation', lang)

  return (
    <main style={{
      width: '100%', maxWidth: 480, margin: '0 auto',
      /* 아이폰에서 키보드가 올라오면 100dvh 는 그대로인데 보이는 화면만 줄어듭니다 —
         입력창이 키보드 뒤로 숨습니다. 실제로 보이는 높이를 그대로 씁니다 */
      height: vh ? `${vh}px` : '100dvh',
      display: 'flex', flexDirection: 'column',
    }}>
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
          <button
            key={l}
            onClick={() => {
              /* 백스테이지에서 나오는 순간 「여기까지 봤다」로 잠급니다 */
              if (layer === 'backstage' && l !== 'backstage') setSeenAt(new Date().toISOString())
              setLayer(l)
            }}
            aria-pressed={layer === l}
            style={tab(layer === l)}
          >
            {l === 'stage' ? t.tabStage : t.tabBackstage}
            {l === 'backstage' && backstageNew && <i aria-hidden style={newDotStyle} />}
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

      {/* [새 메시지 ↓] 가 설 자리입니다. 스크롤되는 상자 **안**에 넣으면
          버튼이 글을 따라 같이 올라가 버립니다 */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current
          if (!el) return
          /* 딱 맞아떨어지는 일이 드물어서 몇 px 여유를 둡니다 */
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
          if (atBottomRef.current) setHasNew(false)
        }}
        style={{ flex: 1, overflowY: 'auto', padding: 16, background: layer === 'backstage' ? BACKSTAGE_BG : 'var(--color-surface-sub)' }}
      >
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

              {lastMine?.id === m.id && (
                asked.includes(m.id) ? (
                  <span style={fixDoneStyle}>✏️ {t.fixAsked} · {t.fixNote}</span>
                ) : (
                  <button onClick={() => askFix(m)} style={fixStyle}>✏️ {t.fixThis}</button>
                )
              )}

              {menuFor === m.participant_id && !mine && (
                <div style={menuStyle}>
                  <button onClick={() => { hide(m.participant_id!); setMenuFor(null) }} style={menuItemStyle}>{t.hide}</button>
                  <button onClick={() => { setMenuFor(null); setReportFor(m) }} style={menuItemStyle}>{t.report}</button>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

        {hasNew && (
          <button onClick={() => toBottom()} style={newMsgStyle}>{t.newMessages} ↓</button>
        )}
      </div>

      {reportFor && room && (
        <ReportSheet
          lang={lang}
          roomId={room.id}
          messageId={reportFor.id}
          reporterId={participantId}
          targetId={reportFor.participant_id}
          onClose={() => setReportFor(null)}
          onDone={noteAndClose}
        />
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

/* 안 본 백스테이지 글이 있다는 표시. 숫자를 세지 않습니다 — 몇 개인지보다 있는지가 중요합니다 */
const newDotStyle: CSSProperties = {
  display: 'inline-block', width: 6, height: 6, borderRadius: 999,
  background: 'var(--color-primary-strong)', marginLeft: 5, verticalAlign: 'middle',
}

/* 말풍선 아래 작은 링크. 주 동작(대화)과 경쟁하면 안 됩니다 */
const fixStyle: CSSProperties = {
  ...linkBtn, marginTop: 5, fontSize: 11.5,
}
const fixDoneStyle: CSSProperties = {
  marginTop: 5, fontSize: 11.5, color: 'var(--color-text-sub)',
}

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

/* 위를 읽는 사람을 끌어내리지 않습니다 — 내려갈지는 본인이 정합니다 (기획서 5.12 ③) */
const newMsgStyle: CSSProperties = {
  position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)',
  padding: '8px 16px', borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-primary)', background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
  boxShadow: '0 2px 8px rgba(43, 34, 38, .12)', cursor: 'pointer', whiteSpace: 'nowrap',
}

const sendStyle: CSSProperties = {
  padding: '0 18px', borderRadius: 'var(--radius-full)', border: 'none',
  background: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer',
}
