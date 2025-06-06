import { redirect } from 'next/navigation'

export default function RootPage() {
  // This will redirect to our auth redirect handler
  redirect('/auth/redirect')
}