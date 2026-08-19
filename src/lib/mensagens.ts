// =====================================================================
// Modelos das mensagens que saem da plataforma.
//
// Cada modelo devolve assunto, texto puro e HTML. As tres partes juntas,
// sempre: o texto nao e rascunho do HTML, e o que o filtro antispam le e o
// que aparece em cliente que bloqueia marcacao. Mensagem so-HTML pontua pior
// e chega menos.
//
// O HTML aqui e deliberadamente antiquado — tabela, largura fixa, estilo na
// propria tag. Cliente de e-mail nao tem folha de estilo externa, flexbox
// nem grid confiaveis; o Outlook ainda renderiza com o motor do Word. O que
// funciona e o que funcionava em 2005.
// =====================================================================
import { moeda } from './formato'

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TINTA = '#0f172a'
const APOIO = '#475569'
const BORDA = '#e2e8f0'
const MARCA = '#1d4ed8'

const dataBr = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Moldura = {
  titulo: string
  /** Primeira linha que o cliente mostra na lista, antes de abrir. */
  previa: string
  corpo: string
  botao?: { rotulo: string; url: string }
  rodape?: string
}

/** Casca comum: cabecalho, conteudo, botao e rodape. */
function moldura(m: Moldura): string {
  const botao = m.botao
    ? `<tr><td style="padding:8px 32px 4px">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
           <td bgcolor="${MARCA}" style="border-radius:6px">
             <a href="${esc(m.botao!.url)}" style="display:inline-block;padding:13px 26px;font:600 15px/1 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none">${esc(m.botao!.rotulo)}</a>
           </td>
         </tr></table>
       </td></tr>
       <tr><td style="padding:14px 32px 0;font:12px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8;word-break:break-all">
         Se o botão não funcionar, copie este endereço: ${esc(m.botao!.url)}
       </td></tr>`
    : ''

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(m.titulo)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(m.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${BORDA};border-radius:12px">
    <tr><td style="padding:24px 32px 18px;border-bottom:1px solid ${BORDA}">
      <span style="font:700 19px/1 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA};letter-spacing:-.4px">SUPRA</span>
      <span style="font:12px/1 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8;padding-left:9px">Cotações corporativas</span>
    </td></tr>
    <tr><td style="padding:26px 32px 4px">
      <h1 style="margin:0 0 14px;font:600 21px/1.3 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA}">${esc(m.titulo)}</h1>
      <div style="font:15px/1.65 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${APOIO}">${m.corpo}</div>
    </td></tr>
    ${botao}
    <tr><td style="padding:26px 32px 24px">
      <div style="border-top:1px solid ${BORDA};padding-top:16px;font:12px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8">
        ${m.rodape ?? 'Mensagem automática da plataforma SUPRA. Não é necessário responder a este e-mail.'}
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

export type Item = {
  descricao: string
  quantidade: number
  unidade: string
  preco_referencia?: number | null
}

/** Tabela de itens no HTML; no texto puro vira lista com hifen. */
function tabelaItens(itens: Item[], total: number): string {
  const linhas = itens.map((i, n) => `
    <tr style="background:${n % 2 ? '#f8fafc' : '#ffffff'}">
      <td style="padding:9px 12px;font:13px/1.45 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA};border-bottom:1px solid ${BORDA}">${esc(i.descricao)}</td>
      <td align="right" style="padding:9px 12px;font:13px/1.45 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${APOIO};white-space:nowrap;border-bottom:1px solid ${BORDA}">${i.quantidade} ${esc(i.unidade)}</td>
    </tr>`).join('')

  const resto = total > itens.length
    ? `<tr><td colspan="2" style="padding:9px 12px;font:12px/1.45 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8">
         e mais ${total - itens.length} ${total - itens.length === 1 ? 'item' : 'itens'} — a lista completa está no portal.
       </td></tr>`
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;border:1px solid ${BORDA};border-radius:8px;border-collapse:separate;overflow:hidden">
    <tr style="background:#f1f5f9">
      <th align="left" style="padding:9px 12px;font:600 11px/1 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid ${BORDA}">Material</th>
      <th align="right" style="padding:9px 12px;font:600 11px/1 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid ${BORDA}">Quantidade</th>
    </tr>${linhas}${resto}
  </table>`
}

const listaTexto = (itens: Item[], total: number) =>
  itens.map((i) => `  - ${i.descricao} — ${i.quantidade} ${i.unidade}`).join('\n') +
  (total > itens.length ? `\n  - e mais ${total - itens.length} item(ns), veja a lista completa no portal.` : '')

export type Modelo = { assunto: string; texto: string; html: string }

export type DadosConvite = {
  fornecedor: string
  empresa: string
  numero: string
  titulo: string
  itens: Item[]
  totalItens: number
  encerraEm: string | null
  link: string
  observacoes?: string | null
}

/**
 * Convite para cotar.
 *
 * O link ja carrega o token do convite: o fornecedor nao cria conta e nao
 * tem senha. Exigir cadastro de fornecedor externo derruba a taxa de
 * resposta, que e justamente o numero que faz a rodada valer a pena.
 */
export function convite(d: DadosConvite): Modelo {
  const prazo = d.encerraEm ? dataBr(d.encerraEm) : null
  const obs = d.observacoes?.trim()

  const assunto = `Cotação ${d.numero} — ${d.titulo} — ${d.empresa}`

  const texto =
`Olá, ${d.fornecedor}.

A ${d.empresa} abriu a cotação ${d.numero} — ${d.titulo} — e está convidando sua empresa a apresentar proposta.

Itens desta rodada (${d.totalItens}):
${listaTexto(d.itens, d.totalItens)}
${prazo ? `\nPrazo para resposta: ${prazo}.\n` : ''}${obs ? `\nObservações do comprador:\n${obs}\n` : ''}
Para responder, abra o link abaixo. Ele já identifica sua empresa — não é preciso criar conta nem senha.

${d.link}

No portal você informa, item a item: preço unitário, marca, IPI, ICMS-ST e prazo de entrega; e, para a proposta toda: frete, condição de pagamento, desconto e validade. Dá para salvar e voltar depois, enquanto o prazo estiver aberto.

Mensagem automática da plataforma SUPRA.`

  const html = moldura({
    titulo: `Convite para cotação ${esc(d.numero)}`,
    previa: `${d.empresa} convida sua empresa a cotar ${d.totalItens} item(ns) — ${d.titulo}`,
    corpo:
      `<p style="margin:0 0 14px">Olá, <strong style="color:${TINTA}">${esc(d.fornecedor)}</strong>.</p>
       <p style="margin:0 0 14px">A <strong style="color:${TINTA}">${esc(d.empresa)}</strong> abriu a cotação
       <strong style="color:${TINTA}">${esc(d.numero)} — ${esc(d.titulo)}</strong> e está convidando sua empresa a apresentar proposta.</p>
       ${tabelaItens(d.itens, d.totalItens)}
       ${prazo ? `<p style="margin:0 0 14px">Prazo para resposta: <strong style="color:${TINTA}">${esc(prazo)}</strong>.</p>` : ''}
       ${obs ? `<p style="margin:0 0 14px;padding:12px 14px;background:#f8fafc;border-left:3px solid ${BORDA};font-size:14px"><strong style="color:${TINTA}">Observações do comprador:</strong><br>${esc(obs)}</p>` : ''}
       <p style="margin:0 0 6px">O link abaixo já identifica sua empresa — não é preciso criar conta nem senha.</p>`,
    botao: { rotulo: 'Responder a cotação', url: d.link },
    rodape:
      'No portal você informa, item a item: preço unitário, marca, IPI, ICMS-ST e prazo de entrega; e, para a proposta ' +
      'toda: frete, condição de pagamento, desconto e validade. Dá para salvar e voltar depois, enquanto o prazo ' +
      'estiver aberto.<br><br>Mensagem automática da plataforma SUPRA.',
  })

  return { assunto, texto, html }
}

export type DadosLembrete = {
  fornecedor: string
  empresa: string
  numero: string
  titulo: string
  encerraEm: string | null
  link: string
}

/** Lembrete de prazo — a rodada ainda aceita proposta, mas nao por muito tempo. */
export function lembrete(d: DadosLembrete): Modelo {
  const prazo = d.encerraEm ? dataBr(d.encerraEm) : null
  const assunto = `Lembrete — cotação ${d.numero} encerra em breve`

  const texto =
`Olá, ${d.fornecedor}.

A cotação ${d.numero} — ${d.titulo}, da ${d.empresa}, ainda está sem proposta da sua empresa${prazo ? ` e encerra em ${prazo}` : ''}.

Se ainda tiver interesse, responda pelo link:

${d.link}

Se não for atender esta rodada, pode ignorar esta mensagem — o registro de recusa é feito no próprio portal e ajuda a calibrar os próximos convites.

Mensagem automática da plataforma SUPRA.`

  const html = moldura({
    titulo: 'A rodada encerra em breve',
    previa: `Cotação ${d.numero} ainda sem proposta da sua empresa${prazo ? ` — encerra em ${prazo}` : ''}`,
    corpo:
      `<p style="margin:0 0 14px">Olá, <strong style="color:${TINTA}">${esc(d.fornecedor)}</strong>.</p>
       <p style="margin:0 0 14px">A cotação <strong style="color:${TINTA}">${esc(d.numero)} — ${esc(d.titulo)}</strong>,
       da ${esc(d.empresa)}, ainda está sem proposta da sua empresa${prazo ? ` e encerra em <strong style="color:${TINTA}">${esc(prazo)}</strong>` : ''}.</p>
       <p style="margin:0 0 6px">Se ainda tiver interesse, responda pelo link abaixo.</p>`,
    botao: { rotulo: 'Enviar proposta', url: d.link },
    rodape:
      'Se não for atender esta rodada, pode ignorar esta mensagem — o registro de recusa é feito no próprio portal ' +
      'e ajuda a calibrar os próximos convites.<br><br>Mensagem automática da plataforma SUPRA.',
  })

  return { assunto, texto, html }
}

export type DadosEncerramento = {
  fornecedor: string
  empresa: string
  numero: string
  titulo: string
  respondeu: boolean
}

/** Aviso de encerramento. Nao revela preco de concorrente nem quem ganhou. */
export function encerramento(d: DadosEncerramento): Modelo {
  const assunto = `Cotação ${d.numero} encerrada — ${d.empresa}`

  const nota = d.respondeu
    ? 'Sua proposta foi recebida e entrou na equalização. Assim que a análise for concluída, o comprador entra em contato com o resultado.'
    : 'Não recebemos proposta da sua empresa nesta rodada. O convite permanece no histórico e sua empresa segue na base para as próximas cotações do grupo.'

  const texto =
`Olá, ${d.fornecedor}.

A cotação ${d.numero} — ${d.titulo}, da ${d.empresa}, foi encerrada e não aceita mais propostas.

${nota}

Mensagem automática da plataforma SUPRA.`

  const html = moldura({
    titulo: `Cotação ${esc(d.numero)} encerrada`,
    previa: `A rodada ${d.numero} foi encerrada e não aceita mais propostas.`,
    corpo:
      `<p style="margin:0 0 14px">Olá, <strong style="color:${TINTA}">${esc(d.fornecedor)}</strong>.</p>
       <p style="margin:0 0 14px">A cotação <strong style="color:${TINTA}">${esc(d.numero)} — ${esc(d.titulo)}</strong>,
       da ${esc(d.empresa)}, foi encerrada e não aceita mais propostas.</p>
       <p style="margin:0">${esc(nota)}</p>`,
  })

  return { assunto, texto, html }
}

export type DadosProposta = {
  comprador: string
  fornecedor: string
  numero: string
  titulo: string
  itens: number
  total: number
  link: string
}

/** Aviso interno: chegou proposta. Vai para quem conduz a rodada, nao para o fornecedor. */
export function propostaRecebida(d: DadosProposta): Modelo {
  const assunto = `Proposta recebida — ${d.fornecedor} — cotação ${d.numero}`

  const texto =
`${d.fornecedor} enviou proposta para a cotação ${d.numero} — ${d.titulo}.

Itens precificados: ${d.itens}
Valor da proposta: ${moeda(d.total)}

Abra a rodada para ver a equalização atualizada:
${d.link}

Mensagem automática da plataforma SUPRA.`

  const html = moldura({
    titulo: 'Proposta recebida',
    previa: `${d.fornecedor} respondeu a cotação ${d.numero} — ${moeda(d.total)}`,
    corpo:
      `<p style="margin:0 0 14px"><strong style="color:${TINTA}">${esc(d.fornecedor)}</strong> enviou proposta para a cotação
       <strong style="color:${TINTA}">${esc(d.numero)} — ${esc(d.titulo)}</strong>.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">
         <tr><td style="padding:3px 22px 3px 0;font:13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8">Itens precificados</td>
             <td style="font:600 13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA}">${d.itens}</td></tr>
         <tr><td style="padding:3px 22px 3px 0;font:13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8">Valor da proposta</td>
             <td style="font:600 13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA}">${esc(moeda(d.total))}</td></tr>
       </table>`,
    botao: { rotulo: 'Ver equalização', url: d.link },
  })

  return { assunto, texto, html }
}

/**
 * Teste de configuracao. Carrega acento, tabela e link de proposito — se
 * chegar inteiro, o caminho inteiro esta funcionando, nao so a conexao.
 */
export function teste(marca: string, base: string, quem: string): Modelo {
  const assunto = `SUPRA — teste de envio (${marca})`

  const texto =
`Teste de configuração de e-mail do SUPRA.

Identificador desta mensagem: ${marca}
Solicitado por: ${quem}
Endereço da plataforma: ${base || '(APP_URL não definida)'}

Se esta mensagem chegou legível, com os acentos corretos — ação, cotação, equalização, órgão —
o envio pelo SMTP está funcionando de ponta a ponta.

Mensagem automática da plataforma SUPRA.`

  const html = moldura({
    titulo: 'Teste de envio',
    previa: `Configuração de e-mail do SUPRA — identificador ${marca}`,
    corpo:
      `<p style="margin:0 0 14px">Se você está lendo isto, o envio pelo SMTP está funcionando de ponta a ponta:
       conexão, autenticação, cabeçalho com acento e as duas partes da mensagem (texto e HTML).</p>
       <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">
         <tr><td style="padding:3px 22px 3px 0;font:13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8">Identificador</td>
             <td style="font:600 13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:${TINTA}">${esc(marca)}</td></tr>
         <tr><td style="padding:3px 22px 3px 0;font:13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#94a3b8">Solicitado por</td>
             <td style="font:600 13px/1.6 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA}">${esc(quem)}</td></tr>
       </table>
       <p style="margin:0 0 14px">Acentuação de controle: ação, cotação, equalização, órgão, José, Bíblia, Ubá.</p>`,
    botao: base ? { rotulo: 'Abrir a plataforma', url: base } : undefined,
  })

  return { assunto, texto, html }
}
