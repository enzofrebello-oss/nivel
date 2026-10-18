# Treino: projeto da v1

App pessoal para registrar treinos de musculação/calistenia. PWA instalável no celular, 100% offline, uso por uma única pessoa, dados só no aparelho.

---

## 1. Visão geral

**O que a v1 faz**
- Cadastro de exercícios com **tipo** (`carga`: peso + reps · `corpo`: reps · `tempo`: segundos) e **local** (casa e/ou academia).
- Montagem de **treinos** (modelos) a partir dos exercícios.
- **Sessão de treino**: registrar séries em tempo real; cada série é salva na hora (fechar o app não perde nada).
- **Histórico** de sessões e **gráfico de evolução** por exercício.
- **Backup**: exportar/importar JSON (os dados existem só no aparelho).

**Princípios**
- Offline primeiro: nenhuma requisição externa. Fontes, ícones e bibliotecas ficam dentro do projeto.
- IndexedDB é a única fonte da verdade. Não há estado global em memória: cada tela relê o banco ao renderizar.
- Simples de manter: sem etapa de build, edita, salva e recarrega.

---

## 2. Decisão de tecnologia

**Decisão: HTML, CSS e JavaScript puro, sem framework (concordo com a recomendação).**

Motivos:
- O app é pequeno (cerca de 10 telas, 5 coleções de dados, 1 usuário). Um framework resolveria problemas de escala e equipe que este projeto não tem.
- Sem build, o que roda no celular é exatamente o código-fonte. Isso facilita depurar e manter por anos sem dependências quebrando.
- Offline fica trivial: o service worker guarda arquivos estáticos e nada mais.
- Tamanho total esperado: menos de 150 KB, sem minificar.

Risco conhecido: atualizar o DOM à mão fica trabalhoso em telas interativas (a tela de sessão). Mitigação: um helper `h()` para criar elementos e o padrão "cada tela tem `render()` e redesenha o trecho que mudou". **Quando reconsiderar:** se a tela de sessão ficar difícil de manter, vendorizar **Preact + htm** (cerca de 5 KB, arquivos ESM, continua sem build). Não é necessário na v1.

Alternativas descartadas: React/Vue/Svelte com Vite (exigem build e toolchain Node para um ganho pequeno aqui); Lit (Web Components não trazem vantagem para 1 app de 1 pessoa).

### Decisões técnicas

| Tema | Decisão | Motivo |
|---|---|---|
| Módulos | **ES modules nativos** (`<script type="module">`), sem bundler | Todos os navegadores móveis atuais suportam. Muitos arquivos pequenos não custam nada com o cache do SW. Custo: listar os arquivos no precache à mão. |
| Wrapper do IndexedDB | **`idb` (Jake Archibald) vendorizado** em `vendor/idb/` | Cerca de 4 KB, ESM, testado em produção. Resolve com promises o `upgradeneeded`, o `blocked` e o fim de transação, que é onde um wrapper feito à mão costuma errar. Fica isolado em `js/db/`: trocar depois é barato. |
| Gráfico | **SVG próprio** (`js/ui/grafico.js`, cerca de 150 linhas) | Só um tipo: linha com pontos no tempo, dezenas a centenas de pontos. SVG escala com `viewBox`, segue o tema claro/escuro via CSS e permite tocar no ponto para ver o valor. Zero dependência. Se um dia precisar de zoom ou muitas séries: uPlot vendorizado. |
| Renderização | Helper `h(tag, attrs, ...filhos)` cria nós DOM; dados do usuário **nunca** entram via `innerHTML` | Sem risco de injeção e sem template engine. |
| Fontes e ícones | Fonte do sistema (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), ícones SVG inline | Nada a baixar, visual nativo. Se quiser outra fonte: `.woff2` em `fonts/` + precache. |
| Roteamento | **Hash** (`#/treinos/abc`) | Funciona em qualquer hospedagem estática (inclusive subpasta do GitHub Pages) sem regra de rewrite. O SW só precisa servir `index.html`. |
| IDs | `crypto.randomUUID()` | Únicos, sem contador. Exige contexto seguro, que a PWA já exige. |
| Datas | Epoch em ms (`number`) | Ordenáveis em índice. Exibição com `Intl.DateTimeFormat('pt-BR')`. |
| Entrada numérica | `<input type="text" inputmode="decimal">` + parse que aceita vírgula | `type="number"` se comporta mal com vírgula decimal em teclados pt-BR. |
| Unidade | Só **kg** na v1 | Simplicidade. |

