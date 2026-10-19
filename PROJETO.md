# Treino: projeto da v1

App pessoal de treino de musculação/calistenia. PWA instalável no celular (Android), 100% offline, uso por uma única pessoa, dados só no aparelho.

---

## 1. Visão geral

**O que a v1 faz**
- **Biblioteca de exercícios** somente leitura, vinda de `dados/` (165 exercícios de casa e de academia). Cada exercício tem "Como fazer": espaço reservado para a ilustração, 3 passos e o erro comum.
- **Trilhas de níveis** (15 trilhas: 13 de calistenia e 2 de academia, barra fixa e paralelas): nível atual, meta, "seu melhor" e avanço automático ao bater a meta.
- **Rotina e treino do dia**: o usuário escolhe uma das 12 rotinas prontas numa lista, e o Hoje mostra o treino do dia.
- **Treino em andamento**: tabela de séries "antes / hoje / +1" e contador grande de reps. Cada série é salva na hora (fechar o app não perde nada).
- **Cronômetro de descanso** entre as séries.
- **Histórico** de treinos e **gráfico de evolução** por exercício.
- **Backup**: exportar/importar JSON (os dados existem só no aparelho).
- **Instalável no Android** (GitHub Pages).

**O que a v1.1 acrescenta**
- **Escolha de objetivo** (ganhar massa · força e habilidades · condicionamento geral) com troca automática entre as 12 rotinas.
- **Fim do treino** com recuperação por grupo muscular. Usa os grupos que cada série já grava desde a v1.
- **Montar treinos** próprios com exercícios da biblioteca (que continua somente leitura).

**Princípios**
- Offline primeiro: nenhuma requisição externa. Fontes, ícones, dados e bibliotecas ficam dentro do projeto.
- Dois tipos de dado: o **catálogo** (`dados/*.json`, somente leitura, vem junto com o app) e os **dados do usuário** (IndexedDB, única fonte da verdade do que o usuário fez). O catálogo é carregado uma vez e congelado. Fora isso, não há estado global em memória: cada tela relê o banco ao renderizar.
- Simples de manter: sem etapa de build, edita, salva e recarrega.

---

## 2. Decisão de tecnologia

**Decisão: HTML, CSS e JavaScript puro, sem framework (concordo com a recomendação).**

Motivos:
- O app é pequeno (cerca de 10 telas, 4 stores de dados, 1 usuário). Um framework resolveria problemas de escala e equipe que este projeto não tem.
- Sem build, o que roda no celular é exatamente o código-fonte. Isso facilita depurar e manter por anos sem dependências quebrando.
- Offline fica trivial: o service worker guarda arquivos estáticos e nada mais.
- Tamanho esperado: menos de 150 KB de código sem minificar; com fontes e `dados/`, menos de 500 KB.

Risco conhecido: atualizar o DOM à mão fica trabalhoso em telas interativas (a tela de treino). Mitigação: um helper `h()` para criar elementos e o padrão "cada tela tem `render()` e redesenha o trecho que mudou". **Quando reconsiderar:** se a tela de treino ficar difícil de manter, vendorizar **Preact + htm** (cerca de 5 KB, arquivos ESM, continua sem build). Não é necessário na v1.

Alternativas descartadas: React/Vue/Svelte com Vite (exigem build e toolchain Node para um ganho pequeno aqui); Lit (Web Components não trazem vantagem para 1 app de 1 pessoa).

### Decisões técnicas

| Tema | Decisão | Motivo |
|---|---|---|
| Módulos | **ES modules nativos** (`<script type="module">`), sem bundler | Todos os navegadores móveis atuais suportam. Muitos arquivos pequenos não custam nada com o cache do SW. Custo: listar os arquivos no precache à mão. |
| Wrapper do IndexedDB | **`idb` (Jake Archibald) vendorizado** em `vendor/idb/` | Cerca de 4 KB, ESM, testado em produção. Resolve com promises o `upgradeneeded`, o `blocked` e o fim de transação, que é onde um wrapper feito à mão costuma errar. Fica isolado em `js/db/`: trocar depois é barato. |
| Catálogo | `dados/*.json` lidos por `fetch` (servidos pelo cache do SW), validados e congelados em memória por `js/catalogo.js`. **Não** vão para o IndexedDB. | São do app, não do usuário: só mudam com deploy. Copiá-los para o banco exigiria sincronizar a cada versão. |
| Gráfico | **SVG próprio** (`js/ui/grafico.js`, cerca de 150 linhas) | Só um tipo: linha com pontos no tempo, dezenas a centenas de pontos. SVG escala com `viewBox`, pega as cores do tema via variáveis CSS e permite tocar no ponto para ver o valor. Zero dependência. Se um dia precisar de zoom ou muitas séries: uPlot vendorizado. |
| Renderização | Helper `h(tag, attrs, ...filhos)` cria nós DOM; dados **nunca** entram via `innerHTML` | Sem risco de injeção e sem template engine. |
| Tema | **Só escuro** (identidade "Brasa", seção 8). `color-scheme: dark`, cores em variáveis CSS, sem `prefers-color-scheme` | Design aprovado. |
| Fontes e ícones | **Barlow Condensed** (600 e 700: títulos e números grandes) e **Manrope** (400 e 700: texto) em `.woff2` dentro de `fonts/`, subconjunto latin, com a licença OFL junto. `font-display: swap`, no precache. Ícones SVG inline. | Design aprovado; arquivos locais funcionam offline. |
| Roteamento | **Hash** (`#/biblioteca/flexao-no-chao`) | Funciona em qualquer hospedagem estática (inclusive subpasta do GitHub Pages) sem regra de rewrite. O SW só precisa servir `index.html`. |
| IDs | Dados do usuário: `crypto.randomUUID()`. Catálogo: ids legíveis em kebab-case, **permanentes** (seção 4.1). | UUID exige contexto seguro, que a PWA já exige. |
| Datas | Epoch em ms (`number`) | Ordenáveis em índice. Exibição com `Intl.DateTimeFormat('pt-BR')`. Semana de segunda a domingo. |
| Entrada numérica | `<input type="text" inputmode="decimal">` + parse que aceita vírgula | `type="number"` se comporta mal com vírgula decimal em teclados pt-BR. |
| Unidade | Só **kg** na v1 | Simplicidade. |

### Service worker e versionamento de cache
- `sw.js` na **raiz** (escopo cobre o app inteiro), com uma constante `VERSAO = 'v1'` e uma lista `ARQUIVOS` com **todos** os arquivos do app (HTML, CSS, JS, vendor, fontes, `dados/*.json`, ícones, manifest). `pesquisa/` e `testes/` ficam fora.
- `install`: `cache.addAll(ARQUIVOS)` no cache `treino-${VERSAO}`, com `cache: 'reload'` para não pegar cópia velha do cache HTTP.
- `activate`: apaga caches `treino-*` diferentes do atual.
- `fetch`: **cache-first** para GET do próprio domínio. Navegações (`mode: 'navigate'`) recebem `index.html` do cache.
- Atualização: o SW novo **não** usa `skipWaiting` automático. O app detecta o SW em `waiting` e mostra o banner "Nova versão disponível · Atualizar". O toque envia `postMessage('SKIP_WAITING')` e o app recarrega no `controllerchange`. Assim a página não recarrega no meio de uma série. Mesmo se recarregar, o treino está no banco.
- **Regra de ouro:** todo deploy incrementa `VERSAO`, e todo arquivo novo entra em `ARQUIVOS`. Mudança em `dados/` também incrementa `versaoDados` (seção 4.1). A versão do app e a dos dados aparecem em Ajustes.
- Em desenvolvimento: DevTools › Application › Service workers › marcar "Update on reload" (ou "Bypass for network").

### Migrações do schema (IndexedDB)
- `js/db/migracoes.js` exporta uma lista ordenada: `{ 1: fn, 2: fn, ... }`. `DB_VERSAO` = maior chave.
- No `upgrade(db, versaoAntiga, versaoNova, tx)` do `idb`, roda `migracoes[v]` para cada `v` de `versaoAntiga + 1` até `versaoNova`, em ordem, na mesma transação de upgrade.
- Migrações publicadas **nunca são editadas**, só acrescentadas. Uma mudança de dados (ex.: preencher um campo novo) é feita na migração com cursor sobre o `tx`.
- `blocking` (outra aba/janela com versão antiga): fecha a conexão e mostra "Recarregue o app". `blocked`: mostra aviso "Feche outras abas do app".
- A versão do **banco** é independente da versão dos **dados** do catálogo (seção 4.2, "Versões").

### Backup (exportar/importar JSON)
- **Exportar**: lê todas as stores e gera `treino-backup-AAAA-MM-DD.json`:
  `{ "app": "treino-app", "formato": 1, "versaoDb": 1, "versaoDados": 1, "exportadoEm": 1760790000000, "dados": { "sessoes": [...], "series": [...], "trilhas": [...], "meta": [...] } }`
  No celular usa `navigator.share({ files })` quando disponível (permite salvar no Drive/Arquivos). Fora disso, download por `<a download>`. Grava `meta.ultimoBackup`.
