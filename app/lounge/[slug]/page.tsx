'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { dict, field } from '@/lib/i18n'
import { useLang } from '@/lib/use-lang'
import { useHidden } from '@/lib/use-hidden'
import { loadMe } from '@/lib/me'
import { KEYS, readJson, writeJson, writeText } from '@/lib/storage'
import { ERR, isErr } from '@/lib/errors'
import LangToggle from '@/components/LangToggle'
import ReportSheet from '@/components/ReportSheet'
import BackstageIntro from './BackstageIntro'
import AskPicker from './AskPicker'
import { dot, tab, ctaBtn, linkBtn } from '@/lib/ui'
import { useViewportHeight } from '@/lib/use-viewport-height'
import { track } from '@/lib/analytics'
import {
  slowStyle,
  starterWrapStyle,
  starterLeadStyle,
  starterChipStyle,
  BACKSTAGE_BG,
  askLineStyle,
  askMineStyle,
  askQuoteStyle,
  backStyle,
  backstageLeadStyle,
  bubbleFor,
  hiddenBarStyle,
  memberListStyle,
  memberRowStyle,
  membersBtnStyle,
  menuItemStyle,
  menuStyle,
  moreStyle,
  newDotStyle,
  newMsgStyle,
  noteStyle,
  sendStyle,
  tabBarStyle,
  youTagStyle,
} from './styles'
type Member = { id: string; name: string; role: string | null; color_key: string }

/* 같은 방 안의 두 층 (기획서 5.4). 방을 옮기는 게 아니라 탭이 바뀌는 것입니다 */
type Layer = 'stage' | 'backstage'

type Msg = {
  id: string
  layer: Layer
  /* 'ask' 는 「이 표현 자연스러운가요?」입니다. body 에는 **물어본 문장만** 들어 있고,
     질문 줄은 화면이 보는 사람 언어로 그립니다 (20260903000000_ask_messages.sql) */
  kind: string | null
  body: string
  client_msg_id: string | null
  created_at: string
  participant_id: string | null
  participants: { name: string; color_key: string; role: string | null } | null
}

const SELECT = 'id, layer, kind, body, client_msg_id, created_at, participant_id, participants(name, color_key, role)'

type Room = {
  id: string; gate_no: number | null; capacity: number | null; situation_key: string | null
  title: string; title_ja: string | null; title_en: string | null
  situation: string | null; situation_ja: string | null; situation_en: string | null
}

/* 화면에 못 들어간 이유. 둘 다 나가는 버튼만 있는 한 장짜리 화면입니다 */
type Blocked = 'full' | 'missing' | null

/* 들어온 글을 화면 목록에 합칩니다. 실시간과 폴링이 **같은 규칙**을 써야 합니다.

   · 내가 방금 낙관적으로 그려둔 문장이면 진짜 행으로 갈아끼웁니다. 그냥 두면
     화면은 맞게 보이지만 id 가 브라우저에서 만든 값이라, 그 id 로 첨삭을 넣는
     순간 DB 에 없는 메시지라며 거절당합니다 (corrections.message_id 가 참조)
   · 이미 있는 id 는 버립니다. 폴링과 실시간이 같은 글을 둘 다 가져올 수 있습니다 */