### Service worker e versionamento de cache
- `sw.js` na **raiz** (escopo cobre o app inteiro), com uma constante `VERSAO = 'v1'` e uma lista `ARQUIVOS` com **todos** os arquivos do app (HTML, CSS, JS, vendor, ícones, manifest).
- `install`: `cache.addAll(ARQUIVOS)` no cache `treino-${VERSAO}`, com `cache: 'reload'` para não pegar cópia velha do cache HTTP.
- `activate`: apaga caches `treino-*` diferentes do atual.
- `fetch`: **cache-first** para GET do próprio domínio. Navegações (`mode: 'navigate'`) recebem `index.html` do cache.
- Atualização: o SW novo **não** usa `skipWaiting` automático. O app detecta o SW em `waiting` e mostra o banner "Nova versão disponível · Atualizar". O toque envia `postMessage('SKIP_WAITING')` e o app recarrega no `controllerchange`. Assim a página não recarrega no meio de uma série. Mesmo se recarregar, a sessão está no banco.
- **Regra de ouro:** todo deploy incrementa `VERSAO`, e todo arquivo novo entra em `ARQUIVOS`. A versão aparece em Ajustes.
- Em desenvolvimento: DevTools › Application › Service workers › marcar "Update on reload" (ou "Bypass for network").

### Migrações do schema (IndexedDB)
- `js/db/migracoes.js` exporta uma lista ordenada: `{ 1: fn, 2: fn, ... }`. `DB_VERSAO` = maior chave.
- No `upgrade(db, versaoAntiga, versaoNova, tx)` do `idb`, roda `migracoes[v]` para cada `v` de `versaoAntiga + 1` até `versaoNova`, em ordem, na mesma transação de upgrade.
- Migrações publicadas **nunca são editadas**, só acrescentadas. Uma mudança de dados (ex.: preencher um campo novo) é feita na migração com cursor sobre o `tx`.
- `blocking` (outra aba/janela com versão antiga): fecha a conexão e mostra "Recarregue o app". `blocked`: mostra aviso "Feche outras abas do app".

### Backup (exportar/importar JSON)
- **Exportar**: lê todas as stores e gera `treino-backup-AAAA-MM-DD.json`:
  `{ "app": "treino-app", "formato": 1, "versaoDb": 1, "exportadoEm": 1760790000000, "dados": { "exercicios": [...], "treinos": [...], "sessoes": [...], "series": [...] } }`
  No celular usa `navigator.share({ files })` quando disponível (permite salvar no Drive/Arquivos). Fora disso, download por `<a download>`. Grava `meta.ultimoBackup`.
- **Importar**: escolhe o arquivo, valida (`app`, `formato <= atual`, arrays presentes, cada registro passa na validação do seu tipo), mostra prévia ("12 exercícios, 4 treinos, 80 sessões, 1.900 séries") e pede confirmação. Então **substitui tudo** numa única transação sobre todas as stores (atômico: se falhar, nada muda). Mesclar fica fora da v1.
- `formato` é independente de `versaoDb`. Se o formato mudar, o importador converte formatos antigos antes de gravar.
- Lembrete no Início se o último backup tiver mais de 7 dias.
- Na primeira abertura: `navigator.storage.persist()` (pede ao navegador para não apagar os dados sob pressão de espaço). O status aparece em Ajustes.

### Como testar
**No PC (localhost é contexto seguro: SW e instalação funcionam).** Node 24 e Python 3.13 estão instalados nesta máquina.
- Preferido: `npx http-server -p 8080 -c-1` na pasta do projeto (`-c-1` desliga o cache HTTP).
- Alternativa: `python -m http.server 8080`. Se der erro "MIME type text/plain" ao carregar módulos, a causa é o registro do Windows. Use o `http-server`.
- Abrir `http://localhost:8080`, DevTools no modo dispositivo móvel. Para o offline: Application › Service workers › Offline.
- Testes de lógica: `http://localhost:8080/testes/` (roda no navegador, sem Node).

**No celular (Android, com Chrome). O IP da rede local via `http://` NÃO é contexto seguro: não instala nem registra SW.**
- **Desenvolvimento (com cabo):** depuração USB ligada, `chrome://inspect/#devices` no PC › Port forwarding `8080 → localhost:8080`. No celular, abrir `http://localhost:8080`: é contexto seguro, instala e dá para depurar pelo DevTools do PC.
- **Sem cabo:** precisa de HTTPS. Use a hospedagem definitiva (abaixo) ou um túnel temporário (ex. `cloudflared tunnel --url http://localhost:8080`), só para teste.
- **Uso real:** **GitHub Pages** (HTTPS, repositório público: o código fica público, mas os dados não saem do aparelho). O endereço escolhido na publicação é **definitivo e não deve mudar depois**.
- ⚠️ Os dados do IndexedDB pertencem à **origem** (domínio). Trocar de URL (outro domínio, outro usuário/repositório no GitHub, ou túnel) significa começar com o banco vazio; a migração só é possível por backup. Por isso o endereço do GitHub Pages fica fixo.

