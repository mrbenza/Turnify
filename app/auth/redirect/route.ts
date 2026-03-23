import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// GET /auth/redirect — legge il ruolo server-side e reindirizza
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('ruolo')
    .eq('id', user.id)
    .single()

  if (profile?.ruolo === 'admin' || profile?.ruolo === 'manager') {
    redirect('/admin')
  }

  redirect('/user')
}
