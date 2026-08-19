import { PaginaNovo } from '@/components/registro'

export const dynamic = 'force-dynamic'

export default async function Pagina({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  return PaginaNovo({ chave: 'transportadoras', searchParams })
}