---

## 3. Arquitetura

### Camadas
```
telas (js/telas/*)  ──usa──▶  ui (js/ui/*)          componentes, gráfico, h()
        │
        ├──usa──▶  logica (js/logica/*)             funções puras: validação, métricas, datas
        │
        └──usa──▶  db (js/db/*)  ──▶  vendor/idb  ──▶  IndexedDB
```
- Telas **não** acessam IndexedDB direto, só pelas funções de `js/db/*`.
- `js/logica/*` não toca DOM nem banco, por isso é testável no navegador com dados fixos.
- Contrato de tela: `export async function render(container, params)`. Pode devolver uma função de limpeza (ex.: parar o cronômetro da sessão), chamada pelo roteador ao trocar de rota.
- Convenções: identificadores em português sem acento (`exercicio`, `sessao`, `serie`), arquivos em `kebab-case`, textos da interface em pt-BR.

### Estrutura de arquivos
```
treino-app/
├── index.html              # casca única: <header>, <main id="app">, <nav> inferior; carrega js/app.js (module)
├── manifest.webmanifest    # nome, ícones, start_url "./", scope "./", display "standalone", cores
├── sw.js                   # service worker: VERSAO, ARQUIVOS (precache), cache-first, limpeza
├── PROJETO.md              # este documento
├── css/
│   ├── base.css            # reset, variáveis de cor (claro/escuro via prefers-color-scheme), tipografia
│   └── componentes.css     # botões, cards, listas, formulários, stepper, nav, modal, toast, banner
├── js/
│   ├── app.js              # bootstrap: abre DB, registra SW + banner de atualização, storage.persist, inicia roteador
│   ├── roteador.js         # tabela rota → módulo de tela; extrai :id; chama limpeza da tela anterior; marca aba ativa
│   ├── db/
│   │   ├── conexao.js      # openDB('treino', DB_VERSAO) com idb; handlers blocked/blocking
│   │   ├── migracoes.js    # migrações numeradas (1 = criação de todas as stores e índices)
│   │   ├── exercicios.js   # listar/filtrar, salvar, arquivar, apagar (se sem séries)
│   │   ├── treinos.js      # listar, salvar, apagar
│   │   ├── sessoes.js      # iniciar, sessão em andamento, finalizar, descartar/apagar (com séries, 1 transação)
│   │   ├── series.js       # adicionar, editar, apagar; por sessão; por exercício; "última vez"
│   │   ├── meta.js         # get/set de chave-valor (ultimoBackup, localPreferido)
│   │   └── backup.js       # exportar objeto JSON; validar; importar substituindo tudo
│   ├── logica/
│   │   ├── tipos.js        # definição de carga/corpo/tempo: campos, validação, parse (vírgula, mm:ss), formatação
│   │   ├── metricas.js     # pontos de evolução por sessão, 1RM (Epley), volume, recordes
│   │   └── datas.js        # formatação pt-BR, duração, agrupamento por mês
│   ├── ui/
│   │   ├── dom.js          # h(), limpar(), delegação de eventos
│   │   ├── componentes.js  # modal de confirmação, toast, stepper (±), seletor de exercício, chip de local
│   │   ├── grafico.js      # gráfico de linha em SVG (eixo de tempo proporcional, toque mostra valor)
│   │   └── icones.js       # ícones SVG inline
│   └── telas/
│       ├── inicio.js
│       ├── treinos-lista.js
│       ├── treino-form.js
│       ├── exercicios-lista.js
│       ├── exercicio-form.js
│       ├── exercicio-evolucao.js
│       ├── sessao.js
│       ├── historico.js
│       ├── sessao-detalhe.js
│       └── ajustes.js
├── vendor/
│   └── idb/                # arquivos ESM de build/ do pacote idb@8.x + LICENSE (versão anotada num README.txt de 1 linha)
├── icones/
│   ├── icone.svg           # fonte dos ícones
│   ├── icone-192.png
│   ├── icone-512.png
│   ├── icone-maskable-512.png
│   └── apple-touch-icon.png    # 180×180 (iOS)
└── testes/                 # NÃO entra no precache
    ├── index.html          # carrega e roda os testes, mostra verde/vermelho
    ├── mini-teste.js       # teste(nome, fn), igual(a, b), lanca(fn)
    ├── tipos.test.js
    ├── metricas.test.js
    └── backup.test.js      # ida e volta exportar/importar usando um banco separado "treino-teste"
```

---

## 4. Modelo de dados

Banco `treino`, versão 1. Cinco object stores, todas com `keyPath` explícito.

