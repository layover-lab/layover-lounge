import { createClient } from '@supabase/supabase-js'

/* ─────────────────────────────────────────────────────────
   마스터 키 클라이언트 — **서버에서만** 씁니다 (부록 E.7)

   service_role 키는 RLS 를 통째로 무시합니다. 이 파일을 'use client' 파일에서
   import 하는 순간 키가 브라우저 번들에 실리고, 그때부터 누구나 모든 테이블을
   읽고 씁니다. **한 번 나간 키는 지울 수 없고 재발급해야 합니다.**

   ⚠️ 환경변수 이름에 `NEXT_PUBLIC_` 을 붙이지 마세요. 붙이는 순간 공개됩니다.
   ⚠️ import 하는 곳은 app/api/ 아래의 라우트 핸들러뿐이어야 합니다.
   ───────────────────────────────────────────────────────── */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 없음')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}
