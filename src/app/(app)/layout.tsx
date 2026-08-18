import { Shell } from '@/components/Shell'
export const dynamic = 'force-dynamic'
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>
}