### `exercicios` (keyPath `id`)
| Campo | Tipo | Regra |
|---|---|---|
| `id` | string (UUID) | |
| `nome` | string | obrigatório; único (comparação sem maiúsculas/acentos, validado no app) |
| `tipo` | `'carga' \| 'corpo' \| 'tempo'` | **não pode mudar** se já existir série do exercício (crie outro) |
| `locais` | array de `'casa' \| 'academia'` | ao menos 1; pode ter os dois (decisão aprovada: um exercício pode ser de casa e de academia ao mesmo tempo) |
| `observacoes` | string | opcional |
| `arquivado` | boolean | some das listas e do seletor, mantém o histórico |
| `criadoEm`, `atualizadoEm` | number (ms) | |

Índices: `por_nome` (`nome`), `por_local` (`locais`, **multiEntry**). `arquivado` não é indexável (boolean não é chave IDB): o filtro é feito em memória, já que são poucos registros.

```json
{ "id": "6f1c…", "nome": "Supino reto", "tipo": "carga", "locais": ["academia"],
  "observacoes": "", "arquivado": false, "criadoEm": 1760790000000, "atualizadoEm": 1760790000000 }
```

### `treinos` (keyPath `id`): modelos
| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | |
| `nome` | string | obrigatório |
| `local` | `'casa' \| 'academia'` | filtra o seletor de exercícios |
| `itens` | array `{ exercicioId, series, alvo }` | ordem do array = ordem no treino; `series` inteiro ≥ 1; `alvo` texto livre curto ("8-12", "45s", "até a falha"), só exibido |
| `observacoes` | string | opcional |
| `criadoEm`, `atualizadoEm` | number | |

Índice: `por_nome`. Itens embutidos porque são sempre lidos junto com o treino.

```json
{ "id": "a91b…", "nome": "Treino A, Peito", "local": "academia",
  "itens": [ { "exercicioId": "6f1c…", "series": 4, "alvo": "8-10" },
             { "exercicioId": "c22d…", "series": 3, "alvo": "45s" } ],
  "observacoes": "", "criadoEm": 1760790000000, "atualizadoEm": 1760790000000 }
```

### `sessoes` (keyPath `id`): um treino realizado
| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | |
| `treinoId` | string \| null | null = treino livre |
| `nome` | string | cópia do nome do treino (ou "Treino livre") |
| `local` | `'casa' \| 'academia'` | |
| `itens` | array `{ exercicioId, series, alvo }` | **cópia** dos itens do modelo no início: editar o modelo depois não altera sessões passadas; exercícios avulsos são acrescentados aqui |
| `inicio` | number | |
| `fim` | number \| null | null enquanto em andamento |
| `status` | `'andamento' \| 'concluida'` | no máximo **uma** sessão `andamento` |
| `observacoes` | string | opcional |

Índices: `por_inicio` (`inicio`), `por_status` (`status`).

### `series` (keyPath `id`)
| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | |
| `sessaoId` | string | |
| `exercicioId` | string | |
| `tipo` | string | cópia do tipo do exercício no momento |
| `carga` | number (kg) | só em `carga` |
| `reps` | integer | só em `carga` e `corpo` |
| `segundos` | integer | só em `tempo` |
| `feitaEm` | number | define a ordem das séries |

Índices: `por_sessao` (`sessaoId`), `por_exercicio` (`[exercicioId, feitaEm]`, composto).
Store separada (e não embutida na sessão) porque o histórico e o gráfico consultam **por exercício** via índice, e salvar uma série é um `put` pequeno e imediato.
- Séries de um exercício em ordem: `getAll` em `por_exercicio` com `IDBKeyRange.bound([id, 0], [id, Infinity])`.
- "Última vez": cursor `prev` no mesmo intervalo, pulando a sessão atual e coletando as séries da primeira sessão anterior encontrada.

```json
{ "id": "e3…", "sessaoId": "s7…", "exercicioId": "6f1c…", "tipo": "carga", "carga": 60, "reps": 10, "feitaEm": 1760791200000 }
{ "id": "e4…", "sessaoId": "s7…", "exercicioId": "b0a…",  "tipo": "corpo", "reps": 15, "feitaEm": 1760791500000 }
{ "id": "e5…", "sessaoId": "s7…", "exercicioId": "c22d…", "tipo": "tempo", "segundos": 50, "feitaEm": 1760791800000 }
```

### `meta` (keyPath `chave`)
Chave-valor: `{ "chave": "ultimoBackup", "valor": 1760790000000 }`, `{ "chave": "localPreferido", "valor": "academia" }`.

### Regras por tipo de exercício (`js/logica/tipos.js`)
| Tipo | Campos | Validação | Exibição |
|---|---|---|---|
| `carga` | `carga`, `reps` | carga > 0 e ≤ 1000, até 2 casas decimais, aceita vírgula; reps inteiro 1–100 | `60 kg × 10` |
| `corpo` | `reps` | inteiro 1–500 | `15 reps` |
| `tempo` | `segundos` | inteiro 1–7200; entrada em `ss` ou `m:ss` | `0:50` / `1:30` |

