import { contar } from '@/lib/db'
import { exigir } from '@/lib/acesso'
import { numero } from '@/lib/formato'
import { CabecalhoPagina, Tag } from '@/components/ui'
import { IconeArquitetura, IconeCaixa, IconeFabrica, IconeArvore, IconeCamada, IconePredio, IconeEscudo } from '@/components/icones'

export const dynamic = 'force-dynamic'

const BLOCOS = [
  {
    titulo: 'Arquitetura multiempresa (SaaS)',
    referencia: 'Levantamento 1.2 e 7.3',
    texto: `Uma única instância atende todas as empresas. Toda tabela transacional carrega empresa_id
      obrigatório, e nenhuma consulta da aplicação é emitida sem esse predicado — o isolamento é
      estrutural, não uma regra de tela. Cadastros de baixa sensibilidade (materiais, fornecedores,
      transportadoras) aceitam empresa_id nulo e formam um catálogo corporativo comum, evitando
      replicar o mesmo item cem mil vezes por empresa. Clientes nunca são compartilhados.`,
    itens: [
      ['Modelo', 'Instância única, banco único, isolamento por coluna de inquilino'],
      ['Catálogo', 'Compartilhado por padrão, exclusivo quando a empresa exige'],
      ['Contexto', 'Troca de empresa sem novo login para o administrador central'],
    ],
  },
  {
    titulo: 'Volume e desempenho',
    referencia: 'Levantamento 2.1 e 7.1',
    texto: `A base carregada contém os volumes reais informados. A busca de materiais usa índice
      full-text (FTS5) com casamento por prefixo, e não varredura com LIKE — por isso responde em
      poucos milissegundos mesmo sobre cem mil registros. Toda listagem é paginada no banco, nunca
      em memória, e os filtros hierárquicos aproveitam índices dedicados. O tempo real de cada
      consulta aparece no cabeçalho das telas de cadastro.`,
    itens: [
      ['Busca textual', 'Índice invertido FTS5, resposta abaixo de 5 ms em 100 mil itens'],
      ['Paginação', 'Sempre no banco, com contagem e recorte por índice'],
      ['Concorrência', 'Leituras não bloqueiam escritas (journal WAL)'],
    ],
  },
  {
    titulo: 'Classificação em cinco níveis',
    referencia: 'Levantamento 2.2',
    texto: `A hierarquia é uma árvore auto-referenciada — Grupo, Subgrupo, Família, Subfamília e
      Classe — percorrida por consulta recursiva. Acrescentar um sexto nível não exige alteração de
      schema. O caminho completo fica materializado em cada nó para permitir filtro por qualquer
      ramo sem recursão em tempo de consulta.`,
    itens: [
      ['Profundidade', '5 níveis hoje, sem limite estrutural'],
      ['Unidades de medida', 'Tabela própria, dezenas de unidades por grandeza'],
      ['Fornecimento', 'Fornecedor vinculado aos grupos que está apto a atender'],
    ],
  },
  {
    titulo: 'Disparo programado de cotações',
    referencia: 'Levantamento 5.2',
    texto: `As janelas de disparo são parâmetros do administrador: dias da semana, horário, canal e
      prazo de resposta. Um agendador lê essas janelas e enfileira as rodadas; o disparo manual
      permanece disponível para exceções. Cada envio gera registro com origem — automático ou
      manual —, destinatários, entregas e falhas, com reenvio para os endereços que falharam.`,
    itens: [
      ['Canais', 'E-mail e portal, isolados ou combinados'],
      ['Seleção', 'Fornecedores homologados dos grupos presentes na cotação'],
      ['Rastreio', 'Convite, visualização e resposta datados por fornecedor'],
    ],
  },
  {
    titulo: 'Portal externo do fornecedor',
    referencia: 'Levantamento 5.3',
    texto: `O fornecedor responde dentro do próprio sistema, por um endereço com token exclusivo do
      convite. Ele enxerga somente a cotação para a qual foi chamado — nunca a base interna, os
      concorrentes ou outras empresas. A proposta entra direto na equalização: ninguém do lado
      comprador redigita nada, que é justamente onde o processo por e-mail e planilha se perde.`,
    itens: [
      ['Acesso', 'Token por convite, sem cadastro prévio de senha'],
      ['Escopo', 'Estritamente a cotação convidada'],
      ['Retorno', 'Proposta gravada e equalizada na mesma operação'],
    ],
  },
  {
    titulo: 'Equalização automática',
    referencia: 'Levantamento 5.4 e 5.5',
    texto: `A apuração é integralmente automática e considera todas as variáveis pedidas. Para cada
      item de cada proposta o sistema calcula: preço bruto, desconto comercial, IPI e ICMS-ST, frete
      rateado por participação no valor (quando FOB), custo posto no destino, valor presente do
      pagamento a prazo pela taxa de capital da empresa, e penalidade por prazo de entrega. Sobre
      esse custo comparável apura-se o menor preço global por fornecedor e o menor preço por item.`,
    itens: [
      ['Menor preço global', 'Somente propostas que cobrem 100% dos itens disputam'],
      ['Menor preço por item', 'Todas as propostas competem, inclusive as parciais'],
      ['Transparência', 'Memória de cálculo em sete etapas, item a item'],
      ['Reprodutibilidade', 'Parâmetros congelados na cotação — rodada antiga recalcula igual'],
    ],
  },
  {
    titulo: 'Integração bidirecional com ERPs',
    referencia: 'Levantamento 3.1 a 3.3 e 6.1',
    texto: `A camada de integração é agnóstica ao ERP: normaliza os dados num contrato interno e
      delega ao adaptador específico a conversa com o destino — REST, SOAP, OData ou arquivo em
      SFTP. Cada empresa configura seus próprios conectores. Na entrada descem materiais,
      fornecedores, centros de custo e requisições; na saída sobe o resultado da equalização, que
      vira pedido de compra no ERP da empresa tomadora e segue a alçada de aprovação de lá.`,
    itens: [
      ['Adaptadores', 'Um por ERP, sobre um contrato interno único'],
      ['Confiabilidade', 'Fila idempotente, com retry e reprocessamento manual'],
      ['Observabilidade', 'Cada lote com duração, volume, tentativas e mensagem do destino'],
    ],
  },
  {
    titulo: 'Segurança, auditoria e LGPD',
    referencia: 'Levantamento 2.4 e 7.3',
    texto: `Clientes e fornecedores têm trilha de auditoria somente-inclusão: autor, campo alterado,
      valor anterior, valor novo, data e endereço de origem. Registros de auditoria não são editáveis
      nem removíveis pela aplicação. O escopo segue o que foi pedido e se estende a qualquer outra
      entidade sem mudança de modelo. O isolamento entre empresas é a principal garantia de
      confidencialidade entre compradores e fornecedores concorrentes.`,
    itens: [
      ['Trilha', 'Imutável, por campo, com autor e origem'],
      ['Perfis', 'Quatro níveis com superfícies de tela distintas'],
      ['Minimização', 'O fornecedor recebe apenas o necessário para precificar'],
    ],
  },
  {
    titulo: 'Preparação para inteligência artificial',
    referencia: 'Levantamento 4.1 e 4.2',
    texto: `A arquitetura fica preparada sem embutir IA na primeira versão, como solicitado. Os
      pontos de entrada estão definidos e isolados: leitura de propostas recebidas por e-mail ou PDF
      para dentro do formato estruturado, sugestão de fornecedores por histórico de desempenho,
      detecção de preço fora da curva e previsão de prazo. Como todo o histórico de cotações,
      propostas e desfechos já é armazenado de forma estruturada, o dado de treino se acumula desde
      o primeiro dia de operação.`,
    itens: [
      ['Hoje', 'Nenhuma decisão automatizada por modelo — apuração determinística'],
      ['Preparado', 'Histórico estruturado de propostas, prazos e desfechos'],
      ['Princípio', 'IA sugere e o humano confirma, até a substituição segura'],
    ],
  },
  {
    titulo: 'Acesso e mobilidade',
    referencia: 'Levantamento 7.2',
    texto: `A interface é responsiva e a mesma em qualquer dispositivo — computador, notebook ou
      celular —, sem necessidade de instalar aplicativo. No celular, as listas deixam de ser tabelas
      e viram cartões com cada campo rotulado, o que elimina a rolagem lateral. As telas analíticas,
      como a matriz de equalização, mantêm a tabela com a coluna de identificação fixa, porque ali a
      comparação lado a lado é o próprio conteúdo. As telas do fornecedor, as mais usadas fora do
      escritório, foram desenhadas para caberem confortavelmente em tela pequena.`,
    itens: [
      ['Alcance', 'Navegador em qualquer sistema, sem instalação'],
      ['Listas no celular', 'Viram cartões com campos rotulados, sem rolagem lateral'],
      ['Telas analíticas', 'Tabela com coluna de identificação fixa'],
      ['Resiliência', 'Filtros e navegação funcionam sem JavaScript no cliente'],
    ],
  },
]