- **Importar**: escolhe o arquivo, valida (`app`, `formato <= atual`, arrays presentes, cada registro passa na validação do seu tipo, todo `exercicioId`/`trilhaId` existe no catálogo), mostra prévia ("80 treinos, 1.900 séries, 5 trilhas em andamento") e pede confirmação. Então **substitui tudo** numa única transação sobre todas as stores (atômico: se falhar, nada muda). Mesclar fica fora da v1.
- `formato` é independente de `versaoDb`. Se o formato mudar, o importador converte formatos antigos antes de gravar.
- Lembrete no Hoje se o último backup tiver mais de 7 dias.
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
telas (js/telas/*)  ──usa──▶  ui (js/ui/*)          componentes, gráfico, anel, h()
        │
        ├──usa──▶  logica (js/logica/*)             funções puras: tipos, comparação, trilhas, rotina, métricas, validação
        │
        ├──usa──▶  catalogo (js/catalogo.js)  ──▶  dados/*.json (somente leitura)
        │
        └──usa──▶  db (js/db/*)  ──▶  vendor/idb  ──▶  IndexedDB (dados do usuário)
```
- Telas **não** acessam IndexedDB direto, só pelas funções de `js/db/*`; e só leem o catálogo por `js/catalogo.js`.
- `js/logica/*` não toca DOM, banco nem `fetch`: recebe catálogo e registros como parâmetros, por isso é testável no navegador com dados fixos.
- Contrato de tela: `export async function render(container, params)`. Pode devolver uma função de limpeza (ex.: parar o cronômetro do descanso), chamada pelo roteador ao trocar de rota.
- Convenções: identificadores em português sem acento (`exercicio`, `sessao`, `serie`, `trilha`), arquivos em `kebab-case`, textos da interface em pt-BR.

### Estrutura de arquivos
```
treino-app/
├── index.html              # casca única: <header>, <main id="app">, <nav> inferior (4 abas); carrega js/app.js (module)
├── manifest.webmanifest    # nome, ícones, start_url "./", scope "./", display "standalone", cores #0D0D0F
├── sw.js                   # service worker: VERSAO, ARQUIVOS (precache), cache-first, limpeza
├── PROJETO.md              # este documento
├── CLAUDE.md               # regras de trabalho
├── pesquisa/               # fonte da Fase 2b (NÃO entra no precache)
│   ├── calistenia.md
│   └── academia.md
├── dados/                  # catálogo somente leitura, gerado na Fase 2b (formato na seção 4.1)
│   ├── exercicios.json
│   ├── progressoes.json
│   └── rotinas.json
├── fonts/
│   ├── barlow-condensed-600.woff2
│   ├── barlow-condensed-700.woff2
│   ├── manrope-400.woff2
│   ├── manrope-700.woff2
│   └── OFL.txt             # licença das duas fontes
├── css/
│   ├── base.css            # reset, @font-face, variáveis de cor "Brasa" (só escuro), tipografia
│   └── componentes.css     # botões, cards, listas, stepper, contador, tabela de séries, anel, nav, modal, toast, banner
├── js/
│   ├── app.js              # bootstrap: carrega catálogo, abre DB, concilia versaoDados, registra SW + banner, storage.persist, inicia roteador
│   ├── roteador.js         # tabela rota → módulo de tela; extrai :id; chama limpeza da tela anterior; marca aba ativa
│   ├── catalogo.js         # fetch dos 3 JSON, validarDados(), Object.freeze, mapas por id (exercício, trilha, trilha do exercício, rotina)
│   ├── db/
│   │   ├── conexao.js      # openDB('treino', DB_VERSAO) com idb; handlers blocked/blocking
│   │   ├── migracoes.js    # migrações numeradas (1 = criação das 4 stores e índices)
│   │   ├── sessoes.js      # iniciar, em andamento, descanso, finalizar (com avanço de trilha, 1 transação), descartar/apagar (com séries)
│   │   ├── series.js       # adicionar, editar, apagar; por sessão; por exercício; "última vez"
│   │   ├── trilhas.js      # ler progresso, avançar nível, definir nível manualmente, conciliar com versaoDados
│   │   ├── meta.js         # get/set de chave-valor
│   │   └── backup.js       # exportar objeto JSON; validar; importar substituindo tudo
│   ├── logica/
│   │   ├── tipos.js        # carga/corpo/tempo: campos, validação, parse (vírgula, m:ss), formatação
│   │   ├── validar-dados.js # regras dos 3 JSON (seção 4.1)
│   │   ├── rotina.js       # treino do dia, resolver item de trilha para o nível atual
│   │   ├── comparacao.js   # tabela antes / hoje / +1, pré-preenchimento
│   │   ├── trilhas.js      # pontuação, progresso, "seu melhor", meta batida (seção 4.3)
│   │   ├── metricas.js     # pontos de evolução por sessão, 1RM (Epley), volume, recordes, recorde da semana
│   │   └── datas.js        # formatação pt-BR, duração, semana seg–dom, agrupamento por mês
│   ├── ui/
│   │   ├── dom.js          # h(), limpar(), delegação de eventos
│   │   ├── componentes.js  # modal de confirmação, toast, stepper (±), contador grande, seletor de exercício, "Como fazer"
│   │   ├── semana.js       # calendário da semana (dias treinados em laranja)
│   │   ├── anel.js         # anel de progresso em SVG (Trilhas e Descanso)
│   │   ├── grafico.js      # gráfico de linha em SVG (eixo de tempo proporcional, toque mostra valor)
│   │   └── icones.js       # ícones SVG inline
│   └── telas/
│       ├── hoje.js
│       ├── trilhas.js
│       ├── treino.js               # treino em andamento, com o modo Descanso
│       ├── evolucao.js             # histórico de treinos + lista de exercícios feitos
│       ├── sessao-detalhe.js       # detalhe/resumo de um treino
│       ├── exercicio-evolucao.js   # gráfico e recordes de um exercício
│       ├── biblioteca.js
│       ├── exercicio-detalhe.js
│       └── ajustes.js
├── vendor/
│   └── idb/                # arquivos ESM de build/ do pacote idb@8.x + LICENSE (versão anotada num README.txt de 1 linha)
├── icones/
│   ├── icone.svg           # fonte dos ícones
│   ├── icone-192.png
│   ├── icone-512.png
│   ├── icone-maskable-512.png
│   └── apple-touch-icon.png    # 180×180
└── testes/                 # NÃO entra no precache
    ├── index.html          # carrega e roda os testes, mostra verde/vermelho
    ├── mini-teste.js       # teste(nome, fn), igual(a, b), lanca(fn)
    ├── tipos.test.js
    ├── dados.test.js       # os JSON reais passam; um caso quebrado por regra é recusado
    ├── rotina.test.js
    ├── comparacao.test.js
    ├── trilhas.test.js
    ├── metricas.test.js
    └── backup.test.js      # ida e volta exportar/importar usando um banco separado "treino-teste"
```
Ilustrações: na v1 não há arquivos de imagem; o campo `imagem` do catálogo é `null` e o "Como fazer" mostra um espaço reservado. Quando o método for decidido, as imagens irão para `img/exercicios/<id>.<ext>` (e entram no precache).

v1.1 acrescenta: `js/logica/recuperacao.js`, `js/telas/objetivo.js`, `js/telas/fim-treino.js`, `testes/recuperacao.test.js`, e os arquivos de montar treinos (definidos na etapa 28).

---

## 4. Modelo de dados

### 4.1 Catálogo (somente leitura): `dados/*.json`

**Regras gerais**
- Gerados na **Fase 2b** a partir de `pesquisa/`. UTF-8, JSON puro, sem comentários.
- Os 3 arquivos têm `"versaoDados"` (inteiro ≥ 1), **igual nos 3**. Qualquer mudança de conteúdo incrementa o número nos 3 arquivos (e a `VERSAO` do SW).
- ids em kebab-case sem acento (`^[a-z0-9]+(-[a-z0-9]+)*$`), únicos no seu arquivo. **Permanentes**: um id publicado nunca muda nem sai, porque séries e progresso apontam para ele. Para tirar um exercício de uso: `"descontinuado": true`.
- Campos fora das tabelas são proibidos (pega erro de digitação). Textos não podem ser vazios.

#### `dados/exercicios.json`
Raiz: `{ "versaoDados": 1, "grupos": [...], "exercicios": [...] }`

`grupos` é o vocabulário fixo de grupos musculares (`{ "id", "nome" }`, nesta ordem de exibição):
`peito` Peito · `costas` Costas · `ombros` Ombros · `biceps` Bíceps · `triceps` Tríceps · `antebraco` Antebraço · `core` Core · `lombar` Lombar · `quadriceps` Quadríceps · `posterior` Posterior de coxa · `gluteos` Glúteos · `adutores` Adutores · `panturrilha` Panturrilha.

Cada exercício:

| Campo | Tipo e valores | Obrig. | Regra / origem na pesquisa |
|---|---|---|---|
| `id` | string | sim | campo `id` |
| `nome` | string | sim | campo `nome` (calistenia) ou título `###` (academia) |
| `tipo` | `"carga"` \| `"corpo"` \| `"tempo"` | sim | "peso do corpo" → `"corpo"` |
| `locais` | array de `"casa"` / `"academia"` | sim | 1 ou 2 itens, sem repetir; "ambos" → `["casa", "academia"]`. Derivado de `equipamento`: nenhum (ou só parede/chão) → ambos; só objetos de casa (cadeira, mesa, mochila, toalha, garrafas, almofada, degrau etc.) → `["casa"]`; qualquer equipamento de academia (barra fixa, barras paralelas, gráviton, halteres, kettlebell, barra, anilhas, máquinas, polia, smith, banco) → `["academia"]`, mesmo se misturado com objeto de casa. Exceção decidida pelo usuário: `flexao-parada-de-mao-parede` → ambos (ver "Regra de local" na seção 9) |
| `nivel` | inteiro 1–5 | sim | dificuldade (não é a posição na trilha) |
| `equipamento` | array de string | sim | texto livre, separado nas vírgulas; "nenhum" → `[]` |
| `musculos` | array de string | sim | texto da pesquisa, principal primeiro (só exibição) |
| `grupos` | array de ids do vocabulário | sim | ≥ 1, sem repetir, principal primeiro; derivado de `musculos` pelo mapeamento abaixo |
| `passos` | array de string | sim | **exatamente 3** |
| `erroComum` | string | sim | texto da pesquisa, primeira letra maiúscula |
| `imagem` | string \| `null` | sim | `null` na v1 (espaço reservado); depois, caminho relativo (`img/exercicios/<id>.webp`) |
| `descontinuado` | boolean | não | ausente = `false`; some da Biblioteca e não pode estar em trilha nem em rotina |

Mapeamento músculo → grupo (Fase 2b): peitoral (qualquer porção) → `peito`; dorsais, grande dorsal, romboides, trapézio (qualquer porção) → `costas`; deltoides, "ombros", "posterior de ombro" → `ombros`; bíceps, braquial → `biceps`; tríceps → `triceps`; braquiorradial, punho, dedos, pegada, antebraço → `antebraco`; abdômen, reto abdominal, oblíquos, transverso, serrátil, flexores do quadril, core → `core`; lombar → `lombar`; quadríceps → `quadriceps`; posterior de coxa, isquiotibiais → `posterior`; glúteos (máximo, médio, mínimo) → `gluteos`; adutores → `adutores`; panturrilha, gastrocnêmio, sóleo → `panturrilha`.

```json
{ "versaoDados": 1,
  "grupos": [ { "id": "peito", "nome": "Peito" }, { "id": "costas", "nome": "Costas" } ],
  "exercicios": [
    { "id": "flexao-na-parede", "nome": "Flexão na parede", "tipo": "corpo",
      "locais": ["casa", "academia"], "nivel": 1, "equipamento": ["parede"],
      "musculos": ["peitoral", "tríceps", "ombros"], "grupos": ["peito", "triceps", "ombros"],
      "passos": [ "Apoie as mãos na parede, na altura dos ombros, um pouco mais afastadas que os ombros.",
                  "Afaste os pés até o corpo ficar em linha reta da cabeça aos calcanhares.",
                  "Dobre os cotovelos aproximando o peito da parede e empurre de volta." ],
      "erroComum": "Deixar o quadril cair ou empinar.", "imagem": null } ] }
```

#### `dados/progressoes.json`
Raiz: `{ "versaoDados": 1, "trilhas": [...] }`. A ordem do array é a ordem de exibição (a mesma de `pesquisa/calistenia.md`).

| Campo | Tipo e valores | Obrig. | Regra |
|---|---|---|---|
| trilha `id` | string | sim | kebab-case do nome (ex. `flexoes`, `core-prancha`) |
| trilha `nome` | string | sim | nome da trilha na pesquisa |
| trilha `niveis` | array de nível | sim | ≥ 2; ordem = posição na trilha (nível 1 = primeiro item) |
| nível `exercicio` | id de exercício | sim | existe e não é descontinuado |
| nível `meta.series` | inteiro 1–5 | sim | |
| nível `meta.reps` | inteiro 1–50 | se o exercício é `corpo` ou `carga` | em `carga`, qualquer carga conta (mochila e garrafas variam) |
| nível `meta.segundos` | inteiro 5–300 | se o exercício é `tempo` | |

`meta` tem exatamente `series` + (`reps` **ou** `segundos`). Exercício unilateral: o valor é por lado. Os valores das metas são propostos na Fase 2b e aprovados pelo usuário. O critério de avanço está na seção 4.3.

```json
{ "versaoDados": 1,
  "trilhas": [
    { "id": "flexoes", "nome": "Flexões", "niveis": [
        { "exercicio": "flexao-na-parede",      "meta": { "series": 3, "reps": 15 } },
        { "exercicio": "flexao-inclinada-mesa", "meta": { "series": 3, "reps": 12 } } ] },
    { "id": "core-prancha", "nome": "Core e prancha", "niveis": [
        { "exercicio": "prancha-antebracos", "meta": { "series": 3, "segundos": 45 } },
        { "exercicio": "prancha-alta",       "meta": { "series": 3, "segundos": 45 } } ] } ] }
```

#### `dados/rotinas.json`
Raiz: `{ "versaoDados": 1, "objetivos": [...], "rotinas": [...] }`

`objetivos` tem exatamente 3 itens `{ "id", "nome" }`: `massa` "Ganhar massa", `forca` "Força e habilidades", `condicionamento` "Condicionamento geral".

**As 12 rotinas** = cada combinação objetivo (3) × dias por semana (3 ou 4) × local (casa ou academia), **exatamente uma vez**. O id é a própria combinação, e o nome exibido é montado pelo app ("Ganhar massa · 3 dias · Casa").

| Campo | Tipo e valores | Obrig. | Regra |
|---|---|---|---|
| rotina `id` | string | sim | **`<objetivo>-<diasPorSemana>-<local>`**, ex. `massa-3-casa`, `forca-4-academia` |
| rotina `objetivo` | id de objetivo | sim | |
| rotina `diasPorSemana` | `3` \| `4` | sim | |
| rotina `local` | `"casa"` \| `"academia"` | sim | |
| rotina `descanso` | inteiro 30–300 (s) | sim | descanso padrão entre séries |
| rotina `dias` | array de dia | sim | tamanho = `diasPorSemana` |
| dia `id` | `"a"`, `"b"`, `"c"`, `"d"` | sim | em ordem, sem pular |
| dia `nome` | string | sim | ex. "A · Empurrar" |
| dia `itens` | array de item | sim | ≥ 1; ordem = ordem no treino |
| item `exercicio` | id de exercício | um dos dois | exercício fixo |
| item `trilha` | id de trilha | um dos dois | usa o **nível atual** do usuário nessa trilha |
| item `series` | inteiro 1–6 | com `exercicio`: sim; com `trilha`: não | com `trilha`, o padrão é `meta.series` do nível atual |
| item `alvo` | string `^\d{1,3}(-\d{1,3})?$` | com `exercicio`: sim; com `trilha`: **proibido** | reps (`carga`/`corpo`) ou segundos (`tempo`), conforme o tipo; "8-12" exige mín ≤ máx. Com `trilha`, o alvo é a meta do nível. |
| item `descanso` | inteiro 15–300 (s) | não | substitui o `descanso` da rotina |

```json
{ "versaoDados": 1,
  "objetivos": [ { "id": "massa", "nome": "Ganhar massa" }, { "id": "forca", "nome": "Força e habilidades" },
                 { "id": "condicionamento", "nome": "Condicionamento geral" } ],
  "rotinas": [
    { "id": "massa-3-casa", "objetivo": "massa", "diasPorSemana": 3, "local": "casa", "descanso": 90,
      "dias": [
        { "id": "a", "nome": "A · Empurrar", "itens": [
            { "trilha": "flexoes", "series": 4 },
            { "exercicio": "desenvolvimento-garrafas", "series": 3, "alvo": "10-15" },
            { "trilha": "core-prancha", "descanso": 45 } ] } ] } ] }
```
(Exemplo abreviado: a rotina real tem 3 dias, e o arquivo, 12 rotinas.)

#### Regras de validação (`js/logica/validar-dados.js`)
1. `versaoDados` igual nos 3 arquivos.
2. ids no formato kebab-case e únicos: exercícios; trilhas; rotinas; dias dentro de cada rotina. Ids de grupo e de objetivo são exatamente os listados acima.
3. Tipos, valores permitidos, faixas e obrigatórios conforme as tabelas; nenhum campo desconhecido; `passos` com 3 itens.
4. `grupos` de cada exercício existem no vocabulário.
5. Trilhas: todo `exercicio` existe e não é descontinuado; cada exercício aparece em **no máximo uma** trilha, uma vez; a `meta` usa `reps` ou `segundos` conforme o tipo do exercício.
6. Rotinas: exatamente 12, uma por combinação, com id igual à combinação; `dias.length = diasPorSemana`; cada item tem exatamente um entre `exercicio` e `trilha`, e a referência existe e não é descontinuada; item com `exercicio`: os `locais` do exercício incluem o `local` da rotina; item com `trilha`: **todos** os níveis da trilha incluem o `local` da rotina; o mesmo exercício ou trilha não se repete no mesmo dia.

Onde roda: na abertura do app (`catalogo.js`; se falhar, mostra "Dados do app inválidos" e nada é gravado), em `testes/dados.test.js` e, na Fase 2b, num script temporário fora do projeto (o validador só nasce na etapa 4). A Fase 2b confere também as contagens: 165 exercícios (62 + 95 da pesquisa + 2 de adutores para casa + 6 das trilhas de barra fixa e paralelas) e 15 trilhas; e que os `locais` seguem a regra do equipamento, com as exceções listadas por id.

### 4.2 Dados do usuário (IndexedDB)

Banco `treino`, versão 1. Quatro object stores, todas com `keyPath` explícito. Do catálogo, só se copia o que precisa ficar congelado no histórico (itens da sessão, tipo e grupos da série).

#### `sessoes` (keyPath `id`): um treino
| Campo | Tipo | Regra |
|---|---|---|
| `id` | string (UUID) | |
| `rotinaId` | string \| null | null = treino livre |
| `diaId` | string \| null | dia da rotina (`a`…`d`) |
| `nome` | string | cópia ("A · Empurrar" ou "Treino livre") |
| `local` | `'casa' \| 'academia'` | |
| `itens` | array `{ exercicioId, trilhaId, series, alvo, descanso }` | **resolvido e copiado no início**: item de trilha vira o exercício do nível atual (`trilhaId` preenchido, `series` e `alvo` vindos da meta); `trilhaId` = null nos demais; exercício avulso é acrescentado aqui |
| `inicio` | number | |
| `fim` | number \| null | null enquanto em andamento |
| `status` | `'andamento' \| 'concluida'` | no máximo **uma** sessão `andamento` |
| `descanso` | `{ ate, duracao }` \| null | descanso em curso (`ate` em ms, `duracao` em s); permite retomar após recarregar |
| `versaoDados` | number | versão do catálogo no início |

Índices: `por_inicio` (`inicio`), `por_status` (`status`).

```json
{ "id": "s7…", "rotinaId": "massa-3-casa", "diaId": "a", "nome": "A · Empurrar", "local": "casa",
  "itens": [ { "exercicioId": "flexao-no-chao", "trilhaId": "flexoes", "series": 4, "alvo": "12", "descanso": 90 },
             { "exercicioId": "desenvolvimento-garrafas", "trilhaId": null, "series": 3, "alvo": "10-15", "descanso": 90 } ],
  "inicio": 1760790000000, "fim": null, "status": "andamento", "descanso": null, "versaoDados": 1 }
```

#### `series` (keyPath `id`)
| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | |
| `sessaoId` | string | |
| `exercicioId` | string | id do catálogo |
| `tipo` | string | cópia do tipo do exercício no momento |
| `grupos` | array de string | **cópia** dos `grupos` do exercício no momento, principal primeiro (usado pela recuperação na v1.1) |
| `carga` | number (kg) | só em `carga` |
| `reps` | integer | só em `carga` e `corpo` |
| `segundos` | integer | só em `tempo` |
| `feitaEm` | number | define a ordem das séries |

Índices: `por_sessao` (`sessaoId`), `por_exercicio` (`[exercicioId, feitaEm]`, composto).
Store separada (e não embutida na sessão) porque o histórico, o gráfico e as trilhas consultam **por exercício** via índice, e salvar uma série é um `put` pequeno e imediato.
- Séries de um exercício em ordem: `getAll` em `por_exercicio` com `IDBKeyRange.bound([id, 0], [id, Infinity])`.
- "Última vez": cursor `prev` no mesmo intervalo, pulando a sessão atual e coletando as séries da primeira sessão concluída anterior.

```json
{ "id": "e3…", "sessaoId": "s7…", "exercicioId": "supino-reto-barra", "tipo": "carga", "grupos": ["peito", "triceps", "ombros"], "carga": 60, "reps": 10, "feitaEm": 1760791200000 }
{ "id": "e4…", "sessaoId": "s7…", "exercicioId": "flexao-no-chao", "tipo": "corpo", "grupos": ["peito", "triceps", "ombros", "core"], "reps": 15, "feitaEm": 1760791500000 }
{ "id": "e5…", "sessaoId": "s7…", "exercicioId": "prancha-alta", "tipo": "tempo", "grupos": ["core", "ombros", "lombar", "gluteos"], "segundos": 50, "feitaEm": 1760791800000 }
```

#### `trilhas` (keyPath `trilhaId`): progresso do usuário
| Campo | Tipo | Regra |
|---|---|---|
| `trilhaId` | string | id do catálogo |
| `exercicioAtualId` | string \| null | nível atual; null = trilha concluída |
| `concluidos` | array `{ exercicioId, em, como }` | `como`: `'meta'` (bateu a meta) ou `'manual'` (o usuário escolheu começar mais à frente) |
| `atualizadoEm` | number | |

- Sem registro = o nível 1 é o atual. O registro nasce no primeiro avanço ou na primeira escolha manual.
- Guarda o **exercício**, não a posição, para resistir a mudanças de ordem no catálogo.
- Anel de progresso e "seu melhor" **não** são guardados: são calculados das séries (seção 4.3).

```json
{ "trilhaId": "flexoes", "exercicioAtualId": "flexao-no-chao",
  "concluidos": [ { "exercicioId": "flexao-na-parede", "em": 1760700000000, "como": "manual" },
                  { "exercicioId": "flexao-inclinada-mesa", "em": 1760790000000, "como": "meta" } ],
  "atualizadoEm": 1760790000000 }
```

#### `meta` (keyPath `chave`)
Chave-valor, ex. `{ "chave": "rotinaAtualId", "valor": "massa-3-casa" }`.
- v1: `ultimoBackup`, `rotinaAtualId`, `versaoDadosVista`, `persistenciaPedida`.
- v1.1: `objetivo`, `diasPorSemana`, `local`.

#### Versões e migração
- **Banco**: v1 = migração 1 cria as 4 stores e seus índices. O modelo do plano anterior (exercícios e treinos editáveis) nunca foi publicado, então não há o que migrar dele.
- **Objetivo e recuperação (v1.1) não mudam o schema**: objetivo fica em `meta`, e a recuperação lê `sessoes.por_inicio` + `series.grupos`. **Montar treinos (v1.1, etapa 28)** provavelmente precisa de uma store nova, que entra como migração 2, pelas regras da seção 2; o modelo é aprovado na própria etapa.
- **Dados do catálogo**: a versão dos dados é independente da do banco. Ao abrir, se `versaoDados` ≠ `meta.versaoDadosVista`, o app concilia: em cada registro de `trilhas`, se `exercicioAtualId` saiu da trilha, ele passa ao primeiro nível não concluído. Depois grava a nova `versaoDadosVista`. As séries antigas continuam válidas porque os ids são permanentes.

#### Regras por tipo de exercício (`js/logica/tipos.js`)
| Tipo | Campos | Validação | Exibição |
|---|---|---|---|
| `carga` | `carga`, `reps` | carga > 0 e ≤ 1000, até 2 casas decimais, aceita vírgula; reps inteiro 1–100 | `60 kg × 10` |
| `corpo` | `reps` | inteiro 1–500 | `15 reps` |
| `tempo` | `segundos` | inteiro 1–7200; entrada em `ss` ou `m:ss` | `0:50` / `1:30` |

Campos de outro tipo ficam **ausentes** (não `0`). Stepper: carga ±2,5 kg, reps ±1 (contador grande), tempo ±5 s. Exercício unilateral: registra o valor por lado; a série inclui os dois lados.

#### Comparação "antes / hoje / +1" (`js/logica/comparacao.js`)
- **antes**: séries da última sessão concluída com o mesmo exercício, pareadas por posição (1ª com 1ª, 2ª com 2ª…).
- **hoje**: séries já feitas. A linha seguinte vem pré-preenchida: última série desta sessão; senão, a série correspondente de "antes"; senão, o mínimo do alvo.
- **+1**: diferença hoje − antes em cada campo que mudou (`+1`, `−2`, `+2,5 kg`, `+5 s`); `=` se igual; vazio se não há "antes". Diferença positiva em laranja. **Só compara com a última vez: não sugere carga.**

#### Regras de exclusão
- Sessão: apagar ou descartar remove suas séries na **mesma transação**.
- Nível de trilha conquistado não é desfeito se a série que bateu a meta for editada ou apagada; o usuário pode ajustar o nível na tela Trilhas.
- O catálogo não se apaga (ids permanentes).

### 4.3 Trilhas: meta, progresso e avanço (`js/logica/trilhas.js`, funções puras)
- **Meta** do nível: `series × valor`, exibida como "3 × 12" ou "3 × 0:45".
- **Pontuação de uma sessão** (sessões concluídas, séries do exercício do nível): pega as `meta.series` melhores séries, soma `mín(valor, meta)` de cada uma e divide por `meta.series × meta`. Ex.: meta 3 × 12, séries 12, 10 e 8 → (12 + 10 + 8) / 36 = **83%**.
- **Progresso** (o anel) = maior pontuação entre todas as sessões, inclusive as feitas fora da trilha. **Seu melhor** = as séries da sessão com essa pontuação (ex. "12 · 10 · 8"); "—" se nunca fez.
- **Critério para avançar**: progresso de **100%**, ou seja, numa mesma sessão, `meta.series` séries com valor ≥ meta (reps ou segundos; em `carga`, qualquer carga). É conferido ao **finalizar** o treino: o nível entra em `concluidos` (`como: 'meta'`) e o próximo vira o atual, na mesma transação do finalizar. O resumo mostra "Novo nível: …".
- **Último nível**: ao bater a meta, `exercicioAtualId` = null (trilha concluída). Itens de rotina dessa trilha continuam usando o último nível.
- **Escolha manual**: na tela Trilhas, "Definir como nível atual" em qualquer nível (com confirmação). Os níveis anteriores entram como `como: 'manual'`.
- Testes: o exemplo acima, sessão sem séries do exercício, tipo `tempo`, mais séries que a meta (contam as melhores), avanço no último nível.

### 4.4 Cálculo da evolução (`js/logica/metricas.js`, funções puras)
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

**Recorde da semana** (card do Hoje): uma sessão da semana atual (seg–dom) cuja métrica padrão do exercício superou todas as sessões anteriores dele. Mostra o mais recente, ex. "Flexão no chão · 15 reps (antes 13)". Sem recorde: "Nenhum recorde ainda nesta semana". A primeira sessão de um exercício não conta como recorde.

Esses exemplos viram testes em `metricas.test.js`. Valores exibidos com 1 casa decimal. Nada é pré-agregado no banco: o volume de dados de 1 pessoa permite calcular na hora.

---

## 5. Telas

Barra inferior fixa com 4 abas: **Hoje · Trilhas · Evolução · Biblioteca**. Ajustes abre pela engrenagem no topo do Hoje. Layout mobile-first, alvos de toque ≥ 44 px, só tema escuro.

### Telas da v1
| Rota | Tela | Propósito e elementos principais | Navega para |
|---|---|---|---|
| `#/` | **Hoje** | Calendário da semana (dias treinados em laranja). Objetivo atual (o da rotina escolhida) e rotina, com **Trocar** (modal com as 12 rotinas agrupadas por objetivo). Card do treino do dia com botão grande **"Começar treino"** (ou **"Continuar treino"** se houver um em andamento). Próximo nível da trilha (a trilha não concluída com maior progresso; empate: a usada mais recentemente). Recorde da semana. Aviso de backup atrasado. Link **Treino livre**. | Treino, Trilhas, Ajustes |
| `#/trilhas`, `#/trilhas/:id` | **Trilhas** | Escolha da trilha no topo (chips roláveis com as 13). Caminho vertical: níveis concluídos (✓), nível atual com anel de progresso, **meta** e **"seu melhor"**, níveis bloqueados (cadeado, nome visível). Tocar num nível abre "Como fazer" e a opção **"Definir como nível atual"**. | Detalhe do exercício |
| `#/treino/:id` | **Treino em andamento** | Calendário da semana; barra de progresso dos exercícios (feito = séries registradas ≥ previstas); anterior/próximo exercício. Card do exercício: nome, alvo ("4 × 8-12"), botão **"Como fazer"** (espaço da ilustração, 3 passos, erro comum), tabela **antes / hoje / +1**, contador grande de reps com − e + (e stepper de carga ou de tempo, conforme o tipo), **Concluir série** (salva na hora e abre o Descanso). Tocar numa série feita edita/apaga. **+ Exercício** avulso. **Finalizar** / **Descartar** (com confirmação). | Detalhe da sessão (resumo) |
| (modo da tela Treino) | **Descanso** | Anel com cronômetro, **−15 s**, **+15 s** e **"Pular descanso"**. Duração = `descanso` do item. Ao zerar, vibra (se suportado) e volta sozinho para a série. Baseado em `sessao.descanso.ate`: continua certo após recarregar ou bloquear a tela. | Treino |
| `#/evolucao` | **Evolução** | Alternador **Treinos · Exercícios**. Treinos: concluídos, mais recentes primeiro, por mês (data, nome, duração, nº de séries). Exercícios: os já feitos, com a data da última vez. | Detalhe da sessão, Evolução do exercício |
| `#/evolucao/treino/:id` | **Detalhe da sessão** | Data, duração, local, exercícios com suas séries, volume total, níveis de trilha conquistados. Editar/apagar séries, adicionar série esquecida, apagar sessão. Também é o **resumo** ao finalizar (na v1.1, substituído pelo Fim do treino). | Evolução do exercício |
| `#/evolucao/exercicio/:id` | **Evolução do exercício** | Gráfico SVG com seletor de métrica (conforme o tipo), cartões de recordes, lista de sessões com as séries de cada uma. | Detalhe da sessão, Detalhe do exercício |
| `#/biblioteca` | **Biblioteca** | Busca (sem diferenciar acentos e maiúsculas), filtros **Local** (Todos / Casa / Academia) e **Grupo** (chips), lista com selo do tipo e nível. Descontinuados não aparecem. | Detalhe do exercício |
| `#/biblioteca/:id` | **Detalhe do exercício** | "Como fazer" (espaço da ilustração, 3 passos, erro comum), equipamento, músculos, nível, trilha e posição (link), **Ver evolução** se houver séries. | Trilhas, Evolução do exercício |
| `#/ajustes` | **Ajustes** | Exportar backup, Importar backup (com prévia e confirmação), data do último backup, armazenamento persistente (sim/não) e uso (`storage.estimate`), versão do app e dos dados, "Procurar atualização". | n/a |

Componentes compartilhados: modal de confirmação (não usar `confirm()`), toast, seletor de exercício (modal com busca, filtrado pelo local do treino, com "mostrar todos"), stepper, contador grande, "Como fazer", calendário da semana, anel, banner de atualização.

**Treino do dia** (`js/logica/rotina.js`): o dia seguinte ao da última sessão concluída daquela rotina, em ciclo (A → B → C → A); sem sessões, o dia A. Não depende do dia da semana. Itens de trilha viram o exercício do nível atual.

### Telas da v1.1
| Rota | Tela | Propósito e elementos principais |
|---|---|---|
| `#/objetivo` | **Objetivo** | Escolha de objetivo (3 cartões), dias por semana (3 ou 4) e local (casa ou academia). O app escolhe a rotina `<objetivo>-<dias>-<local>` e troca sozinho quando qualquer escolha muda (o próximo treino passa a ser o dia A da nova rotina). Substitui o "Trocar" da v1 no Hoje. |
| `#/fim/:id` | **Fim do treino** | Resumo, níveis conquistados, recuperação por grupo muscular (quando cada um volta a estar pronto, pela regra a definir) e sugestão do próximo treino. Abre ao finalizar, no lugar do Detalhe da sessão. |
| (a definir) | **Montar treinos** | Criar, editar e apagar treinos próprios com exercícios da biblioteca. Tela e modelo de dados propostos e aprovados na etapa 28. |

---

## 6. Etapas de construção

Ordem pensada para ter o **app instalado no celular cedo** (com a Biblioteca já útil offline) e o **ciclo principal (Hoje → treino → resumo) usável logo depois**. O backup vem logo depois da instalação no celular (etapa 11). O **uso real começa na etapa 16**: precisa do backup pronto e de um treino completo (Hoje → registrar séries → finalizar). Cada etapa termina com algo verificável e, a partir da etapa 10, com deploy (`VERSAO` nova) e conferência no celular.

### Antes da etapa 1: Fase 2b (geração dos JSON)
**Fase 2b. Catálogo.** Objetivo: gerar `dados/exercicios.json`, `dados/progressoes.json` e `dados/rotinas.json` a partir de `pesquisa/`, no formato da seção 4.1, propondo as metas das trilhas e o conteúdo das 12 rotinas. Pronto quando: os 3 arquivos passam em todas as regras de validação (script temporário fora do projeto), há 159 exercícios (os 157 da pesquisa + 2 de adutores) e 13 trilhas, há 12 rotinas, e o usuário aprovou metas e rotinas. As etapas 1 a 3 não dependem dos JSON; da etapa 4 em diante, sim.

### v1
1. **Esqueleto estático + tema Brasa + fontes**. Objetivo: `index.html`, `css/base.css` (cores Brasa em variáveis, `@font-face`), `css/componentes.css`, `js/app.js`, barra inferior com as 4 abas e engrenagem, `fonts/` com os 4 `.woff2` + `OFL.txt`. Pronto quando: `npx http-server -p 8080 -c-1` serve o app sem erros no console, a aba Network mostra só requisições a localhost (fontes incluídas) e o layout fica correto a 360 px no modo celular do DevTools.
2. **Roteador hash + telas placeholder**. Objetivo: `roteador.js`, `ui/dom.js` (`h()`) e as telas da v1 com título. Pronto quando: tocar nas abas muda a URL e o conteúdo, a aba ativa fica marcada, o botão voltar funciona, `#/biblioteca/abc` recebe `id = "abc"` e uma rota inexistente cai no Hoje.
3. **Testes no navegador + `logica/tipos.js`**. Objetivo: `testes/mini-teste.js`, `testes/index.html`, validação/parse/formatação dos 3 tipos. Pronto quando: `/testes/` mostra tudo verde, cobrindo "62,5" → 62.5, "1:30" → 90 s, reps 0 rejeitado, campo de outro tipo rejeitado.
4. **Catálogo**. Objetivo: `logica/validar-dados.js`, `catalogo.js` (carrega, valida, congela, mapas por id), `testes/dados.test.js`. Pronto quando: os JSON reais passam; cada regra da seção 4.1 tem um caso quebrado (dados fixos no teste) que é recusado; com um JSON quebrado o app mostra "Dados do app inválidos".
5. **Biblioteca**. Objetivo: telas Biblioteca e Detalhe do exercício, componente "Como fazer". Pronto quando: lista os 159 exercícios; a busca ignora acentos e maiúsculas; os filtros Local e Grupo combinados dão o resultado certo; o detalhe mostra 3 passos, erro comum, espaço da ilustração e a trilha com a posição quando houver.
6. **Manifest + ícones**. Objetivo: `manifest.webmanifest` (cores `#0D0D0F`), ícones 192/512/maskable/apple-touch, metas no `index.html`. Pronto quando: DevTools › Application › Manifest não mostra erros e o Chrome do PC oferece "Instalar".
7. **Service worker**. Objetivo: `sw.js` com `VERSAO`, `ARQUIVOS` (incluindo fontes e `dados/`), precache, cache-first, limpeza no `activate`. Pronto quando: com DevTools em Offline, recarregar abre o app e a Biblioteca funciona; Cache Storage mostra só `treino-v1` com todos os arquivos; mudar para `v2` apaga o `v1`.
8. **Fluxo de atualização**. Objetivo: banner "Nova versão disponível" + `SKIP_WAITING` + recarregar no `controllerchange`. Pronto quando: alterar um arquivo e a `VERSAO` faz o app aberto mostrar o banner, e tocar atualiza.
9. **IndexedDB + migração 1**. Objetivo: vendorizar `idb`, `db/conexao.js`, `db/migracoes.js`, `db/meta.js`, conciliação de `versaoDados`. Pronto quando: DevTools › Application › IndexedDB mostra `treino` v1 com as 4 stores e todos os índices, recarregar não dá erro nem duplica nada, e `versaoDadosVista` é gravada. (Vem antes da publicação porque o backup, logo depois dela, precisa do banco.)
10. **Publicar e instalar no Android**. ⬅ **A partir desta etapa o app fica instalado no celular.** Objetivo: publicar no GitHub Pages (endereço definitivo, não muda depois), `storage.persist()` na primeira abertura, instalar pelo Chrome. Pronto quando: o ícone está na tela inicial e o app abre em **modo avião** com a Biblioteca funcionando.
11. **Backup**. Objetivo: `db/backup.js` (exportar, validar cada registro pelas regras da seção 4.2, importar substituindo tudo), exportar/importar em Ajustes, `testes/backup.test.js`. Pronto quando: o teste de ida e volta passa com dados fixos nas 4 stores (sessões, séries dos 3 tipos, trilhas e `meta`, inclusive `rotinaAtualId`) num banco separado "treino-teste"; no celular, exportar, apagar os dados do app e importar restaura o banco; arquivo inválido, de outro app ou com id fora do catálogo é recusado com mensagem. As etapas seguintes que gravarem dados novos conferem que eles entram no backup.
12. **Rotina e Hoje básico**. Objetivo: `logica/rotina.js` + `testes/rotina.test.js`; Hoje com calendário da semana, rotina atual com "Trocar" e card do treino do dia com "Começar treino". Pronto quando: os testes passam (ciclo A → B → C → A, rotina sem sessões começa no A, item de trilha sem registro usa o nível 1, trilha concluída usa o último nível); trocar a rotina muda o card e persiste após recarregar.
13. **Treino em andamento: registrar séries**. Objetivo: `db/sessoes.js`, `db/series.js`, tela Treino (barra de progresso, card do exercício, contador grande, steppers por tipo, salvar na hora, editar/apagar série), "Continuar treino" no Hoje. Pronto quando: começar pelo Hoje, registrar séries dos 3 tipos, **fechar o app e reabrir** mostra "Continuar" com tudo salvo; cada série tem `grupos` copiado; iniciar um segundo treino é impedido (oferece continuar).
14. **Tabela antes / hoje / +1**. Objetivo: `logica/comparacao.js` + `testes/comparacao.test.js`, tabela e pré-preenchimento na tela Treino. Pronto quando: os testes passam (3 tipos, mais séries hoje que antes, sem "antes", carga e reps mudando juntas); no segundo treino com o mesmo exercício, "antes" e "+1" conferem com o primeiro.
15. **Descanso**. Objetivo: `ui/anel.js`, modo Descanso, `sessao.descanso` no banco. Pronto quando: concluir uma série abre o descanso com o tempo do item; −15 s e +15 s funcionam; ao zerar, vibra e volta sozinho para a série; recarregar no meio continua com o tempo certo.
16. **Finalizar, descartar, avulso e treino livre**. Objetivo: Finalizar/Descartar com confirmação, "+ Exercício" (seletor), Treino livre, resumo = Detalhe da sessão em modo leitura. Pronto quando: um treino inteiro vai do Hoje ao resumo; descartar apaga as séries; depois de finalizar, o Hoje mostra o dia seguinte da rotina; um backup exportado depois de um treino e importado restaura a sessão e as séries. **A partir daqui, uso real** (o que foi registrado antes é teste e pode ser apagado). O avanço automático de nível só chega na etapa 18; até lá, as séries já contam para o progresso das trilhas, e o nível pode ser ajustado à mão.
17. **Trilhas: lógica**. Objetivo: `logica/trilhas.js` + `testes/trilhas.test.js`. Pronto quando: os casos da seção 4.3 passam.
18. **Tela Trilhas + avanço**. Objetivo: `db/trilhas.js`, tela Trilhas, avanço ao finalizar (mesma transação), "Definir como nível atual", "Novo nível" no resumo. Pronto quando: bater a meta num treino avança o nível e o treino seguinte já usa o novo exercício; a escolha manual persiste; anel e "seu melhor" conferem com um cálculo manual.
19. **Histórico**. Objetivo: aba Evolução (Treinos) e Detalhe da sessão com edição (editar/apagar série, adicionar série esquecida, apagar sessão). Pronto quando: as sessões aparecem agrupadas por mês, e as edições persistem e aparecem na coluna "antes" do treino seguinte.
20. **Métricas**. Objetivo: `logica/metricas.js` + `testes/metricas.test.js`. Pronto quando: os testes passam, incluindo o exemplo da seção 4.4, reps > 12 fora do 1RM, sessão sem séries do exercício ignorada, os 3 tipos e o recorde da semana.
21. **Gráfico SVG**. Objetivo: `ui/grafico.js` testado numa página com dados fixos. Pronto quando: renderiza com 0 pontos (mensagem), 1 ponto e 200 pontos; o eixo de datas é proporcional; tocar num ponto mostra data e valor; fica legível no tema escuro a 360 px de largura.
22. **Evolução do exercício**. Objetivo: gráfico + seletor de métrica + recordes + lista de sessões; aba Evolução (Exercícios); "Ver evolução" na Biblioteca. Pronto quando: com dados reais, os valores do gráfico e dos recordes conferem com um cálculo manual de 2 sessões.
23. **Hoje completo + Ajustes**. Objetivo: próximo nível da trilha e recorde da semana no Hoje, lembrete de backup após 7 dias; Ajustes com armazenamento persistente, uso, versões do app e dos dados, "Procurar atualização". Pronto quando: tudo aparece certo no celular instalado, o recorde confere com um cálculo manual e o aviso de backup some depois de exportar.
24. **Revisão da v1**. Objetivo: passar a lista do `ARQUIVOS` contra a árvore real, conferir acessibilidade (rótulos, contraste da paleta Brasa, alvos de toque), corrigir o que o uso real mostrou. Pronto quando: uma semana de treinos registrada só pelo celular offline, sem erro no console, com um backup exportado pelo celular e restaurado no PC.

### v1.1
25. **Objetivo e troca automática de rotina**. Objetivo: tela Objetivo, `meta.objetivo/diasPorSemana/local`, Hoje mostrando o objetivo escolhido. Pronto quando: as 12 combinações levam às 12 rotinas certas; trocar qualquer escolha troca o treino do dia (dia A da nova rotina); um treino em andamento não muda; quem vem da v1 tem as escolhas preenchidas a partir de `rotinaAtualId`.
26. **Regra de recuperação**. Objetivo: decidir com o usuário a regra de horas por grupo muscular (pendência), registrá-la neste arquivo, `logica/recuperacao.js` + `testes/recuperacao.test.js`. Pronto quando: a regra está aprovada e registrada, e os testes com dados fixos passam.
27. **Fim do treino**. Objetivo: tela Fim do treino ao finalizar (resumo, níveis conquistados, recuperação por grupo, sugestão do próximo treino). Pronto quando: finalizar abre o Fim do treino; os horários conferem com a regra; séries feitas antes da v1.1 também contam (os grupos já estão gravados).
28. **Montar treinos**. Objetivo: o usuário monta treinos próprios com exercícios da biblioteca (que continua somente leitura: não se criam exercícios). Antes do código, propor e aprovar com o usuário a tela, como o treino montado convive com as rotinas e o treino do dia, e o modelo de dados (provavelmente uma store nova pela migração 2, regras da seção 2, entrando no backup com novo `formato`). Pronto quando: o modelo está aprovado e registrado neste arquivo; montar, editar e apagar um treino persiste após recarregar; começar um treino montado registra séries como qualquer outro; o backup de ida e volta inclui os treinos montados, e um backup antigo da v1 continua sendo importado.
29. **Revisão da v1.1**. Objetivo: `ARQUIVOS`, backup e uso real com as novidades. Pronto quando: uma semana de uso real com troca de objetivo, Fim do treino e um treino montado, sem erro no console, e backup de ida e volta funcionando.

---

## 7. Fora do escopo

**Explicitamente fora (v1 e v1.1):** sugestão de carga/progressão automática (o "+1" só compara com a última vez) · contador de reps pela câmera · contas de usuário/sincronização/servidor · tema claro.

**Ideias futuras:**
- Criar exercícios próprios; a biblioteca é somente leitura na v1 e na v1.1. (Montar treinos próprios passou para a v1.1, etapa 28.)
- Cronômetro embutido para exercícios de tempo.
- Manter a tela ligada durante o treino (Screen Wake Lock API).
- Destacar recordes batidos no resumo / Fim do treino (o recorde da semana no Hoje já é v1).
- Lastro/assistência em exercícios de peso do corpo (ex.: barra com colete).
- Volume semanal por grupo muscular.
- Trilhas para exercícios de academia.
- Filtro de período no gráfico (3 meses / 1 ano / tudo); trocar para uPlot se precisar de zoom.
- Importar com mesclagem; exportar CSV.
- Suporte a lb.

---

## 8. Design aprovado

### Identidade "Brasa" (tema escuro, único tema do app)

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

- **Fontes:** Barlow Condensed (títulos e números grandes) e Manrope (texto). Os arquivos `.woff2` ficam **dentro do projeto** (`fonts/`), para funcionar offline.
- **Botões:** cantos bem arredondados; áreas de toque de no mínimo **44 px**.

### Telas aprovadas
1. **Hoje** (v1): calendário da semana (dias treinados em laranja), objetivo atual, card do treino do dia com botão grande **"Começar treino"**, próximo nível da trilha e recorde da semana. Na v1, o objetivo é o da rotina escolhida; na v1.1, vem da tela Objetivo.
2. **Trilhas** (v1): escolha da trilha no topo; caminho vertical com níveis concluídos, nível atual com anel de progresso, meta e "seu melhor", e níveis bloqueados.
3. **Treino em andamento** (v1): calendário da semana; barra de progresso dos exercícios; botão **"Como fazer"**, que abre ilustração (na v1, espaço reservado), 3 passos e erro comum; tabela de séries com "antes", "hoje" e +1; contador grande de reps com − e +.
4. **Descanso** (v1): anel com cronômetro, −15 s, +15 s e **"Pular descanso"**; volta sozinho para a série quando zera.
5. **Fim do treino** (v1.1): resumo e recuperação por grupo muscular (quando cada um volta a estar pronto), com sugestão do próximo treino. Na v1, finalizar abre o Detalhe da sessão como resumo.

### Decisões em aberto
- Regra de horas de recuperação por grupo muscular (v1.1, etapa 26).
- Como fazer as ilustrações dos exercícios (v1 usa espaço reservado).

### Ajustes do plano (todos resolvidos no replanejamento)
- Fontes: Barlow Condensed e Manrope locais em `fonts/` (seção 2).
- Tema: só escuro (seções 2, 3 e 5).
- Telas e abas: Hoje, Trilhas, Evolução, Biblioteca + Treino com Descanso; Fim do treino na v1.1 (seções 3, 5 e 6).
- Modelo de dados: catálogo em `dados/` + stores `sessoes`, `series` (com grupos), `trilhas` e `meta`; objetivo em `meta` na v1.1 (seção 4).
- Timer de descanso: na v1 (tela Descanso).
- Grupo muscular: gravado em cada série desde a v1; recuperação na v1.1.
- Recordes: o recorde da semana do Hoje é v1; destacar recordes no resumo segue como ideia futura.
- "+1": só comparação com a última vez, sem sugerir carga (seção 4.2).
- Ilustrações: campo `imagem` (null na v1), espaço reservado no "Como fazer" e pasta futura `img/exercicios/`.

---

## 9. Estado atual

- **Feito:** planejamento original da v1 aprovado (este arquivo, versionado em git).
- **Feito:** **Fase 1 da biblioteca de exercícios**: `pesquisa/calistenia.md` e `pesquisa/academia.md`.
- **Feito:** **Fase 2a**: execuções revisadas e lacunas preenchidas. Agora `pesquisa/calistenia.md` tem 62 exercícios em 13 trilhas e `pesquisa/academia.md` tem 95 exercícios.
- **Feito:** **design aprovado** registrado (seção 8: identidade "Brasa" e 5 telas).
- **Feito:** **replanejamento aprovado** (18/10/2026): ajustes pendentes resolvidos, escopo v1/v1.1, modelo de dados novo, formato dos 3 JSON e nova lista de etapas (backup logo depois da instalação no celular; montar treinos na v1.1). Feito com o **Opus 5.5** (o `/usage` mostrou Opus 5.5, não Fable 5.1). **Nenhuma etapa de código foi iniciada.**
- **Feito:** **Fase 2b**: `dados/exercicios.json` (159 exercícios: 33 casa, 31 ambos, 95 academia), `dados/progressoes.json` (13 trilhas, 62 níveis com metas) e `dados/rotinas.json` (3 objetivos, 12 rotinas), todos com `versaoDados` 1. Passaram em todas as regras de validação da seção 4.1 (script temporário fora do projeto). **Metas das trilhas e rotinas aprovadas** pelo usuário, com ajuste durante o uso real.
- **Feito:** **ajustes da Fase 2b**: `locais` de todos os exercícios recalculados pela regra do equipamento (22 mudaram: 19 com halter/kettlebell de ambos → academia; 3 com objeto de casa de ambos → casa); 2 exercícios de adutores sem equipamento de academia (`aducao-deitado-de-lado`, ambos; `isometria-adutores-almofada`, casa); rotinas de academia usam as trilhas que servem na academia (`core-prancha`, `isometrias`, `abdominal-elevacao-pernas`; não há trilha de barra fixa); as 6 rotinas de casa têm adutores e nenhum equipamento de academia.
- **Feito:** **ajustes finais da biblioteca (biblioteca concluída)**: 2 trilhas novas de academia em `dados/progressoes.json`: `barra-fixa` (suspensão na barra 3 × 0:30 → assistida no gráviton 3 × 10 → negativa 3 × 5 → barra fixa 3 × 8) e `paralelas` (mergulho assistido no gráviton 3 × 12 → negativo 3 × 5 → mergulho nas paralelas 3 × 10). Reutilizado `suspensao-barra-fixa`; criados `barra-fixa-negativa`, `barra-fixa-assistida-graviton`, `barra-fixa`, `mergulho-assistido-graviton`, `mergulho-negativo-paralelas`, `mergulho-paralelas`. Total: **165 exercícios (32 casa, 32 ambos, 101 academia), 15 trilhas, 12 rotinas**, `versaoDados` 1 (nada publicado ainda). As 6 rotinas de academia usam as trilhas novas: barra fixa nos dias de puxar (nos dias de superior/corpo inteiro, no lugar de uma puxada ou da suspensão fixa) e paralelas nos dias de empurrar (no lugar de um tríceps ou do supino na máquina), sem aumentar o número de itens por dia. Exceção de local registrada: `flexao-parada-de-mao-parede` passou a ambos. `pesquisa/*.md` marcados como arquivo histórico (a fonte oficial é `dados/`). Checagem automática completa (script temporário fora do projeto) passou em todas as regras.
- **Feito:** **etapa 1. Esqueleto estático + tema Brasa + fontes** (19/10/2026): `index.html`, `css/base.css`, `css/componentes.css`, `js/app.js` (vazio por enquanto), `fonts/` com os 4 `.woff2` (convertidos dos `.ttf` oficiais de github.com/google/fonts, subconjunto latin) + `OFL.txt` (Barlow Condensed) e `OFL-manrope.txt` (Manrope). Engrenagem no topo do Hoje (decisão menor 12), barra inferior com as 4 abas. Conferido pelo usuário: console sem erros, Network só com localhost, layout certo a 360 px.
- **Feito:** **etapa 2. Roteador hash + telas placeholder** (19/10/2026): `js/roteador.js`, `js/ui/dom.js` (`h()` e `limpar()`) e 9 telas placeholder em `js/telas/` (Hoje, Trilhas, Treino, Evolução, Detalhe da sessão, Evolução do exercício, Biblioteca, Detalhe do exercício, Ajustes; Descanso é modo da tela Treino). Aba ativa segue a rota (Treino e Ajustes marcam Hoje), engrenagem só no Hoje, rota inexistente vai para `#/` com `location.replace`. Conferido pelo usuário: abas, voltar, id na URL, rota inválida e engrenagem, console sem erros.
- **Próxima etapa de código:** **3. Testes no navegador + `logica/tipos.js`.**
- **Pendente:** regra de horas de recuperação por grupo muscular (v1.1, etapa 26).
- **Pendente:** como fazer as ilustrações dos exercícios (a v1 funciona sem elas).
- **Pendente:** ajustar metas das trilhas e rotinas conforme o uso real (aprovadas como ponto de partida).

### Decisões tomadas
- **Escopo da v1:** biblioteca somente leitura (`dados/`), trilhas de níveis, treino em andamento com tabela "antes / hoje / +1", cronômetro de descanso, histórico e gráfico de evolução, backup em JSON, instalável no Android. Telas: Hoje, Trilhas, Evolução, Biblioteca (abas) e Treino em andamento com Descanso.
- **Escopo da v1.1:** escolha de objetivo com troca automática entre as 12 rotinas; recuperação por grupo muscular no Fim do treino.
- **"+1":** só comparação com a última vez; não sugere carga.
- **Tema:** só escuro. **Fontes:** Barlow Condensed e Manrope, arquivos locais.
- **Ilustrações:** na v1, só 3 passos e erro comum, com espaço reservado para a imagem; o método fica para depois.
- **Objetivo do treino:** ganhar massa, força e habilidades ou condicionamento geral. Pode ser trocado a qualquer hora, e trocar o objetivo troca a rotina (v1.1).
- **Rotinas prontas:** **12** (3 objetivos × 3 ou 4 dias por semana × casa ou academia).
- **Celular:** Android (testes e instalação pelo Chrome).
- **Hospedagem:** GitHub Pages. O endereço é **fixo e não deve mudar depois**, porque os dados do IndexedDB ficam presos ao domínio (trocar de endereço = banco vazio, só recuperável por backup).
- **Locais do exercício:** um exercício pode ser de **casa e de academia ao mesmo tempo**.
- **Equipamento em casa:** **nenhum** além de objetos de casa (cadeira, mesa, mochila, toalha, garrafas, almofada, degrau etc.). **Sem halteres** nem kettlebell em casa.
- **Regra de local (pelo `equipamento`):** sem equipamento (parede e chão contam como sem equipamento) → casa e academia; só objetos de casa → casa; qualquer equipamento de academia (barra fixa, barras paralelas, gráviton, halteres, kettlebell, barra, anilhas, máquinas, polia, smith, banco) → academia, mesmo misturado com objeto de casa. Uma trilha só entra numa rotina se **todos** os níveis servem naquele local.
- **Exceções à regra de local (decididas pelo usuário, por id):** `flexao-parada-de-mao-parede` (equipamento parede + "almofada ou colchonete") → casa e academia, porque a almofada é opcional e a academia tem colchonete. A checagem automática aceita só os ids desta lista; para todos os outros exercícios a regra vale sem exceção.
- **Metas e rotinas:** metas das 13 trilhas de calistenia e as 12 rotinas **aprovadas**; metas das trilhas `barra-fixa` e `paralelas` propostas no mesmo padrão; tudo será ajustado durante o uso real.
- **Gráfico de carga:** mostra a **carga máxima** por padrão; o **1RM estimado** fica como opção no seletor de métrica.
- **Biblioteca:** **somente leitura na v1** (vem de `dados/`; o usuário não cria nem edita exercícios).
- **Montar treinos:** fica para a **v1.1** (etapa 28). Na v1 há só as 12 rotinas prontas, o treino livre e o exercício avulso.
- **Treino do dia:** segue a **sequência A → B → C** da rotina (em ciclo, voltando ao A; com 4 dias, A → B → C → D), não o dia da semana.
- **Ordem das etapas:** o **backup** vem logo depois da instalação no celular (etapa 11); o **uso real** começa na etapa 16, quando já há backup e um treino completo do Hoje ao resumo.

### Decisões menores tomadas no replanejamento
1. O catálogo não vai para o IndexedDB: é lido de `dados/`, validado e congelado em memória. Ids do catálogo são permanentes (`descontinuado` em vez de apagar).
2. Um único `versaoDados`, igual nos 3 arquivos; conciliação do progresso das trilhas quando ele muda.
3. Vocabulário fixo de 13 grupos musculares (`grupos`) + `musculos` com o texto original da pesquisa; mapeamento definido na seção 4.1.
4. Rotinas: id `<objetivo>-<dias>-<local>`; item aponta para um exercício fixo ou para uma trilha (usa o nível atual); `alvo` em texto ("8-12") com a unidade dada pelo tipo; descanso padrão por rotina, com substituição por item.
5. Treino do dia = próximo dia da rotina em ciclo (A → B → C → A), não pelo dia da semana. Semana de segunda a domingo.
6. Na v1, a rotina é escolhida numa lista das 12 ("Trocar" no Hoje); a v1.1 troca isso pela tela Objetivo.
7. Meta da trilha: `series × valor` numa mesma sessão; em `carga` só contam as reps; unilateral = por lado; anel = melhor pontuação de sessão; avanço automático ao finalizar; nível conquistado não é desfeito; nível pode ser escolhido manualmente.
8. O progresso da trilha guarda o exercício atual (não a posição).
9. "+1" = diferença por campo em relação à série de mesma posição da última vez.
10. Recorde da semana = sessão desta semana que superou a métrica padrão de todas as anteriores do exercício (mostra o mais recente). No Hoje, "próximo nível" = trilha não concluída com maior progresso.
11. O descanso fica salvo na sessão (`descanso.ate`) para sobreviver a recarregar; vibra ao zerar, se o aparelho suportar.
12. Ajustes vira subtela aberta pela engrenagem do Hoje (4 abas na barra).
13. Exercícios e treinos editáveis pelo usuário saíram da v1; montar treinos passou para a v1.1 (etapa 28) e criar exercícios segue como ideia futura; treino livre e exercício avulso continuam na v1.
14. Pesos das fontes: Barlow Condensed 600/700 e Manrope 400/700, subconjunto latin.
15. Instalação no celular cedo (etapa 10), com a Biblioteca já útil offline; IndexedDB antes (etapa 9) e backup logo depois (etapa 11); uso real a partir da etapa 16 (backup pronto + treino completo).
16. Exercícios de tempo continuam com digitação/stepper; cronômetro de exercício segue como ideia futura.
17. Faixas das metas e das rotinas definidas na seção 4.1; os valores são propostos na Fase 2b.

### Checklist
- [x] Fase 2b. Catálogo (`dados/*.json`)
- [x] 1. Esqueleto estático + tema Brasa + fontes
- [x] 2. Roteador hash + telas placeholder
- [ ] 3. Testes no navegador + `logica/tipos.js`
- [ ] 4. Catálogo
- [ ] 5. Biblioteca
- [ ] 6. Manifest + ícones
- [ ] 7. Service worker
- [ ] 8. Fluxo de atualização
- [ ] 9. IndexedDB + migração 1
- [ ] 10. Publicar e instalar no Android
- [ ] 11. Backup
- [ ] 12. Rotina e Hoje básico
- [ ] 13. Treino em andamento: registrar séries
- [ ] 14. Tabela antes / hoje / +1
- [ ] 15. Descanso
- [ ] 16. Finalizar, descartar, avulso e treino livre (início do uso real)
- [ ] 17. Trilhas: lógica
- [ ] 18. Tela Trilhas + avanço
- [ ] 19. Histórico
- [ ] 20. Métricas
- [ ] 21. Gráfico SVG
- [ ] 22. Evolução do exercício
- [ ] 23. Hoje completo + Ajustes
- [ ] 24. Revisão da v1
- [ ] 25. (v1.1) Objetivo e troca automática de rotina
- [ ] 26. (v1.1) Regra de recuperação
- [ ] 27. (v1.1) Fim do treino
- [ ] 28. (v1.1) Montar treinos
- [ ] 29. (v1.1) Revisão da v1.1