Campos de outro tipo ficam **ausentes** (não `0`). Stepper: carga ±2,5 kg, reps ±1, tempo ±5 s.

### Regras de exclusão
- Exercício com séries: só **arquivar**. Sem séries: pode apagar.
- Treino: pode apagar. As sessões mantêm a cópia (`treinoId` fica órfão, sem problema).
- Sessão: apagar ou descartar remove suas séries na **mesma transação**.

### Cálculo da evolução (`js/logica/metricas.js`, funções puras)
Cada **sessão** com séries do exercício vira **um ponto** do gráfico. Eixo X = `feitaEm` da primeira série da sessão.

| Tipo | Métricas por sessão (seletor no gráfico) | Padrão | Recordes exibidos |
|---|---|---|---|
| `carga` | **Carga máxima** = maior `carga`; **1RM estimado** = maior `carga × (1 + reps/30)` (Epley; reps = 1 → a própria carga; séries com reps > 12 ficam fora do 1RM); **Volume** = Σ `carga × reps` | Carga máxima | maior carga (com reps), maior 1RM est., maior volume numa sessão |
| `corpo` | **Reps máximas** numa série; **Total de reps** na sessão | Reps máximas | máx. reps numa série, máx. total numa sessão |
| `tempo` | **Tempo máximo** numa série; **Tempo total** na sessão | Tempo máximo | máx. tempo numa série, máx. total numa sessão |

Exemplo (`carga`), séries 60×10, 60×8, 65×6:
- carga máx. = **65**
- volume = 600 + 480 + 390 = **1470**
- 1RM = máx(80,0; 76,0; 78,0) = **80,0**

No tipo `carga`, o gráfico abre sempre em **carga máxima** (decisão aprovada); 1RM estimado e volume ficam disponíveis como opção no seletor.

Esse exemplo vira teste em `metricas.test.js`. Valores exibidos com 1 casa decimal. Nada é pré-agregado no banco: o volume de dados de 1 pessoa permite calcular na hora.

---

## 5. Telas da v1

Barra inferior fixa com 5 abas: **Início · Treinos · Exercícios · Histórico · Ajustes**. Layout mobile-first, alvos de toque ≥ 44 px, tema claro/escuro automático.

| Rota | Tela | Propósito e elementos principais | Navega para |
|---|---|---|---|
| `#/` | **Início** | Card "Sessão em andamento · Continuar" (se houver). Chip de local **Casa / Academia** (lembra a última escolha). Lista de treinos daquele local com botão **Iniciar**. Botão **Treino livre**. Últimas 3 sessões. Aviso de backup atrasado. | Sessão, Detalhe de sessão, Ajustes |
| `#/treinos` | **Treinos** | Lista de modelos (nome, local, nº de exercícios), botão **+ Novo**, **Iniciar** em cada um. | Editar treino, Sessão |
| `#/treinos/novo`, `#/treinos/:id` | **Editar treino** | Nome, local, lista de itens (exercício, séries, alvo) com ↑ ↓ para reordenar e remover. **+ Adicionar exercício** abre o seletor (filtrado pelo local, com busca e opção "mostrar todos"). Salvar / Apagar. | Treinos |
| `#/exercicios` | **Exercícios** | Busca, filtro Todos / Casa / Academia, selo do tipo, opção "mostrar arquivados", botão **+ Novo**. | Evolução, Editar exercício |
| `#/exercicios/novo`, `#/exercicios/:id/editar` | **Editar exercício** | Nome, tipo (rádio, travado se já há séries, com explicação), locais (checkbox), observações. Salvar / Arquivar / Apagar (se sem séries). | Exercícios / Evolução |
| `#/exercicios/:id` | **Evolução do exercício** | Gráfico SVG com seletor de métrica (conforme o tipo), cartões de recordes, lista de sessões com as séries de cada uma (histórico do exercício). Botão Editar. | Detalhe de sessão, Editar exercício |
| `#/sessao/:id` | **Sessão em andamento** | Cabeçalho com nome e tempo decorrido. Um card por exercício: alvo ("4 × 8-10"), "Última vez: 60 kg × 10, 60 × 8", séries já feitas (toque edita/apaga) e o formulário da próxima série **pré-preenchido** (última série desta sessão, senão da última vez), com campos e steppers conforme o tipo, botão **+ Série** (salva na hora). **+ Exercício** avulso (não altera o modelo). **Finalizar** (confirmação) / **Descartar** (confirmação). | Detalhe de sessão (como resumo) |
| `#/historico` | **Histórico** | Sessões concluídas, mais recentes primeiro, agrupadas por mês (data, nome, duração, nº de séries). Link "Evolução por exercício" para a aba Exercícios. | Detalhe de sessão |
| `#/historico/:id` | **Detalhe de sessão** | Data, duração, local, exercícios com suas séries, volume total. Editar/apagar séries, adicionar série esquecida, apagar sessão. Também serve de **resumo** ao finalizar. | Evolução do exercício |
| `#/ajustes` | **Ajustes** | Exportar backup, Importar backup (com prévia e confirmação), data do último backup, armazenamento persistente (sim/não) e uso (`storage.estimate`), versão do app, "Procurar atualização". | n/a |