const ICONES_NUMERO = [
  <IconeCaixa size={14} key="a" />, <IconeFabrica size={14} key="b" />, <IconeArvore size={14} key="c" />,
  <IconeCamada size={14} key="d" />, <IconePredio size={14} key="e" />, <IconeEscudo size={14} key="f" />,
]

export default async function PaginaArquitetura() {
  await exigir('arquitetura')
  const materiais = await contar('select count(*) c from materiais')
  const fornecedores = await contar('select count(*) c from fornecedores')
  const classificacoes = await contar('select count(*) c from classificacoes')
  const propostaItens = await contar('select count(*) c from proposta_itens')
  const empresas = await contar('select count(*) c from empresas')
  const auditoria = await contar('select count(*) c from auditoria')

  const numeros = [
    ['Materiais', materiais], ['Fornecedores', fornecedores], ['Nós de classificação', classificacoes],
    ['Itens equalizados', propostaItens], ['Empresas', empresas], ['Lançamentos de auditoria', auditoria],
  ] as const

  return (
    <>
      <CabecalhoPagina icone={<IconeArquitetura size={19} />} titulo="Nota de arquitetura"
        descricao="Como cada exigência levantada no projeto está resolvida nesta plataforma — e o que a sustenta em escala." />

      <div className="painel grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6
                      [&>*]:border-ink-200 [&>*+*]:border-l [&>*:nth-child(2n+1)]:border-l-0
                      md:[&>*:nth-child(2n+1)]:border-l md:[&>*:nth-child(3n+1)]:border-l-0
                      xl:[&>*:nth-child(3n+1)]:border-l xl:[&>*:nth-child(7n+1)]:border-l-0
                      [&>*:nth-child(n+3)]:border-t md:[&>*:nth-child(n+4)]:border-t xl:[&>*]:border-t-0
                      md:[&>*:nth-child(-n+3)]:border-t-0 mb-4 sm:mb-5">
        {numeros.map(([r, v], i) => (
          <div key={r} className="px-4 sm:px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="text-ink-400 shrink-0">{ICONES_NUMERO[i]}</span>
              <p className="kpi-rotulo">{r}</p>
            </div>
            <p className="text-xl font-semibold tabular text-ink-900 mt-1.5">{numero(v)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {BLOCOS.map((b) => (
          <section key={b.titulo} className="painel">
            <div className="grid lg:grid-cols-[1fr_320px]">
              <div className="p-4 sm:p-5 lg:pr-8">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <h2 className="text-sm font-semibold text-ink-900">{b.titulo}</h2>
                  <Tag variante="neutra">{b.referencia}</Tag>
                </div>
                <p className="text-sm text-ink-600 leading-relaxed">{b.texto}</p>
              </div>
              <dl className="border-t lg:border-t-0 lg:border-l border-ink-200 divide-y divide-ink-100">
                {b.itens.map(([rotulo, valor]) => (
                  <div key={rotulo} className="px-4 sm:px-5 py-2.5">
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-ink-400">{rotulo}</dt>
                    <dd className="text-xs text-ink-700 mt-0.5">{valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        ))}
      </div>

      <section className="painel p-4 sm:p-5 mt-4 sm:mt-5">
        <h2 className="text-sm font-semibold text-ink-900 mb-3">Base tecnológica desta demonstração</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 text-sm">
          {[
            ['Interface', 'Next.js e React, renderização no servidor. Interface responsiva; filtros e navegação operam sem JavaScript no cliente.'],
            ['Dados', 'SQLite com FTS5 nesta demonstração. O mesmo modelo relacional roda em PostgreSQL em produção, sem reescrita de consultas.'],
            ['Apuração', 'Motor de equalização isolado da interface, testável de forma independente e sem dependência de banco.'],
            ['Operação', 'Nenhuma dependência externa em tempo de execução: a demonstração roda integralmente offline.'],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-400 mb-1.5">{t}</p>
              <p className="text-ink-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
