import { PaginaEditar } from '@/components/registro'

export const dynamic = 'force-dynamic'

export default async function Pagina(
  { params, searchParams }: { params: { id: string }; searchParams: { [k: string]: string | undefined } }
) {
  return PaginaEditar({ chave: 'materiais', id: params.id, searchParams })
}