Componentes compartilhados: modal de confirmação (não usar `confirm()`), toast, seletor de exercício (modal com busca), stepper, banner de atualização.

---

## 6. Etapas de construção

Ordem pensada para ter o **ciclo principal (exercício → treino → sessão) usável no celular cedo**. Assim os dados reais vão se acumulando enquanto histórico e gráficos são construídos. Cada etapa termina com algo verificável.

1. **Esqueleto estático**. Objetivo: `index.html`, `css/base.css`, `css/componentes.css`, `js/app.js` com a barra de 5 abas. Pronto quando: `npx http-server -p 8080 -c-1` serve o app, sem erros no console, e o layout fica correto no modo celular do DevTools (claro e escuro).
2. **Roteador hash + telas placeholder**. Objetivo: `roteador.js`, `ui/dom.js` (`h()`) e 10 telas com título. Pronto quando: tocar nas abas muda a URL e o conteúdo, a aba ativa fica marcada, o botão voltar funciona, `#/exercicios/123` recebe `id = 123` e uma rota inexistente cai no Início.
3. **Testes no navegador + `logica/tipos.js`**. Objetivo: `testes/mini-teste.js`, `testes/index.html`, validação/parse/formatação dos 3 tipos. Pronto quando: `/testes/` mostra tudo verde, cobrindo "62,5" → 62.5, "1:30" → 90 s, reps 0 rejeitado, campo de outro tipo rejeitado.
4. **IndexedDB + migração 1**. Objetivo: vendorizar `idb`, `db/conexao.js`, `db/migracoes.js`, `db/meta.js`. Pronto quando: DevTools › Application › IndexedDB mostra `treino` v1 com as 5 stores e todos os índices, e recarregar não dá erro nem duplica nada.
5. **Exercícios (CRUD)**. Objetivo: `db/exercicios.js`, telas Exercícios e Editar exercício, filtro por local, busca, arquivar. Pronto quando: criar, editar e arquivar funcionam e persistem após recarregar, nome vazio/duplicado e "sem local" são bloqueados, e o filtro Casa/Academia lista certo.
6. **Treinos (CRUD)**. Objetivo: `db/treinos.js`, telas Treinos e Editar treino, seletor de exercício, reordenar ↑ ↓. Pronto quando: montar um treino com 4 exercícios, reordenar, salvar e reabrir mostra tudo igual, e o seletor respeita o local.
7. **Sessão: iniciar e registrar séries**. Objetivo: `db/sessoes.js`, `db/series.js`, tela Sessão (campos por tipo, steppers, salvar na hora, editar/apagar série), card "Continuar" no Início. Pronto quando: iniciar pelo treino, registrar séries dos 3 tipos, **fechar a aba e reabrir** mostra "Continuar" com tudo salvo, e iniciar uma segunda sessão é impedido (oferece continuar).
8. **Sessão: completa**. Objetivo: "Última vez" + pré-preenchimento, exercício avulso, treino livre, finalizar/descartar com confirmação, resumo (Detalhe de sessão em modo leitura). Pronto quando: um treino inteiro sai do início ao resumo, a segunda sessão do mesmo treino mostra "Última vez" correto, e descartar apaga as séries.
9. **Backup**. Objetivo: `db/backup.js`, exportar/importar em Ajustes, `testes/backup.test.js`. Pronto quando: exportar, apagar o banco pelo DevTools e importar restaurar tudo; um arquivo inválido ou de outro app ser recusado com mensagem; e o teste de ida e volta passar. *(Antes do uso real, de propósito.)*
10. **Manifest + ícones**. Objetivo: `manifest.webmanifest`, ícones 192/512/maskable/apple-touch, metas no `index.html`. Pronto quando: DevTools › Application › Manifest não mostra erros e o Chrome do PC oferece "Instalar".
11. **Service worker**. Objetivo: `sw.js` com `VERSAO`, `ARQUIVOS`, precache, cache-first, limpeza no `activate`. Pronto quando: com DevTools em Offline, recarregar abre o app e **todas** as telas funcionam; Cache Storage mostra só `treino-v1` com todos os arquivos; mudar para `v2` apaga o `v1`.
12. **Fluxo de atualização**. Objetivo: banner "Nova versão disponível" + `SKIP_WAITING` + recarregar no `controllerchange`. Pronto quando: alterar um arquivo e a `VERSAO`, e o app aberto mostrar o banner; tocar atualiza sem perder a sessão em andamento.
13. **Publicar e instalar no celular**. Objetivo: publicar no GitHub Pages (endereço definitivo, não muda depois), `storage.persist()` na primeira abertura, instalar. Pronto quando: o app está instalado na tela inicial, abre em **modo avião** e registra uma sessão real. A partir daqui, uso real.
14. **Histórico**. Objetivo: telas Histórico e Detalhe de sessão com edição (editar/apagar série, adicionar série esquecida, apagar sessão). Pronto quando: as sessões aparecem agrupadas por mês, e as edições persistem e se refletem na tela da sessão.
15. **Métricas**. Objetivo: `logica/metricas.js` + `testes/metricas.test.js`. Pronto quando: os testes passam, incluindo o exemplo da seção 4, reps > 12 fora do 1RM, sessão sem séries do exercício ignorada, e os 3 tipos.
16. **Gráfico SVG**. Objetivo: `ui/grafico.js` testado numa página com dados fixos. Pronto quando: renderiza com 0 pontos (mensagem), 1 ponto e 200 pontos; o eixo de datas é proporcional; tocar num ponto mostra data e valor; fica legível nos temas claro e escuro e a 360 px de largura.
17. **Tela de evolução do exercício**. Objetivo: gráfico + seletor de métrica + recordes + lista de sessões. Pronto quando: com dados reais, os valores do gráfico e dos recordes conferem com um cálculo manual de 2 sessões.
18. **Ajustes completos + lembrete de backup**. Objetivo: status de armazenamento persistente, uso, versão, "Procurar atualização", aviso no Início após 7 dias sem backup. Pronto quando: tudo aparece certo no celular instalado e o aviso some depois de exportar.
19. **Revisão da v1**. Objetivo: passar a lista do `ARQUIVOS` contra a árvore real, conferir acessibilidade (rótulos, contraste, alvos de toque), corrigir o que o uso real mostrou. Pronto quando: uma semana de treinos registrada só pelo celular offline, sem erro no console, com um backup exportado pelo celular e restaurado no PC.