function merge(prev: Msg[], incoming: Msg[]): Msg[] {
  let next = prev
  for (const m of incoming) {
    if (next.some((x) => x.id === m.id)) continue
    const i = next.findIndex((x) => x.client_msg_id && x.client_msg_id === m.client_msg_id)
    if (i === -1) next = [...next, m]
    else { next = [...next]; next[i] = m }
  }
  return next
}

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

  /* 실시간이 붙어 있나. 무료 등급은 **동시 Realtime 연결이 200개 선**이라
     사람이 몰리면 여기서 먼저 막힙니다 (부록 E.8 · 5.14).

     그때도 방은 열려 있습니다 — 입장·지난 대화·글 보내기는 전부 REST 라
     한도에 안 걸립니다. 못 하는 건 **남의 새 글을 바로 받는 것** 하나뿐이라,
     실시간이 안 붙으면 10초마다 가져오는 쪽으로 떨어집니다.
     조용히 멈추면 「아무도 말을 안 하네」로 읽고 나갑니다 */
  /* 'on' 실시간 정상 · 'busy' 실시간은 막혔지만 REST 는 됨 (서버가 붐빔)
     · 'offline' 둘 다 안 됨 (이 사람 인터넷 문제)

     ⚠️ 둘을 구분하지 않으면 「지금 라운지가 붐벼요」가 지하철에서도 뜹니다.
        사실이 아닌 데다 **기대를 부풀립니다** — 사람 많대서 들어왔는데
        방이 조용하면 두 번 실망합니다. REST 가 되는지로 가릅니다 */
  const [live, setLive] = useState<'on' | 'busy' | 'offline'>('on')
  const messagesRef = useRef<Msg[]>([])
  const liveGuard = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  /* 화면 위쪽에 잠깐 뜨는 한 줄. **신고 전용이 아닙니다** —
     물어보기 실패도 여기로 옵니다. 이름을 reportNote 로 두면 나중에
     신고 문구를 고치다가 물어보기 화면이 깨집니다 */
  const [note, setNote] = useState('')

  /* 물어볼 문장 고르기.

     진입점은 **탭 줄 오른쪽 하나뿐**입니다. 말풍선마다 링크를 달면 롤플레이 화면이
     학습 도구가 되고(5.15), 마지막 문장에만 달면 아까 쓴 것에는 못 묻습니다.
     고정된 자리 하나면 둘 다 풀립니다 — 무대에는 학습 UI가 하나도 안 남습니다.

     ⚠️ 3개까지입니다. 다섯 개를 한꺼번에 던지면 답하는 사람이 숙제를 받습니다 —
        자원봉사자는 미루고, 미루면 답이 안 옵니다. 이 방은 묻는 비용만큼
        **답하는 비용**이 중요합니다 */
  const [askOpen, setAskOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const ASK_MAX = 3


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

  function openAsk() {
    /* 방금 쓴 것을 미리 골라둡니다 — 대부분은 「방금 그거」를 묻습니다 */
    setPicked(myLines.length ? [myLines[0].id] : [])
    setAskOpen(true)
    setLayer('backstage')
  }

  function togglePick(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
      : prev.length >= ASK_MAX ? prev
      : [...prev, id]
    )
  }

  /* 물어보기 — 백스테이지에 **대화로** 올립니다. 답하는 쪽에는 아무 UI도 만들지 않습니다.
     그냥 답장이면 되니까요 */
  async function sendAsk() {
    if (!room || !participantId || picked.length === 0) return

    /* 고른 순서가 아니라 **말한 순서**로 보냅니다 — 대화 흐름대로 읽혀야 합니다 */
    const chosen = messages.filter((m) => picked.includes(m.id))
    setAskOpen(false)

    const ok = await send(chosen.map((m) => m.body).join('\n'), 'ask')
    if (!ok) {
      /* ⚠️ 조용히 실패하면 답을 기다리게 됩니다. 고른 것도 그대로 둡니다 */
      setAskOpen(true)
      showNote(t.askFailed)
      return
    }

    /* 대화와 **별개로** 문장마다 한 줄 남깁니다 — 「누가 뭘 물었나」가 강좌(26장)의
       커리큘럼이자 나중 AI 1차 첨삭의 재료입니다. 여기서 실패해도 알리지 않습니다:
       물어본 것은 이미 백스테이지에 올라가 있고, 답은 거기서 옵니다 */
    for (const m of chosen) {
      const { error } = await supabase.from('corrections').insert({
        room_id: room.id,
        message_id: m.id,
        requester_id: participantId,
        body: m.body,
      })
      if (error && !isErr(error, ERR.duplicate)) console.error('첨삭 기록 실패:', error)
    }

    setPicked([])
    track('correction_requested', { lang, count: chosen.length })
  }

  /* 잠깐 떴다 사라지는 안내. 이름이 note 와 겹치면 안 됩니다 —
     바깥 상태를 가려서 읽는 사람이 어느 쪽인지 헷갈립니다 */
  function showNote(msg: string) {
    setNote(msg)
    setTimeout(() => setNote(''), 4000)
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
        .select('id, gate_no, capacity, situation_key, title, title_ja, title_en, situation, situation_ja, situation_en')
        .eq('slug', slug).single()
      if (roomError || !r) {
        /* 없는 주소·네트워크 끊김. 여기서 안 잡으면 「…」 화면에 갇힙니다 */
        if (!cancelled) setBlocked('missing')
        return
      }
      if (cancelled) return
      setRoom(r)
      setSeenAt(readJson<Record<string, string>>(KEYS.seen, {})[r.id] ?? null)
      /* 나중에 입장 화면에서 건의할 때 「어디서 겪은 불편인가」로 실립니다.
         입장 화면이 아니라 여기서 씁니다 — 링크로 바로 들어온 사람도 잡혀야 합니다 */
      writeText(KEYS.lastRoom, slug)

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

      /* ⚠️ 감시 타이머를 **먼저** 겁니다. 소켓을 못 열면 subscribe() 가 그 자리에서
         예외를 던져서, 뒤에 두면 이 줄이 아예 실행되지 않습니다.

         그리고 상태 콜백만 믿으면 안 됩니다 — 소켓이 안 열리면 콜백이 **아예 안 옵니다.**
         supabase 가 조용히 재시도만 합니다. 그게 정확히 한도가 찼을 때의 모습이라
         「연결됐다는 말이 안 들리면 안 된 것으로」 봅니다.
         8초는 붙을 때 1초도 안 걸리는 것을 넉넉히 기다려 준 값입니다 */
      liveGuard.current = setTimeout(() => { if (!cancelled) setLive('busy') }, 8000)

      /* 확인용 스위치. 주소에 ?nolive=1 을 붙이면 실시간을 아예 안 붙이고
         가져오기로만 돕니다 — 한도가 찼을 때의 화면을 사람이 눈으로 볼 방법이
         달리 없습니다. 실제로 한도에 걸린 상태를 만들어 볼 수는 없으니까요 */
      if (/[?&]nolive=1/.test(window.location.search)) {
        setLive('busy')
        return
      }

      try {
        channel = supabase
          .channel('room:' + r.id + ':' + crypto.randomUUID())
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room_id=eq.' + r.id },
            async (payload) => {
              const { data } = await supabase
                .from('messages').select(SELECT).eq('id', payload.new.id).single()
              if (!data) return
              setMessages((prev) => merge(prev, [data as unknown as Msg]))
            }
          )
          .subscribe((status) => {
            if (cancelled) return
            if (status === 'SUBSCRIBED') {
              if (liveGuard.current) clearTimeout(liveGuard.current)
              setLive('on')
            } else {
              setLive('busy')
            }
          })
      } catch (e) {
        /* 소켓을 아예 못 여는 경우. 방은 이미 열려 있으니 폴링으로 갑니다 */
        console.error('실시간 연결 실패 — 가져오기로 바꿉니다:', e)
        if (!cancelled) setLive('busy')
      }
    }

    join()
    return () => {
      cancelled = true
      if (liveGuard.current) clearTimeout(liveGuard.current)
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

  /* 폴링이 「어디까지 받았나」를 알아야 합니다. 상태가 아니라 ref 라서 다시 그리지 않습니다 */
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    const layerChanged = shownLayer.current !== layer
    shownLayer.current = layer
    if (layerChanged || atBottomRef.current) toBottom()
    else setHasNew(true)
  }, [messages, layer, toBottom])

  /* 백스테이지를 보고 있는 동안에는 계속 「봤음」으로 저장해 둡니다.
     **저장소만 건드립니다** — 화면 상태는 탭을 떠날 때 한 번만 바꾸면 됩니다 (아래 탭 버튼).
     effect 가 할 일은 원래 이런 것(바깥 세계와 맞추기)입니다 */
  /* 실시간이 끊긴 동안 10초마다 가져옵니다. REST 는 동시 연결 한도가 없어서
     실시간이 막혀도 대화는 이어집니다 — 조금 늦게 뜰 뿐입니다.

     마지막으로 받은 시각 뒤엣것만 가져옵니다. 통째로 다시 받으면 방이 길어질수록
     10초마다 그만큼을 계속 내려받게 됩니다 */
  useEffect(() => {
    if (live === 'on' || !room) return
    let stopped = false

    async function tick() {
      const last = messagesRef.current.reduce((a, m) => (m.created_at > a ? m.created_at : a), '')
      let q = supabase.from('messages').select(SELECT).eq('room_id', room!.id).order('created_at')
      if (last) q = q.gt('created_at', last)
      const { data, error } = await q
      if (stopped) return
      /* 가져오기까지 안 되면 서버가 붐비는 게 아니라 이 사람 인터넷이 끊긴 겁니다 */
      setLive(error ? 'offline' : 'busy')
      if (data?.length) setMessages((prev) => merge(prev, data as unknown as Msg[]))
    }

    tick()                                   /* 10초를 기다리지 않고 바로 한 번 */
    const id = setInterval(tick, 10000)
    return () => { stopped = true; clearInterval(id) }
  }, [live, room])

  useEffect(() => {
    if (layer !== 'backstage' || !room) return
    const all = readJson<Record<string, string>>(KEYS.seen, {})
    writeJson(KEYS.seen, { ...all, [room.id]: new Date().toISOString() })
  }, [layer, room, messages])

  /* 보냈는지를 돌려줍니다 — 물어보기는 실패하면 카드를 돌려놔야 합니다 */
  async function send(raw?: string, kind: 'line' | 'ask' = 'line'): Promise<boolean> {
    const body = (raw ?? text).trim()
    if (!body || !room || !participantId) return false
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
        kind,
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
      p_kind: kind,
    })
    if (error) {
      console.error('메시지 전송 실패:', error)
      setMessages((prev) => prev.filter((m) => m.id !== clientMsgId))   /* 안 간 말풍선을 남기지 않습니다 */
      return false
    }
    /* 돌아온 진짜 id 로 곧바로 갈아끼웁니다. Realtime 도 같은 일을 하지만,
       그쪽이 늦거나 끊긴 사이에 「고쳐주세요」를 누르면 없는 id 로 첨삭이 거절됩니다 */
    if (saved) {
      setMessages((prev) =>
        prev.map((m) => (m.id === clientMsgId ? { ...m, id: saved as string } : m))
      )
    }
    return true
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

  /* 물어볼 수 있는 것 — **무대에서 내가 쓴 문장만**, 최근 것이 위로.
     'ask' 자신은 뺍니다. 물어본 것을 다시 물어볼 이유가 없습니다 */
  const myLines = messages
    .filter((m) => m.layer === 'stage' && m.participant_id === participantId && m.kind !== 'ask')
    .slice().reverse()

  /* 내가 쓴 글로 점이 뜨면 이상합니다 — 남이 쓴 것만 셉니다 */
  const backstageNew =
    layer !== 'backstage' &&
    messages.some(
      (m) =>
        m.layer === 'backstage' &&
        m.participant_id !== participantId &&
        (!seenAt || m.created_at > seenAt)
    )

  /* 방 슬러그가 아니라 **상황**으로 찾습니다. 같은 상황의 2번 게이트에도 같은 칩이 떠야 합니다.
     situation_key 는 `showtime` 처럼 오는데 방 슬러그는 `showtime-1` 입니다 */
  const starterMap = dict(lang).starters as Record<string, string[]>
  const starters = starterMap[(room.situation_key ?? '').replace(/-\d+$/, '')] ?? []

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
      <header style={{ background: 'var(--color-header)', padding: '14px 16px' }}>
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

        {/* 쓴 게 없으면 안 보여줍니다 — 누를 게 없는 버튼은 없느니만 못합니다 */}
        {myLines.length > 0 && (
          <button onClick={openAsk} style={askMineStyle}>💬 {t.askMine}</button>
        )}
      </div>
      {layer === 'backstage' && <p style={backstageLeadStyle}>{t.backstageLead}</p>}

      {hidden.length > 0 && (
        <div style={hiddenBarStyle}>
          <span>{t.hidden}</span>
          <button onClick={unhideAll} style={linkBtn}>{t.unhide}</button>
        </div>
      )}
      {/* 아무 말 없이 멈춘 것보다 낫습니다. 대화는 계속 되지만 조금 늦게 뜹니다 */}
      {live !== 'on' && (
        <p style={slowStyle}>{live === 'offline' ? t.liveOffline : t.liveBusy}</p>
      )}
      {note && <p style={noteStyle}>{note}</p>}

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
        {/* 빈 방의 어색함을 없애는 장치입니다 (기획서 5.7 · 22.1).
            「무슨 말을 하지?」가 남아 있으면 들어와도 그냥 나갑니다.

            ⚠️ 상황마다 다른 말이어야 합니다. 「안녕하세요」 같은 공용 문구를 띄우면
               상황이 있는 방(3.6)의 값이 사라집니다.
            ⚠️ 운영자가 상황을 새로 열면 그 방에는 칩이 없습니다. 그때는 예전처럼
               안내 한 줄만 뜹니다 — 없는 채로 두는 게 엉뚱한 말을 띄우는 것보다 낫습니다 */}
        {shown.length === 0 && layer === 'stage' && (
          starters.length > 0 ? (
            <div style={starterWrapStyle}>
              <p style={starterLeadStyle}>{t.starterLead}</p>
              {starters.map((line) => (
                <button key={line} onClick={() => send(line)} style={starterChipStyle}>
                  {line}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-sub)', fontSize: 13, textAlign: 'center' }}>{t.empty}</p>
          )
        )}

        {shown.length === 0 && layer === 'backstage' && (
          <BackstageIntro t={t} onSend={send} />
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
              <div style={bubbleFor(layer, mine)}>
                {m.kind === 'ask' ? (
                  <>
                    {/* 물어본 문장들. 질문 줄은 **보는 사람 언어**로 그립니다 —
                        일본어로 물어도 한국인 화면에는 한국어로 보여야 답이 옵니다 */}
                    {m.body.split('\n').map((line, i) => (
                      <span key={i} style={askQuoteStyle}>「{line}」</span>
                    ))}
                    <span style={askLineStyle}>{t.askQ1}<br />{t.askQ2}</span>
                  </>
                ) : m.body}
              </div>

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
          onDone={(msg) => { setReportFor(null); showNote(msg) }}
        />
      )}

      {/* 스크롤 영역 밖(입력창 바로 위)에 둡니다 — 대화가 길면 위로 밀려 안 보입니다 */}
      {layer === 'backstage' && askOpen && (
        <AskPicker
          t={t}
          lines={myLines}
          picked={picked}
          max={ASK_MAX}
          onToggle={togglePick}
          onSend={sendAsk}
          onClose={() => setAskOpen(false)}
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
          style={{ flex: 1, padding: 12, borderRadius: 'var(--radius-full)', border: '1px solid var(--color-line)' }}
        />
        <button onClick={() => send()} style={sendStyle}>{t.send}</button>
      </div>
    </main>
  )
}
