// Dicionarios e utilitarios de geracao de massa de dados realista (pt-BR).
// PRNG deterministico: a mesma seed reproduz exatamente a mesma base.

export function criarRng(seed = 20260818) {
  let a = seed >>> 0
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const escolher = (rng, arr) => arr[Math.floor(rng() * arr.length)]
export const inteiro = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min
export const decimal = (rng, min, max, casas = 2) => {
  const v = rng() * (max - min) + min
  return Number(v.toFixed(casas))
}
export const talvez = (rng, prob) => rng() < prob

// ---------- CNPJ com digitos verificadores validos ----------
export function gerarCnpj(rng) {
  const n = Array.from({ length: 8 }, () => inteiro(rng, 0, 9))
  const filial = [0, 0, 0, 1]
  const base = [...n, ...filial]
  const calc = (nums, pesos) => {
    const soma = nums.reduce((s, v, i) => s + v * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = calc([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const t = [...base, d1, d2].join('')
  return `${t.slice(0, 2)}.${t.slice(2, 5)}.${t.slice(5, 8)}/${t.slice(8, 12)}-${t.slice(12)}`
}

// ---------- Geografia ----------
export const CIDADES = [
  ['São Paulo', 'SP'], ['Guarulhos', 'SP'], ['Campinas', 'SP'], ['Santo André', 'SP'],
  ['São Bernardo do Campo', 'SP'], ['Osasco', 'SP'], ['Sorocaba', 'SP'], ['Ribeirão Preto', 'SP'],
  ['Belo Horizonte', 'MG'], ['Contagem', 'MG'], ['Betim', 'MG'], ['Uberlândia', 'MG'],
  ['Juiz de Fora', 'MG'], ['Montes Claros', 'MG'], ['Sete Lagoas', 'MG'], ['Ipatinga', 'MG'],
  ['Rio de Janeiro', 'RJ'], ['Duque de Caxias', 'RJ'], ['Niterói', 'RJ'], ['Campos dos Goytacazes', 'RJ'],
  ['Curitiba', 'PR'], ['Londrina', 'PR'], ['Maringá', 'PR'], ['São José dos Pinhais', 'PR'],
  ['Porto Alegre', 'RS'], ['Caxias do Sul', 'RS'], ['Canoas', 'RS'], ['Novo Hamburgo', 'RS'],
  ['Joinville', 'SC'], ['Blumenau', 'SC'], ['Florianópolis', 'SC'], ['Criciúma', 'SC'],
  ['Salvador', 'BA'], ['Feira de Santana', 'BA'], ['Camaçari', 'BA'],
  ['Recife', 'PE'], ['Jaboatão dos Guararapes', 'PE'], ['Caruaru', 'PE'],
  ['Fortaleza', 'CE'], ['Maracanaú', 'CE'], ['Goiânia', 'GO'], ['Anápolis', 'GO'],
  ['Brasília', 'DF'], ['Vitória', 'ES'], ['Serra', 'ES'], ['Cariacica', 'ES'],
  ['Manaus', 'AM'], ['Belém', 'PA'], ['São Luís', 'MA'], ['Cuiabá', 'MT'],
  ['Campo Grande', 'MS'], ['Natal', 'RN'], ['João Pessoa', 'PB'], ['Maceió', 'AL'],
]

// ---------- Pessoas ----------
export const NOMES = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena',
  'Igor', 'Juliana', 'Karina', 'Leonardo', 'Mariana', 'Nathalia', 'Otávio', 'Patrícia', 'Rafael',
  'Simone', 'Thiago', 'Vanessa', 'Wagner', 'Yara', 'André', 'Beatriz', 'Caio', 'Débora', 'Emerson',
  'Flávia', 'Gustavo', 'Isabela', 'João', 'Larissa', 'Marcelo', 'Natália', 'Paulo', 'Renata',
  'Sérgio', 'Tatiane', 'Vinícius', 'Cristiane', 'Rodrigo', 'Aline', 'Fábio', 'Priscila', 'Márcio']

export const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Ribeiro', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes',
  'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques',
  'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira', 'Araújo']

export const nomePessoa = (rng) => `${escolher(rng, NOMES)} ${escolher(rng, SOBRENOMES)} ${escolher(rng, SOBRENOMES)}`

// ---------- Unidades de medida ----------
export const UNIDADES = [
  ['UN', 'Unidade', 'Contagem'], ['PC', 'Peça', 'Contagem'], ['CX', 'Caixa', 'Contagem'],
  ['PCT', 'Pacote', 'Contagem'], ['FD', 'Fardo', 'Contagem'], ['DZ', 'Dúzia', 'Contagem'],
  ['CENTO', 'Cento', 'Contagem'], ['MIL', 'Milheiro', 'Contagem'], ['PAR', 'Par', 'Contagem'],
  ['JG', 'Jogo', 'Contagem'], ['CJ', 'Conjunto', 'Contagem'], ['KIT', 'Kit', 'Contagem'],
  ['RL', 'Rolo', 'Contagem'], ['BOB', 'Bobina', 'Contagem'], ['BD', 'Balde', 'Contagem'],
  ['GL', 'Galão', 'Contagem'], ['TB', 'Tubo', 'Contagem'], ['FR', 'Frasco', 'Contagem'],
  ['LT', 'Lata', 'Contagem'], ['SC', 'Saco', 'Contagem'], ['BL', 'Bloco', 'Contagem'],
  ['RS', 'Resma', 'Contagem'], ['AMP', 'Ampola', 'Contagem'], ['BAR', 'Barra', 'Contagem'],
  ['CH', 'Chapa', 'Contagem'], ['KG', 'Quilograma', 'Massa'], ['G', 'Grama', 'Massa'],
  ['TON', 'Tonelada', 'Massa'], ['SC50', 'Saco 50kg', 'Massa'], ['L', 'Litro', 'Volume'],
  ['ML', 'Mililitro', 'Volume'], ['M3', 'Metro cúbico', 'Volume'], ['M', 'Metro', 'Comprimento'],
  ['CM', 'Centímetro', 'Comprimento'], ['MM', 'Milímetro', 'Comprimento'],
  ['KM', 'Quilômetro', 'Comprimento'], ['M2', 'Metro quadrado', 'Área'],
  ['H', 'Hora', 'Tempo'], ['MES', 'Mês', 'Tempo'], ['SERV', 'Serviço', 'Serviço'],
]

// ---------- Arvore de classificacao (5 niveis) ----------
// [grupo, [subgrupos], [familias], [subfamilias], [classes]]
export const ARVORE = [
  { g: 'Material Elétrico',
    sub: ['Condutores', 'Comandos e Proteção', 'Iluminação', 'Instalação', 'Automação'],
    fam: ['Baixa Tensão', 'Média Tensão', 'Industrial', 'Predial'],
    subfam: ['Linha Standard', 'Linha Premium', 'Linha Econômica'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Material Hidráulico',
    sub: ['Tubos e Conexões', 'Válvulas', 'Registros', 'Bombas', 'Vedação'],
    fam: ['PVC', 'Ferro Galvanizado', 'Cobre', 'PPR'],
    subfam: ['Soldável', 'Roscável', 'Compressão'],
    cls: ['Nacional', 'Importado'] },
  { g: 'EPI e Segurança',
    sub: ['Proteção Cabeça', 'Proteção Mãos', 'Proteção Respiratória', 'Proteção Pés', 'Sinalização'],
    fam: ['Uso Geral', 'Uso Químico', 'Uso Elétrico', 'Altura'],
    subfam: ['CA Vigente', 'Descartável', 'Reutilizável'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Ferramentas',
    sub: ['Manuais', 'Elétricas', 'Pneumáticas', 'Medição', 'Corte'],
    fam: ['Profissional', 'Industrial', 'Bancada'],
    subfam: ['Linha Standard', 'Linha Premium', 'Linha Econômica'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Material de Construção',
    sub: ['Cimento e Argamassa', 'Estruturas Metálicas', 'Revestimentos', 'Impermeabilizantes', 'Madeiras'],
    fam: ['Estrutural', 'Acabamento', 'Fundação'],
    subfam: ['Uso Interno', 'Uso Externo', 'Uso Geral'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Informática e Telecom',
    sub: ['Microinformática', 'Redes', 'Periféricos', 'Suprimentos', 'Energia'],
    fam: ['Corporativo', 'Servidor', 'Mobilidade'],
    subfam: ['Linha Standard', 'Linha Premium', 'Linha Econômica'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Lubrificantes e Químicos',
    sub: ['Óleos Lubrificantes', 'Graxas', 'Solventes', 'Tintas', 'Produtos de Limpeza'],
    fam: ['Mineral', 'Sintético', 'Semissintético', 'Base Água'],
    subfam: ['Industrial', 'Automotivo', 'Predial'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Rolamentos e Transmissão',
    sub: ['Rolamentos', 'Correias', 'Correntes', 'Polias', 'Redutores'],
    fam: ['Esferas', 'Roletes', 'Agulhas', 'Axial'],
    subfam: ['Linha Standard', 'Linha Premium', 'Linha Econômica'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Material de Escritório',
    sub: ['Papelaria', 'Escrita', 'Arquivo', 'Higiene', 'Copa e Cozinha'],
    fam: ['Consumo', 'Permanente'],
    subfam: ['Uso Geral', 'Uso Restrito', 'Institucional'],
    cls: ['Nacional', 'Importado'] },
  { g: 'Automotivo e Frota',
    sub: ['Peças de Reposição', 'Pneus', 'Filtros', 'Baterias', 'Acessórios'],
    fam: ['Leve', 'Pesado', 'Utilitário', 'Máquina Agrícola'],
    subfam: ['Original', 'Genuína', 'Paralela'],
    cls: ['Nacional', 'Importado'] },
]

// ---------- Templates de descricao de material por grupo ----------
export const TEMPLATES = {
  'Material Elétrico': {
    item: ['CABO FLEXÍVEL', 'CABO PP', 'DISJUNTOR MONOPOLAR', 'DISJUNTOR TRIPOLAR', 'CONTATOR',
      'RELÉ TÉRMICO', 'LÂMPADA LED BULBO', 'LUMINÁRIA LED', 'REFLETOR LED', 'TOMADA EMBUTIR',
      'INTERRUPTOR SIMPLES', 'ELETRODUTO PVC', 'CANALETA', 'FITA ISOLANTE', 'TERMINAL PRÉ-ISOLADO',
      'FUSÍVEL NH', 'BOTOEIRA', 'SINALEIRO LED', 'INVERSOR DE FREQUÊNCIA', 'QUADRO DE DISTRIBUIÇÃO'],
    attr: ['750V', '0,6/1KV', '380V', '220V', 'IP65', 'IP20', 'CLASSE B', 'NBR 5410'],
    med: ['1,5MM²', '2,5MM²', '4MM²', '6MM²', '10MM²', '16MM²', '25A', '32A', '63A', '9W', '18W', '50W', '100W', '3/4"', '1"'],
    cor: ['AZUL', 'PRETO', 'VERMELHO', 'VERDE', 'BRANCO', 'AMARELO'],
  },
  'Material Hidráulico': {
    item: ['TUBO PVC SOLDÁVEL', 'TUBO PVC ESGOTO', 'JOELHO 90°', 'JOELHO 45°', 'TÊ SOLDÁVEL',
      'LUVA SOLDÁVEL', 'BUCHA DE REDUÇÃO', 'REGISTRO ESFERA', 'REGISTRO GAVETA', 'VÁLVULA RETENÇÃO',
      'VÁLVULA ESFERA', 'ADESIVO PVC', 'FITA VEDA ROSCA', 'BOMBA CENTRÍFUGA', "CAIXA D'ÁGUA",
      'CONEXÃO PPR', 'HIDRÔMETRO', 'TORNEIRA BOIA', 'ANEL DE VEDAÇÃO', 'NIPLE GALVANIZADO'],
    attr: ['PN10', 'PN16', 'SÉRIE NORMAL', 'REFORÇADO', 'NBR 5648', 'ROSCÁVEL'],
    med: ['20MM', '25MM', '32MM', '40MM', '50MM', '75MM', '100MM', '1/2"', '3/4"', '1"', '1.1/2"', '2"'],
    cor: ['BRANCO', 'MARROM', 'CINZA', 'AZUL'],
  },
  'EPI e Segurança': {
    item: ['CAPACETE DE SEGURANÇA', 'LUVA NITRÍLICA', 'LUVA VAQUETA', 'LUVA ISOLANTE', 'ÓCULOS DE PROTEÇÃO',
      'PROTETOR AURICULAR', 'MÁSCARA PFF2', 'RESPIRADOR SEMIFACIAL', 'BOTINA DE SEGURANÇA',
      'CINTO PARAQUEDISTA', 'TALABARTE', 'AVENTAL RASPA', 'PERNEIRA', 'COLETE REFLETIVO',
      'CONE DE SINALIZAÇÃO', 'FITA ZEBRADA', 'PLACA DE SINALIZAÇÃO', 'MANGA DE RASPA', 'CAPA DE CHUVA', 'PROTETOR FACIAL'],
    attr: ['CA 31469', 'CA 28011', 'CLASSE A', 'CLASSE B', 'TIPO I', 'TIPO II', 'ANTIDERRAPANTE'],
    med: ['TAM P', 'TAM M', 'TAM G', 'TAM GG', 'Nº 38', 'Nº 40', 'Nº 42', 'Nº 44', '70CM', '90CM'],
    cor: ['BRANCO', 'AMARELO', 'AZUL', 'LARANJA', 'VERDE'],
  },
  'Ferramentas': {
    item: ['CHAVE DE FENDA', 'CHAVE PHILLIPS', 'CHAVE COMBINADA', 'JOGO DE SOQUETES', 'ALICATE UNIVERSAL',
      'ALICATE DE CORTE', 'MARTELO UNHA', 'MARRETA', 'SERRA COPO', 'FURADEIRA DE IMPACTO',
      'PARAFUSADEIRA', 'ESMERILHADEIRA', 'MORSA DE BANCADA', 'TRENA', 'PAQUÍMETRO',
      'MULTÍMETRO DIGITAL', 'TORQUÍMETRO', 'DISCO DE CORTE', 'BROCA AÇO RÁPIDO', 'NÍVEL DE BOLHA'],
    attr: ['ISOLADA 1000V', 'CROMO VANÁDIO', 'PROFISSIONAL', 'INDUSTRIAL', '110V', '220V', 'BIVOLT'],
    med: ['3/16"', '1/4"', '1/2"', '6MM', '8MM', '10MM', '13MM', '5M', '7,5M', '150MM', '300MM', '710W', '850W'],
    cor: ['PRETO', 'AZUL', 'VERMELHO', 'AMARELO'],
  },
  'Material de Construção': {
    item: ['CIMENTO PORTLAND', 'ARGAMASSA COLANTE', 'REJUNTE', 'CAL HIDRATADA', 'AREIA MÉDIA',
      'BRITA', 'VERGALHÃO CA-50', 'TELA SOLDADA', 'PERFIL METÁLICO', 'CHAPA GALVANIZADA',
      'TIJOLO CERÂMICO', 'BLOCO DE CONCRETO', 'IMPERMEABILIZANTE', 'MANTA ASFÁLTICA',
      'TÁBUA DE PINUS', 'COMPENSADO NAVAL', 'TELHA FIBROCIMENTO', 'PORCELANATO', 'MASSA CORRIDA', 'GESSO'],
    attr: ['CP-II-E-32', 'CP-IV-32', 'AC-I', 'AC-II', 'AC-III', 'NBR 7211', 'ESTRUTURAL'],
    med: ['50KG', '20KG', '25KG', '1KG', '5MM', '8MM', '10MM', '12,5MM', '3M', '6M', '60X60CM'],
    cor: ['CINZA', 'BRANCO', 'NATURAL', 'BEGE'],
  },
  'Informática e Telecom': {
    item: ['NOTEBOOK CORPORATIVO', 'DESKTOP CORPORATIVO', 'MONITOR LED', 'TECLADO ABNT2', 'MOUSE ÓPTICO',
      'HEADSET USB', 'SWITCH GERENCIÁVEL', 'ROTEADOR', 'ACCESS POINT', 'CABO DE REDE CAT6',
      'PATCH PANEL', 'RACK DE PAREDE', 'NOBREAK', 'SSD', 'MEMÓRIA RAM DDR4',
      'IMPRESSORA LASER', 'TONER', 'WEBCAM HD', 'HD EXTERNO', 'ADAPTADOR USB-C'],
    attr: ['I5 8GB', 'I7 16GB', 'RYZEN 5', 'GIGABIT', 'POE', 'RACK 19"', 'BIVOLT', 'HOMOLOGADO ANATEL'],
    med: ['14"', '15,6"', '21,5"', '24"', '27"', '240GB', '480GB', '1TB', '8GB', '16GB', '24P', '48P', '1500VA'],
    cor: ['PRETO', 'CINZA', 'GRAFITE'],
  },
  'Lubrificantes e Químicos': {
    item: ['ÓLEO LUBRIFICANTE', 'ÓLEO HIDRÁULICO', 'GRAXA DE LÍTIO', 'DESENGRAXANTE', 'SOLVENTE',
      'TINTA ESMALTE', 'TINTA ACRÍLICA', 'FUNDO ANTICORROSIVO', 'THINNER', 'DETERGENTE INDUSTRIAL',
      'DESINFETANTE', 'ÁLCOOL ISOPROPÍLICO', 'REMOVEDOR DE FERRUGEM', 'FLUIDO DE CORTE',
      'ADITIVO RADIADOR', 'SILICONE SPRAY', 'ÓLEO DE CORRENTE', 'VERNIZ', 'CERA AUTOMOTIVA', 'SABÃO LÍQUIDO'],
    attr: ['SAE 15W40', 'SAE 20W50', 'ISO VG 68', 'ISO VG 46', 'API CI-4', 'NLGI 2', 'BASE ÁGUA', 'ALTA PERFORMANCE'],
    med: ['1L', '5L', '20L', '200L', '500ML', '1KG', '3,6L', '18L', '400ML'],
    cor: ['BRANCO', 'PRETO', 'AZUL', 'VERMELHO', 'INCOLOR'],
  },
  'Rolamentos e Transmissão': {
    item: ['ROLAMENTO RÍGIDO DE ESFERAS', 'ROLAMENTO AUTOCOMPENSADOR', 'ROLAMENTO CÔNICO',
      'ROLAMENTO AXIAL', 'MANCAL DE PAREDE', 'CORREIA EM V', 'CORREIA DENTADA', 'CORRENTE DE ROLOS',
      'POLIA EM V', 'ENGRENAGEM', 'REDUTOR DE VELOCIDADE', 'ACOPLAMENTO ELÁSTICO', 'RETENTOR',
      'BUCHA CÔNICA', 'ESTICADOR DE CORRENTE', 'EIXO DE TRANSMISSÃO', 'MANCAL FLANGEADO',
      'ANEL ELÁSTICO', 'GRAXEIRA', 'CHAVETA'],
    attr: ['BLINDADO 2Z', 'VEDADO 2RS', 'ABERTO', 'C3', 'ASA 40', 'ASA 60', 'PERFIL A', 'PERFIL B'],
    med: ['6203', '6204', '6205', '6206', '6305', '22208', '30205', 'A-45', 'B-60', '1/2"', '5/8"', '3/4"'],
    cor: ['NATURAL', 'PRETO'],
  },
  'Material de Escritório': {
    item: ['PAPEL SULFITE', 'CANETA ESFEROGRÁFICA', 'LÁPIS PRETO', 'BORRACHA', 'MARCA TEXTO',
      'PINCEL ATÔMICO', 'PASTA SUSPENSA', 'PASTA AZ', 'GRAMPEADOR', 'GRAMPO',
      'CLIPS', 'ENVELOPE', 'BLOCO ADESIVO', 'FITA ADESIVA', 'PAPEL TOALHA',
      'PAPEL HIGIÊNICO', 'COPO DESCARTÁVEL', 'CAFÉ EM PÓ', 'AÇÚCAR', 'ÁGUA MINERAL'],
    attr: ['A4 75G', 'A3 75G', 'OFÍCIO', 'RECICLADO', 'PONTA FINA', 'PONTA MÉDIA', '2/0', '26/6'],
    med: ['500FL', '100UN', '50UN', '12UN', '200ML', '500G', '1KG', '20L', '30M'],
    cor: ['AZUL', 'PRETO', 'VERMELHO', 'BRANCO', 'AMARELO', 'VERDE'],
  },
  'Automotivo e Frota': {
    item: ['PNEU RADIAL', 'FILTRO DE ÓLEO', 'FILTRO DE AR', 'FILTRO DE COMBUSTÍVEL', 'BATERIA AUTOMOTIVA',
      'PASTILHA DE FREIO', 'DISCO DE FREIO', 'AMORTECEDOR', 'CORREIA DENTADA', 'VELA DE IGNIÇÃO',
      'LÂMPADA AUTOMOTIVA', 'PALHETA LIMPADOR', 'RADIADOR', 'EMBREAGEM', 'ROLAMENTO DE RODA',
      "BOMBA D'ÁGUA", 'JUNTA DO CABEÇOTE', 'TERMINAL DE DIREÇÃO', 'MOLA HELICOIDAL', 'ESCAPAMENTO'],
    attr: ['ORIGINAL', 'GENUÍNA', 'LINHA PESADA', 'LINHA LEVE', '12V', '24V', 'DIANTEIRO', 'TRASEIRO'],
    med: ['175/70 R13', '185/65 R15', '195/55 R16', '215/75 R17.5', '275/80 R22.5', '60AH', '100AH', '150AH'],
    cor: ['PRETO', 'NATURAL'],
  },
}

// ---------- Nomes de empresa ----------
export const RADICAIS_EMPRESA = ['Ferrari', 'Andrade', 'Progresso', 'Atlas', 'Vértice', 'Nordeste',
  'Planalto', 'Ipiranga', 'Sul Minas', 'Bandeirante', 'Aliança', 'Central', 'Delta', 'Horizonte',
  'Império', 'Jequitibá', 'Krona', 'Litoral', 'Metropolitana', 'Nova Era', 'Oceano', 'Pioneira',
  'Quatro Rodas', 'Real', 'Serrana', 'Triângulo', 'União', 'Vale Verde', 'Zênite', 'Araucária',
  'Bandeira', 'Cordilheira', 'Diamante', 'Estrela', 'Fortaleza', 'Guarani', 'Harmonia', 'Itamaraty',
  'Jacarandá', 'Kaiser', 'Luminar', 'Monte Alto', 'Nacional', 'Ouro Preto', 'Paraná', 'Quartzo',
  'Rio Doce', 'Santa Rita', 'Tocantins', 'Urano', 'Vitória', 'Xingu', 'Yucatan', 'Zafira']

export const SUFIXOS_FORN = ['Comércio de Materiais', 'Distribuidora', 'Suprimentos Industriais',
  'Indústria e Comércio', 'Equipamentos', 'Representações', 'Atacadista', 'Importação e Comércio',
  'Materiais Técnicos', 'Soluções Industriais', 'Componentes', 'Produtos Industriais']

export const TIPOS_SOC = ['Ltda', 'S.A.', 'ME', 'EIRELI', 'Ltda']

export const SUFIXOS_TRANSP = ['Transportes', 'Logística', 'Transportadora', 'Cargas e Encomendas',
  'Express', 'Rodoviário', 'Transportes e Logística', 'Distribuição']

export const SEGMENTOS_CLIENTE = ['Construção Civil', 'Indústria Metalúrgica', 'Agronegócio', 'Varejo',
  'Saúde', 'Educação', 'Alimentício', 'Automotivo', 'Energia', 'Saneamento', 'Mineração', 'Têxtil',
  'Serviços', 'Cooperativa', 'Setor Público']

export const COND_PAGAMENTO = [
  ['À vista', 0], ['7 dias', 7], ['14 dias', 14], ['21 dias', 21], ['28 dias', 28],
  ['30 dias', 30], ['30/60 dias', 45], ['30/60/90 dias', 60], ['45 dias', 45],
  ['60 dias', 60], ['Faturado 30 dias', 30], ['Boleto 15 dias', 15],
]

export const CENTROS_CUSTO = ['1001 - Manutenção Industrial', '1002 - Produção', '1003 - Frota',
  '2001 - Administrativo', '2002 - TI', '3001 - Obras e Projetos', '3002 - Facilities',
  '4001 - Almoxarifado Central', '4002 - Segurança do Trabalho', '5001 - Laboratório']

export const MODAIS = ['Rodoviário', 'Rodoviário Fracionado', 'Rodoviário Carga Fechada', 'Aéreo', 'Multimodal']
export const ABRANGENCIAS = ['Municipal', 'Estadual', 'Regional', 'Nacional', 'Nacional + Mercosul']

export const ERPS = [
  ['TOTVS Protheus', '12.1.2310', 'REST/JSON'],
  ['TOTVS Datasul', '12.1.34', 'SOAP/XML'],
  ['SAP ECC', '6.0 EHP8', 'OData'],
  ['SAP S/4HANA', '2023', 'OData'],
  ['Sankhya Om', '4.16', 'REST/JSON'],
  ['Oracle EBS', 'R12.2', 'REST/JSON'],
  ['Senior ERP', '5.10', 'SOAP/XML'],
  ['Microsiga', '11.8', 'Arquivo CSV/SFTP'],
]
