import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function UserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Dashboard dipendente — in costruzione</p>
    </div>
  )
}
