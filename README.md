# Carteira — PWA da estratégia de compra e venda (B3)

PWA mobile-first para acompanhar, pelo celular, a estratégia de compra e venda de
ações da B3 que já vive em uma planilha do Google Sheets.

A **planilha continua sendo o banco de dados único**. O app lê e escreve nela
direto do navegador, via Google Sheets API v4. Não existe backend.

- **Dashboard** — todos os tickers ordenados por urgência, com sinal, preço e
  distância até os alvos.
- **Detalhe do ticker** — os 19 campos da linha, com edição dos alvos, da
  classificação, da tese e das observações (salvar exige login; consultar não).
- **Histórico** — os eventos da aba `Log`, com filtros de período, ticker e tipo.
- **Estatísticas** — tempo em COMPRA/VENDA e distância média nos últimos 30 dias.
- **Offline** — instalável na tela inicial; consulta funciona sem rede (últimos
  dados carregados), edição fica desabilitada.

## Stack

Vanilla JS com ES modules, **sem build e sem dependências**. O que está no repo é
exatamente o que roda no navegador — dá para editar um arquivo, dar `git push` e
ver o resultado. Roteamento por hash (o GitHub Pages não reescreve URLs).

```
index.html            Casca do app
manifest.json         Metadados do PWA
sw.js                 Service worker (cache do app + dos dados)
icons/                Ícones 192/512 + maskable
styles/app.css        Todo o CSS
src/
  config.js           >>> SPREADSHEET_ID e API_KEY ficam aqui <<<
  main.js             Entrada: rotas, navegação, service worker
  router.js           Roteador por hash
  store.js            Estado, cache offline e chamadas de rede
  models.js           Planilha <-> objetos do app
  api/sheets.js       Google Sheets API v4 (retry, erros)
  api/auth.js         Login Google (só para gravar; leitura é pública)
  utils/format.js     Datas (America/Sao_Paulo), moeda, percentuais
  components/         Card, badge, toast, pull-to-refresh, faixa de login, ...
  views/              Dashboard, detalhe, log, estatísticas
```

## Configuração

### 1. Gerar a API Key

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) com a conta
   dona da planilha e crie um projeto (ex.: `carteira-pwa`).
2. **APIs e serviços → Biblioteca** → procure **Google Sheets API** → **Ativar**.
3. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
4. Clique na chave criada e configure as duas restrições:
   - **Restrições de aplicativo → Sites (referrers HTTP)**. Adicione o domínio do
     seu GitHub Pages, com estes dois padrões:
     ```
     https://<seu-usuario>.github.io/*
     https://<seu-usuario>.github.io
     ```
     Se usar domínio próprio, troque pelo seu domínio.
   - **Restrições de API → Restringir chave → Google Sheets API** (só essa).
5. Salve. A propagação da restrição pode levar alguns minutos.

> A chave fica visível no código do frontend — isso é inerente a um app sem
> backend e sem login, e foi aceito no desenho do projeto. A restrição por
> referrer é uma mitigação básica, não uma blindagem.

### 2. Login para edição (OAuth)

**A API Key só serve para ler.** O Google recusa escrita com chave de API:

> 401 — API keys are not supported by this API. Expected OAuth2 access token or
> other authentication credentials that assert a principal.

Não existe configuração de planilha que contorne isso: gravar exige uma
credencial que identifique **uma pessoa**. Por isso o app pede login com a conta
Google no momento de salvar. Consultar continua público e sem login.

1. No mesmo projeto do Google Cloud Console, vá em **APIs e serviços → Tela de
   permissão OAuth**. Escolha **Externo** e preencha o básico (nome do app,
   e-mail de contato).
2. Deixe a publicação em **Testing** e adicione o seu próprio e-mail em
   **Usuários de teste**. Assim não precisa de verificação do Google.
   Na primeira vez aparece um aviso *"O Google não verificou este app"* →
   **Avançado → Acessar (não seguro)**. É esperado para um app pessoal.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione (sem barra no fim):
   ```
   https://<seu-usuario>.github.io
   http://localhost:8000
   ```
   *Não* preencha "URIs de redirecionamento" — o fluxo de token do Google
   Identity Services não usa redirecionamento.
5. Copie o ID do cliente para `GOOGLE_CLIENT_ID` em `src/config.js`.

O token fica só na memória da aba, nunca no `localStorage`, e vale cerca de uma
hora. Depois disso o app renova em silêncio enquanto houver sessão Google ativa
no navegador; se não houver, o botão volta a pedir login.

### 3. Compartilhar a planilha

Para a leitura por API Key funcionar, a planilha precisa estar compartilhada por
link. Como a escrita agora passa pelo login, **"Leitor" basta**:

**"Qualquer pessoa com o link" → "Leitor"**.

Quem edita é a sua conta Google, autenticada. Quem só abrir a URL do app vê tudo,
mas não consegue alterar nada — nem pela planilha, nem pelo app.

> Isso é melhor do que o desenho original previa. A ideia inicial era deixar a
> planilha como "qualquer pessoa com o link pode editar"; com login isso deixou
> de ser necessário. Se você deixar como "Editor", qualquer pessoa logada em
> **qualquer** conta Google conseguirá salvar pelo app.

### 4. Preencher `src/config.js`

```js
export const SPREADSHEET_ID = '1h_QRbk94w9FLo4zplaIoMhE_bp7_1AFk14TNGK3HjbE';
export const API_KEY = 'AIza...';                        // leitura (passo 1)
export const GOOGLE_CLIENT_ID = '...apps.googleusercontent.com';  // escrita (passo 2)
```

Sem `GOOGLE_CLIENT_ID` o app funciona normalmente para consulta e avisa que a
edição está indisponível.

