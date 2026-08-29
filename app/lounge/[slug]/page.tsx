'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { pickLang, dict, type Lang } from '@/lib/i18n'
import LangToggle from '@/components/LangToggle'

const ME_KEY = 'layover.me'

type Me = { clientId: string; colorKey: string; name: string; role: string; avatar: string }
type Member = { id: string; name: string; role: string | null; color_key: string }
type Msg = {
  id: string
  body: string
  client_msg_id: string | null
  created_at: string
  participant_id: string | null
  participants: { name: string; color_key: string; role: string | null } | null
}

const SELECT = 'id, body, client_msg_id, created_at, participant_id, participants(name, color_key, role)'

export default function Stage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [room, setRoom] = useState<{ id: string; title: string; situation: string | null; capacity: number | null } | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [lang, setLang] = useState<Lang>('ja')
  const t = dict(lang).room

  /* 학생 피드백 2026-08-29 (트리파노소마) —
     "방 안에 몇 명이 있는지, 어떤 역할이 있는지 알기 어렵다.
      역할극이 목적인 방인데 이런 정보를 아는 게 중요한 것 같다"

     ⚠️ 「지금 접속 중」이 아니라 「이 방에 들어온 사람」입니다.
        접속 여부는 Realtime presence 가 있어야 알 수 있는데,
        그건 동시 연결을 더 먹어서 지금은 안 씁니다 (5.14 와 같은 이유). */
  const [members, setMembers] = useState<Member[]>([])
  const [showMembers, setShowMembers] = useState(false)

  const loadMembers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('participants')
      .select('id, name, role, color_key')
      .eq('room_id', roomId)
      .order('joined_at')
    setMembers((data as Member[]) ?? [])
  }, [])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const picked = pickLang()
    setLang(picked)
    document.documentElement.lang = picked

    async function join() {
      const saved = localStorage.getItem(ME_KEY)
      if (!saved) {
        router.push('/lounge')
        return
      }
      const me: Me = JSON.parse(saved)

      const { data: r, error: roomError } = await supabase
        .from('rooms').select('id, title, situation, capacity').eq('slug', slug).single()
      if (roomError) {
        console.error('방 조회 실패:', roomError)
        return
      }
      if (!r || cancelled) return
      setRoom(r)

      /* 이미 있는 행을 재사용만 하면 나갔다 들어와서 역할을 바꿔도 옛 이름이 남습니다.
         upsert 로 매번 이름·역할·색을 덮어씁니다 (학생 피드백 2026-08-26) */
      const { data: joined, error: joinError } = await supabase
        .from('participants')
        .upsert(
          {
            room_id: r.id,
            client_id: me.clientId,
            name: me.name,
            role: me.role || null,
            color_key: me.colorKey,
            avatar: me.avatar,
          },
          { onConflict: 'room_id,client_id' }
        )
        .select('id')
        .single()
      if (joinError) console.error('참가자 등록 실패:', joinError)
      const pid = joined?.id
      if (cancelled) return
      setParticipantId(pid ?? null)
      await loadMembers(r.id)

      const { data: rows } = await supabase
        .from('messages').select(SELECT)
        .eq('room_id', r.id).eq('layer', 'stage')
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
  }, [messages])

  async function send() {
    const body = text.trim()
    if (!body || !room || !participantId) return
    const clientMsgId = crypto.randomUUID()
    const me: Me = JSON.parse(localStorage.getItem(ME_KEY)!)
    setText('')

    setMessages((prev) => [
      ...prev,
      {
        id: clientMsgId,
        body,
        client_msg_id: clientMsgId,
        created_at: new Date().toISOString(),
        participant_id: participantId,
        participants: { name: me.name, color_key: me.colorKey, role: me.role || null },
      },
    ])

    const { error } = await supabase.from('messages').insert({
      room_id: room.id,
      layer: 'stage',
      participant_id: participantId,
      body,
      client_msg_id: clientMsgId,
    })
    if (error) console.error('메시지 전송 실패:', error)
  }

  if (!room) return <main style={{ padding: 24 }}>...</main>

  return (
    <main style={{ width: '100%', maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#FDE3EE', padding: '14px 16px' }}>
        {/* 오른쪽 위는 👥 가 쓰고 있어서 나가기 줄에 둡니다 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <button onClick={() => router.push('/lounge')} style={backStyle}>← {t.back}</button>
          <LangToggle lang={lang} onChange={setLang} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>{room.title}</div>
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
          📌 {room.situation}
        </div>

        {showMembers && (
          <ul style={memberListStyle}>
            {members.length === 0 && (
              <li style={{ fontSize: 13, color: 'var(--color-text-sub)' }}>{t.membersEmpty}</li>
            )}
            {members.map((m) => (
              <li key={m.id} style={memberRowStyle}>
                <i style={{
                  width: 8, height: 8, borderRadius: 999, flex: 'none',
                  background: `var(--role-${m.color_key})`,
                }} />
                {m.role && <span style={{ color: 'var(--color-text-sub)' }}>{m.role}</span>}
                <strong>{m.name}</strong>
                {m.id === participantId && <span style={youTagStyle}>{t.you}</span>}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--color-surface-sub)' }}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--color-text-sub)', fontSize: 13, textAlign: 'center' }}>{t.empty}</p>
        )}
        {messages.map((m) => {
          /* 내가 친 것과 남이 친 것을 한눈에 가릅니다 (학생 피드백 2026-08-28) */
          const mine = !!participantId && m.participant_id === participantId
          return (
            <div key={m.id} style={{
              marginBottom: 14, display: 'flex', flexDirection: 'column',
              alignItems: mine ? 'flex-end' : 'flex-start',
            }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                  background: 'var(--role-' + (m.participants?.color_key ?? 'pink') + ')',
                  marginRight: 6,
                }} />
                {m.participants?.role && (
                  <span style={{ color: 'var(--color-text-sub)', marginRight: 4 }}>
                    {m.participants.role}
                  </span>
                )}
                <strong>{m.participants?.name}</strong>
              </div>
              <div style={mine ? myBubbleStyle : bubbleStyle}>{m.body}</div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

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
        <button onClick={send} style={sendStyle}>{t.send}</button>
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