---

## 7. Fora do escopo da v1

**Explicitamente fora:** sugestão de aumento de carga · contador de reps pela câmera · contas de usuário/sincronização/servidor.

**Ideias futuras:**
- Cronômetro embutido para exercícios de tempo e timer de descanso entre séries (com vibração).
- Manter a tela ligada durante a sessão (Screen Wake Lock API).
- Destacar recordes batidos no resumo da sessão.
- Lastro/assistência em exercícios de peso do corpo (ex.: barra com colete).
- Grupo muscular, filtro por grupo e volume semanal por grupo.
- Filtro de período no gráfico (3 meses / 1 ano / tudo); trocar para uPlot se precisar de zoom.
- Importar com mesclagem; exportar CSV.
- Exercícios pré-cadastrados de exemplo.
- Suporte a lb.
- Sugestão de carga (progressão) e contador pela câmera (já citados).

---

## 8. Design aprovado

### Identidade "Brasa" (tema escuro)

| Uso | Cor |
|---|---|
| Fundo | `#0D0D0F` |
| Cartões | `#17171A` |
| Bordas | `#2A2A30` |
| Texto | `#F3F0EA` |
| Texto secundário | `#9A979F` |
| Destaque (laranja) | `#F2783C` |
| Texto sobre o laranja | `#1A0E06` |
| Fundo de aviso | `#2A1A10` |

- **Fontes:** Barlow Condensed (títulos e números grandes) e Manrope (texto). Os arquivos das fontes ficam **dentro do projeto**, para funcionar offline.
- **Botões:** cantos bem arredondados; áreas de toque de no mínimo **44 px**.

### Telas aprovadas
1. **Hoje:** calendário da semana (dias treinados em laranja), objetivo atual, card do treino do dia com botão grande **"Começar treino"**, próximo nível da trilha e recorde da semana.
2. **Trilhas:** escolha da trilha no topo; caminho vertical com níveis concluídos, nível atual com anel de progresso, meta e "seu melhor", e níveis bloqueados.
3. **Treino em andamento:** calendário da semana; barra de progresso dos exercícios; botão **"Como fazer"**, que abre ilustração, 3 passos e erro comum; tabela de séries com "antes", "hoje" e +1; contador grande de reps com − e +.
4. **Descanso:** anel com cronômetro, −15 s, +15 s e **"Pular descanso"**; volta sozinho para a série quando zera.
5. **Fim do treino:** resumo e recuperação por grupo muscular (quando cada um volta a estar pronto), com sugestão do próximo treino.

