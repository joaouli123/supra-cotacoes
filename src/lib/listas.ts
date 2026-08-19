// =====================================================================
// Listas de dominio usadas nos formularios.
//
// Sao os mesmos conjuntos que a carga inicial usa. Ficam aqui, e nao em
// scripts/, porque scripts/ nao entra no build da aplicacao: importar de
// la faria o formulario depender de um arquivo que nao existe no
// container.
// =====================================================================

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

export const SEGMENTOS = [
  'Construção Civil', 'Indústria Metalúrgica', 'Agronegócio', 'Varejo', 'Saúde',
  'Educação', 'Alimentício', 'Automotivo', 'Energia', 'Saneamento', 'Mineração',
  'Têxtil', 'Serviços', 'Cooperativa', 'Setor Público', 'Transporte e Logística',
]

export const MODAIS = [
  'Rodoviário', 'Rodoviário Fracionado', 'Rodoviário Carga Fechada', 'Aéreo', 'Multimodal',
]

export const ABRANGENCIAS = [
  'Municipal', 'Estadual', 'Regional', 'Nacional', 'Nacional + Mercosul',
]

export const PLANOS = ['Corporativo', 'Profissional', 'Essencial']

export const CENTROS_CUSTO = [
  '1001 - Manutenção Industrial', '1002 - Produção', '1003 - Frota',
  '2001 - Administrativo', '2002 - TI', '3001 - Obras e Projetos', '3002 - Facilities',
  '4001 - Almoxarifado Central', '4002 - Segurança do Trabalho', '5001 - Laboratório',
]

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** Lista simples vira lista de opcoes com valor igual ao rotulo. */
export const comoOpcoes = (xs: readonly string[]) => xs.map((x) => ({ valor: x, rotulo: x }))