Enquanto a `API_KEY` estiver vazia, o app abre em uma tela explicando o que falta
em vez de quebrar.

Outros ajustes disponíveis no mesmo arquivo: nomes das abas, primeira linha de
dados, número máximo de tickers, tamanho da página do log, intervalo do Apps
Script (usado nas estatísticas) e o limiar de "perto do alvo".

## Rodando local

Precisa ser servido por HTTP (ES modules e service worker não funcionam via
`file://`). Qualquer servidor estático serve:

```bash
python3 -m http.server 8000
# ou: npx serve .
```

Abra <http://localhost:8000>.

Para testar em `localhost`, adicione `http://localhost:8000/*` nos referrers da
API Key (ou crie uma segunda chave só para desenvolvimento) e
`http://localhost:8000` nas origens autorizadas do ID do cliente OAuth.

Testar como celular: DevTools → Toggle device toolbar → **iPhone SE (375px)**,
que é a base de layout do projeto.

## Deploy

`.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`.
Como não há build, o repositório inteiro vira o site.

O workflow usa `enablement: true`, então ele mesmo liga o Pages no modo
"GitHub Actions" na primeira execução — não é preciso configurar nada antes.

Se mesmo assim aparecer **"Get Pages site failed ... Not Found"**, é porque a
conta não deixou o workflow ligar o Pages sozinho. Nesse caso, habilite à mão
em **Settings → Pages → Source: GitHub Actions** e rode o workflow de novo.

**Ao alterar arquivos do app**, suba o `CACHE_VERSION` em `sw.js` (`v1` → `v2`)
para que o service worker descarte o cache antigo nos celulares já instalados.

## Como a planilha é lida e escrita

Leitura sempre com `valueRenderOption=UNFORMATTED_VALUE`, para pegar o resultado
das fórmulas (preço, distâncias, sinal) e não o texto delas.

| Aba          | Faixa lida                | Frequência                                     |
|--------------|---------------------------|------------------------------------------------|
| `Estrategia` | `A5:S34`                  | ao abrir o app, ao voltar para ele, no refresh |
| `Log`        | as últimas `LOG_MAX_ROWS` linhas | ao entrar em Histórico/Estatísticas      |

O log só cresce por *append*, então os eventos recentes ficam **no fim** da aba.
Ler a partir da linha 3 traria histórico velho depois de alguns meses, então o
app primeiro consulta os metadados da planilha (resposta minúscula) para achar a
última linha e só então lê a janela final. Com `LOG_MAX_ROWS = 10000`, uma aba de
50 mil linhas transfere apenas as 10 mil mais recentes.

Os dados já carregados são reaproveitados por `STALE_MS` (1 min por padrão):
trocar de aba dentro dessa janela não gera chamada nova; o botão ↻ e o
pull-to-refresh sempre releem.

A escrita é um único `values:batchUpdate` com `valueInputOption=USER_ENTERED`,
autenticado com `Authorization: Bearer <access token>` (nunca com a API Key),
em três faixas da linha do ticker:

| Faixa    | Campos                                     |
|----------|--------------------------------------------|
| `C:D`    | Objetivo, Horizonte                        |
| `H:M`    | Compra 1-3, Venda 1-3                      |
| `Q:S`    | Tese, Notícia/Obs, **Atualizado em** (hoje) |

As colunas de fórmula (`G`, `N`, `O`, `P`) e a identificação (`A`, `B`, `E`, `F`)
nunca são gravadas.

## Decisões de comportamento

- **Preço `#N/A`** (GOOGLEFINANCE sem cotação, ex.: OBTC3): o card mostra
  "sem preço", as distâncias viram `—`, o ticker vai para o fim da ordenação e o
  resto do app continua normal.
- **Edição concorrente** (celular e PC ao mesmo tempo): *last-write-wins*, sem
  merge. Depois de salvar, o app relê a planilha para confirmar o que ficou.
- **Fuso horário**: tudo em `America/Sao_Paulo`. As datas seriais do Sheets são
  tratadas como hora de parede, então o que aparece no app é o que está na
  planilha, independente do fuso do celular.
- **Cache x dados frescos**: o app pinta na hora com o último cache e revalida em
  seguida; revalida de novo sempre que volta ao primeiro plano (se os dados
  tiverem mais de 1 minuto). O botão **↻ Recarregar** e o *pull-to-refresh*
  forçam a releitura a qualquer momento.
- **Offline**: leitura funciona com os últimos dados; os campos de edição ficam
  desabilitados com aviso, e nada é enfileirado para envio posterior.
- **Erros da API**: 429 e 5xx têm retry com backoff exponencial (2s, 4s, 8s);
  401, 403 e 404 aparecem na tela com a causa provável (sessão expirada, chave
  restrita, planilha não compartilhada, ID errado).
- **Login**: pedido só ao salvar, dentro do clique do botão (senão o navegador
  bloqueia o pop-up). Se o token tiver expirado e a API devolver 401, o app pede
  um novo token e repete a gravação uma vez, de forma transparente. O botão
  mostra "Entrar e salvar" enquanto não há sessão, e "Salvar" depois.
- **Ordenação do dashboard**: sinais ativos (COMPRA/VENDA) primeiro, depois pela
  menor distância até o próximo gatilho, depois alfabética.

## Fora de escopo

Notificações push (o e-mail do Apps Script já faz esse papel), gráficos de
candle, integração com corretora e multiusuário.

O login era fora de escopo no desenho original, mas entrou por imposição do
Google: sem uma credencial que identifique uma pessoa, a API de Sheets não
grava. Ele fica restrito à edição — consultar segue público e sem login.
