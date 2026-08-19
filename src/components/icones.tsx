// Conjunto de icones em SVG inline (traco 1.5, grade 24).
// Sem dependencia externa: a aplicacao roda offline, sem CDN.
type P = { className?: string; size?: number }
const b = (size = 16) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const, 'aria-hidden': true,
})

/* ---------------------------------------------------- navegacao */
export const IconePainel = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
)
export const IconeCaixa = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>
)
export const IconeFabrica = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M2 20h20M4 20V9l5 3V9l5 3V4h4a2 2 0 0 1 2 2v14" /><path d="M8 20v-4M13 20v-4M18 20v-4" /></svg>
)
export const IconePessoas = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
)
export const IconeCaminhao = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M10 17h4V5H2v12h3M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
)
export const IconeLista = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
export const IconeBalanca = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M12 3v18M8 21h8M3 7h18M6.5 7 3 14h7l-3.5-7zM17.5 7 14 14h7l-3.5-7z" /></svg>
)
export const IconeRelogio = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconeConector = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4" /></svg>
)
export const IconeEscudo = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
)
export const IconePredio = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 22v-4h4v4" /></svg>
)
export const IconeArquitetura = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="7" rx="1.5" /><path d="M6.5 10v2a2 2 0 0 0 2 2h.5M17.5 10v2a2 2 0 0 1-2 2H15" /></svg>
)

/* ---------------------------------------------------- acoes */
export const IconeBusca = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const IconeFiltro = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" /></svg>
)
export const IconeLimpar = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></svg>
)
export const IconeSeta = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const IconeSetaEsq = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
)
export const IconeChevron = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconeChevronDir = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m9 6 6 6-6 6" /></svg>
)
export const IconeChevronEsq = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m15 6-6 6 6 6" /></svg>
)
export const IconeMenu = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
)
export const IconeFechar = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const IconeCheck = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m5 12 5 5L20 7" /></svg>
)
export const IconeAlerta = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
)
export const IconeInfo = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
)
export const IconePorta = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
)
export const IconeExterno = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
)

/* ---------------------------------------------------- dominio */
export const IconeSino = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
)
export const IconeEnvio = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
)
export const IconeCamada = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /></svg>
)
export const IconeGrafico = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M3 3v18h18" /><path d="m7 15 4-5 4 3 5-7" /></svg>
)
export const IconeTendencia = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></svg>
)
export const IconeQueda = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m22 17-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></svg>
)
export const IconeMoeda = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M15 9.5A3 3 0 0 0 12.5 8h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 1 0 5h-1A3 3 0 0 1 9 16.5M12 6v12" /></svg>
)
export const IconeEtiqueta = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></svg>
)
export const IconeCalendario = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
)
export const IconeDocumento = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" /><path d="M14 2v5h5M9 13h6M9 17h4" /></svg>
)
export const IconeUsuario = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
)
export const IconeLocal = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
)
export const IconeEmail = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>
)
export const IconeTelefone = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
)
export const IconeSincronia = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></svg>
)
export const IconeBanco = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
)
export const IconeRaio = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>
)
export const IconeCadeado = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
export const IconeArvore = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v4M5 17v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" /></svg>
)
export const IconeVazio = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9z" opacity=".4" /><path d="M3 7.5 12 12l9-4.5M12 12v9" opacity=".4" /><path d="m8 10 8 4" /></svg>
)
export const IconeAjuste = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
)
export const IconeCotacao = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /><path d="M9 7h6M9 11h6M9 15h3" /></svg>
)
export const IconeEstrela = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3z" /></svg>
)
export const IconeRegua = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z" /><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2" /></svg>
)

/* ------------------------------------------------------- acoes */
export const IconeMais = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconeLapis = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
)
export const IconeLixeira = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></svg>
)
export const IconeArquivar = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>
)
export const IconeDesfazer = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2.1-9.4L3 7" /></svg>
)
export const IconeSelo = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><circle cx="12" cy="9" r="6" /><path d="m9 13.5-1 7.5 4-2 4 2-1-7.5" /><path d="m9.8 9 1.6 1.6L14.4 7.6" /></svg>
)
export const IconeBaixar = ({ className, size }: P) => (
  <svg {...b(size)} className={className}><path d="M12 3v12M7 11l5 4 5-4M4 20h16" /></svg>
)