### Decisões em aberto
- Regra de horas de recuperação por grupo muscular.
- Como fazer as ilustrações dos exercícios.

### Ajustes pendentes no plano
- Seção 2 (Fontes e ícones): o plano usa fonte do sistema; o design usa Barlow Condensed e Manrope em `.woff2` dentro do projeto.
- Seções 2, 3 e 5: o plano prevê tema claro/escuro automático (`prefers-color-scheme`); o design aprovado é só tema escuro.
- Seção 5: telas e abas da v1 (Início, Treinos, Exercícios, Histórico, Ajustes) não batem com as telas aprovadas (Hoje, Trilhas, Treino em andamento, Descanso, Fim do treino); o mesmo vale para `js/telas/` na seção 3 e para as etapas da seção 6.
- Seção 4: o modelo de dados não tem trilhas, níveis, objetivo, grupo muscular nem recuperação.
- Seção 7: timer de descanso está em "ideias futuras", mas a tela Descanso foi aprovada.
- Seção 7: grupo muscular está em "ideias futuras", mas o Fim do treino mostra recuperação por grupo muscular.
- Seção 7: destacar recordes está em "ideias futuras", mas a tela Hoje mostra o recorde da semana.
- Seção 7: sugestão de aumento de carga está fora da v1; confirmar se a coluna "+1" da tabela de séries é uma sugestão de progressão.
- Seção 3: a estrutura de arquivos não prevê as ilustrações dos exercícios (do "Como fazer").

---

## 9. Estado atual

- **Feito:** planejamento da v1 **aprovado** pelo usuário (este arquivo, versionado em git). **Nenhuma etapa de código foi iniciada.**
- **Feito:** **Fase 1 da biblioteca de exercícios** concluída: `pesquisa/calistenia.md` (47 exercícios, 12 trilhas) e `pesquisa/academia.md` (86 exercícios).
- **Feito:** **Fase 2a** concluída: execuções revisadas (cerca de 30 correções) e lacunas preenchidas (costas em casa, parada de mão a partir da parede, mergulho com cadeira encostada na parede, adutores, panturrilha e antebraço). Agora `pesquisa/calistenia.md` tem 62 exercícios em 13 trilhas e `pesquisa/academia.md` tem 95 exercícios.
- **Feito:** **design aprovado** registrado (seção 8: identidade "Brasa" e 5 telas).
- **Próximo:** **Fase 2b**: JSON dos exercícios + as 12 rotinas. **Aguardando aprovação.**
- **Próxima etapa de código:** **1. Esqueleto estático.**
- **Pendente:** verificar se o Fable 5.1 está disponível com `/model`, porque o uso mostrou só Opus e Haiku.
- **Pendente:** definir a regra de horas de recuperação por grupo muscular.
- **Pendente:** definir como fazer as ilustrações dos exercícios.
- **Pendente:** resolver os "Ajustes pendentes no plano" listados na seção 8.

### Decisões tomadas
- **Objetivo do treino:** escolhido no app entre **ganhar massa**, **força e habilidades** e **condicionamento geral**. Pode ser trocado a qualquer hora, e trocar o objetivo troca a rotina.
- **Rotinas prontas:** haverá **12** (3 objetivos × 3 ou 4 dias por semana × casa ou academia).
- **Celular:** Android (testes e instalação pelo Chrome).
- **Hospedagem:** GitHub Pages. O endereço é **fixo e não deve mudar depois**, porque os dados do IndexedDB ficam presos ao domínio (trocar de endereço = banco vazio, só recuperável por backup).
- **Locais do exercício:** um exercício pode ser de **casa e de academia ao mesmo tempo**.
- **Gráfico de carga:** mostra a **carga máxima** por padrão; o **1RM estimado** fica como opção no seletor de métrica.

### Checklist
- [ ] 1. Esqueleto estático
- [ ] 2. Roteador hash + telas placeholder
- [ ] 3. Testes no navegador + `logica/tipos.js`
- [ ] 4. IndexedDB + migração 1
- [ ] 5. Exercícios (CRUD)
- [ ] 6. Treinos (CRUD)
- [ ] 7. Sessão: iniciar e registrar séries
- [ ] 8. Sessão: completa
- [ ] 9. Backup
- [ ] 10. Manifest + ícones
- [ ] 11. Service worker
- [ ] 12. Fluxo de atualização
- [ ] 13. Publicar e instalar no celular
- [ ] 14. Histórico
- [ ] 15. Métricas
- [ ] 16. Gráfico SVG
- [ ] 17. Tela de evolução do exercício
- [ ] 18. Ajustes completos + lembrete de backup
- [ ] 19. Revisão da v1
