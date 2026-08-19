import Link from 'next/link'
import { contar, um } from '@/lib/db'
import { numero } from '@/lib/formato'
import { IconeSeta, IconeEscudo, IconeUsuario, IconeCotacao, IconeFabrica, IconeArquitetura, IconeBanco } from '@/components/icones'

export const dynamic = 'force-dynamic'

const PERFIS = [
  {
    perfil: 'admin_central',
    titulo: 'Administrador da plataforma',
    resumo: 'Opera o SaaS: todas as empresas, parâmetros globais, conectores de ERP e trilha de auditoria.',
    acessos: ['Alterna entre as 8 empresas', 'Parâmetros de disparo e equalização', 'Integrações e auditoria'],
    destino: '/painel',
  },
  {
    perfil: 'gestor',
    titulo: 'Gestor de suprimentos',
    resumo: 'Enxerga a operação inteira da sua empresa e responde pelos resultados de economia.',
    acessos: ['Painel de indicadores', 'Cotações e equalização', 'Auditoria da própria empresa'],
    destino: '/painel',
  },
  {
    perfil: 'comprador',
    titulo: 'Comprador',
    resumo: 'Executa o dia a dia: monta cotações a partir das demandas e conduz a equalização.',
    acessos: ['Demandas e cotações', 'Consulta de cadastros', 'Sem acesso a parâmetros'],
    destino: '/painel',
  },
  {
    perfil: 'fornecedor',
    titulo: 'Fornecedor',
    resumo: 'Portal externo: recebe o convite, consulta a cotação e envia a proposta sem acessar o sistema interno.',
    acessos: ['Somente as próprias cotações', 'Envio de proposta', 'Isolado da base interna'],
    destino: '/portal',
    externo: true,
  },
]

const ICONES_PERFIL: Record<string, JSX.Element> = {
  admin_central: <IconeEscudo size={15} />,
  gestor: <IconeArquitetura size={15} />,
  comprador: <IconeCotacao size={15} />,
  fornecedor: <IconeFabrica size={15} />,
}

export default async function Entrada() {
  const materiais = await contar('select count(*) c from materiais')
  const fornecedores = await contar('select count(*) c from fornecedores')
  const clientes = await contar('select count(*) c from clientes')
  const transportadoras = await contar('select count(*) c from transportadoras')
  const empresas = await contar('select count(*) c from empresas')
  const compradores = await contar("select count(*) c from usuarios where perfil='comprador'")
  const cotacoes = await contar('select count(*) c from cotacoes')
  const propostas = await contar('select count(*) c from proposta_itens')
  const classes = await contar('select count(*) c from classificacoes')
  const cotacaoDestaque = await um<{ id: number }>(
    "select id from cotacoes where status='equalizada' order by id limit 1")

  const numeros = [
    ['Materiais cadastrados', materiais],
    ['Fornecedores', fornecedores],
    ['Clientes', clientes],
    ['Transportadoras', transportadoras],
    ['Nós de classificação (5 níveis)', classes],
    ['Empresas na plataforma', empresas],
    ['Compradores ativos', compradores],
    ['Itens de proposta equalizados', propostas],
  ] as const

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-6 py-8 sm:py-10 lg:py-16">

        {/* ---------------------------------------------- cabecalho */}
        <header className="flex items-center justify-between mb-10 sm:mb-14">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded bg-ink-900 text-white grid place-items-center text-xs font-bold">S</span>
            <span className="text-sm font-semibold tracking-tight">SUPRA</span>
          </div>
          <Link href="/entrar" className="btn btn-primario btn-sm">
            <IconeUsuario size={14} />Entrar
          </Link>
        </header>

        {/* ---------------------------------------------- apresentacao */}
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-start mb-12 sm:mb-16">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-petrol-700 mb-4">
              Sistema demonstrativo funcional
            </p>
            <h1 className="text-[30px] sm:text-[38px] leading-[1.12] font-semibold tracking-tight text-ink-900">
              Plataforma de cotações corporativas, multiempresa.
            </h1>
            <p className="mt-5 text-md text-ink-600 leading-relaxed max-w-xl">
              Cadastros com volume real, demandas de compra, disparo programado de cotações,
              portal externo do fornecedor, equalização automática considerando frete, impostos,
              prazo de entrega e condição de pagamento, e integração bidirecional com ERPs.
            </p>
            <p className="mt-4 text-sm text-ink-500 max-w-xl">
              Não é maquete de tela: o sistema executa de verdade sobre{' '}
              <strong className="text-ink-700 font-medium">{numero(materiais)} materiais</strong> e{' '}
              <strong className="text-ink-700 font-medium">{numero(fornecedores)} fornecedores</strong>,
              com busca indexada, portal externo que grava proposta e equalização calculada em tempo de
              execução. Os dados são sintéticos, gerados para a demonstração.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link href="/entrar" className="btn btn-primario">
                Entrar na plataforma
                <IconeSeta size={15} />
              </Link>
              {cotacaoDestaque && (
                <Link href={`/entrar?voltar=/cotacoes/${cotacaoDestaque.id}/equalizacao`}
                      className="btn btn-secundario">
                  Ver uma equalização pronta
                </Link>
              )}
            </div>
          </div>

          {/* numeros da base */}
          <div className="painel">
            <div className="painel-titulo">
              <h2 className="text-sm font-semibold">Volume carregado na base</h2>
              <span className="text-2xs text-ink-500 texto-mono flex items-center gap-1.5"><IconeBanco size={13} />data/supra.db</span>
            </div>
            <dl className="divide-y divide-ink-100">
              {numeros.map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-center justify-between gap-4 px-4 sm:px-5 py-2.5">
                  <dt className="text-sm text-ink-600">{rotulo}</dt>
                  <dd className="text-sm font-semibold tabular text-ink-900">{numero(valor)}</dd>
                </div>
              ))}
            </dl>
            <div className="painel-rodape">
              <p className="text-xs text-ink-500">
                {numero(cotacoes)} cotações históricas com propostas recebidas e equalizadas.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------- perfis */}
        <section>
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <h2 className="text-sm font-semibold text-ink-900">Escolha o perfil de acesso</h2>
            <p className="text-xs text-ink-500">Quatro níveis, com permissões e telas distintas</p>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {PERFIS.map((p) => (
              <a key={p.perfil}
                 href={'externo' in p && p.externo ? p.destino : `/entrar?voltar=${p.destino}`}
                 className="painel p-4 sm:p-5 hover:border-ink-400 hover:shadow-subtle transition-all duration-100 group flex flex-col">
                <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                  <span className="text-ink-400">{ICONES_PERFIL[p.perfil]}</span>{p.titulo}
                </h3>
                <p className="text-sm text-ink-500 mt-2 leading-relaxed flex-1">{p.resumo}</p>
                <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-3">
                  {p.acessos.map((a) => (
                    <li key={a} className="text-xs text-ink-600 flex gap-2">
                      <span className="text-ink-300 mt-px">—</span>{a}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 text-xs font-medium text-ink-900 flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                  {'externo' in p && p.externo ? 'Abrir portal' : 'Entrar'} <IconeSeta size={13} />
                </span>
              </a>
            ))}
          </div>
        </section>

        <footer className="mt-12 sm:mt-16 pt-6 border-t border-ink-200 flex flex-wrap gap-x-6 gap-y-2 justify-between text-xs text-ink-500">
          <p>SUPRA · demonstração de capacidade técnica · dados sintéticos</p>
          <p>Next.js · React · SQLite com FTS5 · sem dependências externas em runtime</p>
        </footer>
      </div>
    </div>
  )
}
