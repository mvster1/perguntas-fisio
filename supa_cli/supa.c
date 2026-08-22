/*
 * supa - console de SQL para o projeto do supabase.
 *
 * Envia consultas para a Management API (POST /v1/projects/<ref>/database/query),
 * que executa SQL puro no banco. Fala HTTPS pelo WinHTTP, sem dependencia externa.
 *
 * Uso:
 *   supa                     abre o console
 *   supa "select 1;"         executa e sai
 *
 * O token de acesso vem de SUPABASE_ACCESS_TOKEN; se faltar, o programa pede.
 */

#include <windows.h>
#include <winhttp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define HOST          L"api.supabase.com"
#define REF_PADRAO    "kfzltqcbnzqshdanwlvk"
#define TAM_ENTRADA   65536
#define TAM_CORPO     (TAM_ENTRADA * 6 + 64)

static char token[512];
static char ref[128];

/* preenchidos a cada resposta, a partir dos cabecalhos x-ratelimit-* */
static int cota_limite = -1, cota_restante = -1, cota_reinicio = -1;

/* ---------- utilidades ---------- */

static wchar_t *para_wide(const char *s)
{
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, NULL, 0);
    wchar_t *w = malloc((size_t)n * sizeof(wchar_t));
    if (w) MultiByteToWideChar(CP_UTF8, 0, s, -1, w, n);
    return w;
}

/* escapa a consulta para caber dentro de uma string JSON */
static void escapar_json(const char *entrada, char *saida, size_t limite)
{
    size_t j = 0;
    for (size_t i = 0; entrada[i] && j + 8 < limite; i++) {
        unsigned char c = (unsigned char)entrada[i];
        switch (c) {
            case '"':  saida[j++] = '\\'; saida[j++] = '"';  break;
            case '\\': saida[j++] = '\\'; saida[j++] = '\\'; break;
            case '\n': saida[j++] = '\\'; saida[j++] = 'n';  break;
            case '\r': saida[j++] = '\\'; saida[j++] = 'r';  break;
            case '\t': saida[j++] = '\\'; saida[j++] = 't';  break;
            default:
                if (c < 0x20) {
                    j += (size_t)sprintf(saida + j, "\\u%04x", c);
                } else {
                    saida[j++] = (char)c;   /* UTF-8 passa direto */
                }
        }
    }
    saida[j] = '\0';
}

/*
 * Impressao legivel do JSON de resposta. Nao e um parser: apenas quebra linha
 * na estrutura, ignorando pontuacao que esteja dentro de string.
 */
static void imprimir_json(const char *s)
{
    int nivel = 0, dentro_de_string = 0, escapado = 0;

    for (size_t i = 0; s[i]; i++) {
        char c = s[i];

        if (dentro_de_string) {
            putchar(c);
            if (escapado)        escapado = 0;
            else if (c == '\\')  escapado = 1;
            else if (c == '"')   dentro_de_string = 0;
            continue;
        }

        switch (c) {
            case '"':
                dentro_de_string = 1;
                putchar(c);
                break;
            case '{': case '[':
                putchar(c);
                nivel++;
                printf("\n%*s", nivel * 2, "");
                break;
            case '}': case ']':
                nivel--;
                printf("\n%*s", nivel * 2, "");
                putchar(c);
                break;
            case ',':
                putchar(c);
                printf("\n%*s", nivel * 2, "");
                break;
            case ':':
                printf(": ");
                break;
            case ' ': case '\n': case '\r': case '\t':
                break;   /* espaco original nao interessa */
            default:
                putchar(c);
        }
    }
    putchar('\n');
}

/* ---------- chamada HTTP ---------- */

/* le um cabecalho numerico da resposta; -1 quando ausente */
static int cabecalho_numero(HINTERNET requisicao, const wchar_t *nome)
{
    wchar_t valor[64];
    DWORD tam = sizeof valor;

    if (!WinHttpQueryHeaders(requisicao, WINHTTP_QUERY_CUSTOM, nome,
                             valor, &tam, WINHTTP_NO_HEADER_INDEX))
        return -1;

    return _wtoi(valor);
}

/* devolve 0 em caso de sucesso; imprime a resposta */
static int executar(const char *sql)
{
    static char corpo[TAM_CORPO];
    static char escapado[TAM_CORPO];
    char caminho[256];
    int status_final = 1;

    escapar_json(sql, escapado, sizeof escapado);
    snprintf(corpo, sizeof corpo, "{\"query\":\"%s\"}", escapado);
    snprintf(caminho, sizeof caminho, "/v1/projects/%s/database/query", ref);

    wchar_t *wcaminho = para_wide(caminho);
    char cabecalhos[768];
    snprintf(cabecalhos, sizeof cabecalhos,
             "Authorization: Bearer %s\r\nContent-Type: application/json\r\n", token);
    wchar_t *wcabecalhos = para_wide(cabecalhos);

    HINTERNET sessao = WinHttpOpen(L"supa-cli/1.0",
                                   WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                                   WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    HINTERNET conexao = NULL, requisicao = NULL;

    if (!sessao) { fprintf(stderr, "erro: WinHttpOpen falhou (%lu)\n", GetLastError()); goto fim; }

    conexao = WinHttpConnect(sessao, HOST, INTERNET_DEFAULT_HTTPS_PORT, 0);
    if (!conexao) { fprintf(stderr, "erro: nao conectou em api.supabase.com\n"); goto fim; }

    requisicao = WinHttpOpenRequest(conexao, L"POST", wcaminho, NULL,
                                    WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
                                    WINHTTP_FLAG_SECURE);
    if (!requisicao) { fprintf(stderr, "erro: WinHttpOpenRequest falhou\n"); goto fim; }

    if (!WinHttpSendRequest(requisicao, wcabecalhos, (DWORD)-1,
                            corpo, (DWORD)strlen(corpo), (DWORD)strlen(corpo), 0) ||
        !WinHttpReceiveResponse(requisicao, NULL)) {
        fprintf(stderr, "erro: falha ao enviar a consulta (%lu)\n", GetLastError());
        goto fim;
    }

    DWORD status = 0, tam = sizeof status;
    WinHttpQueryHeaders(requisicao,
                        WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                        WINHTTP_HEADER_NAME_BY_INDEX, &status, &tam, WINHTTP_NO_HEADER_INDEX);

    cota_limite   = cabecalho_numero(requisicao, L"x-ratelimit-limit");
    cota_restante = cabecalho_numero(requisicao, L"x-ratelimit-remaining");
    cota_reinicio = cabecalho_numero(requisicao, L"x-ratelimit-reset");

    /* le a resposta inteira */
    size_t capacidade = 65536, usado = 0;
    char *resposta = malloc(capacidade);
    if (!resposta) goto fim;

    DWORD disponivel = 0;
    do {
        if (!WinHttpQueryDataAvailable(requisicao, &disponivel)) break;
        if (disponivel == 0) break;

        if (usado + disponivel + 1 > capacidade) {
            while (usado + disponivel + 1 > capacidade) capacidade *= 2;
            char *maior = realloc(resposta, capacidade);
            if (!maior) { free(resposta); goto fim; }
            resposta = maior;
        }
        DWORD lido = 0;
        if (!WinHttpReadData(requisicao, resposta + usado, disponivel, &lido)) break;
        usado += lido;
    } while (disponivel > 0);
    resposta[usado] = '\0';

    if (status >= 200 && status < 300) {
        if (usado == 0 || strcmp(resposta, "[]") == 0)
            printf("ok (nenhuma linha retornada)\n");
        else
            imprimir_json(resposta);
        status_final = 0;
    } else {
        fprintf(stderr, "http %lu\n", status);
        imprimir_json(resposta);
    }
    free(resposta);

fim:
    if (requisicao) WinHttpCloseHandle(requisicao);
    if (conexao)    WinHttpCloseHandle(conexao);
    if (sessao)     WinHttpCloseHandle(sessao);
    free(wcaminho);
    free(wcabecalhos);
    return status_final;
}

/* ---------- console ---------- */

static void limpar_tela(void)
{
    HANDLE h = GetStdHandle(STD_OUTPUT_HANDLE);
    CONSOLE_SCREEN_BUFFER_INFO info;
    COORD origem = {0, 0};
    DWORD celulas, escritos;

    fflush(stdout);   /* stdout e bufferizado; sem isto o texto reapareceria */
    if (!GetConsoleScreenBufferInfo(h, &info)) return;

    celulas = (DWORD)info.dwSize.X * (DWORD)info.dwSize.Y;
    FillConsoleOutputCharacterA(h, ' ', celulas, origem, &escritos);
    FillConsoleOutputAttribute(h, info.wAttributes, celulas, origem, &escritos);
    SetConsoleCursorPosition(h, origem);
}

/*
 * Aberto por duplo clique, o console fecha junto com o processo e a saida some.
 * Nesse caso ha um unico processo anexado ao console, e vale segurar a janela.
 */
static void pausar_se_janela_propria(void)
{
    DWORD pids[4];
    if (GetConsoleProcessList(pids, 4) <= 1) {
        printf("\n(tecle enter para fechar)");
        fflush(stdout);
        getchar();
    }
}

static void ajuda(void)
{
    printf("\ndigite o sql e tecle enter; a consulta e executada na hora.\n");
    printf("para dividir em varias linhas, termine a linha com \\\n\n");
    printf("  \\t          lista as tabelas do schema public\n");
    printf("  \\d <tabela> mostra as colunas da tabela\n");
    printf("  \\f          lista as funcoes do schema public\n");
    printf("  \\r          quantas consultas ainda cabem no minuto\n");
    printf("  clear       limpa a tela (ou \\l, ou ctrl+L e enter)\n");
    printf("  \\h          esta ajuda\n");
    printf("  \\q          sai\n\n");
}

static int comando(const char *linha, int *sair)
{
    static const char *sql_tabelas =
        "select table_name from information_schema.tables "
        "where table_schema = 'public' order by 1;";
    static const char *sql_funcoes =
        "select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as funcao "
        "from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
        "where n.nspname = 'public' order by 1;";

    if (_stricmp(linha, "clear") == 0 || _stricmp(linha, "cls") == 0) {
        limpar_tela();
        return 1;
    }

    if (linha[0] != '\\') return 0;

    switch (linha[1]) {
        case 'q': *sair = 1; return 1;
        case 'h': ajuda();   return 1;
        case 'l': limpar_tela(); return 1;
        case 'r':
            if (cota_restante < 0) {
                printf("faca uma consulta primeiro; a cota vem nos cabecalhos da resposta.\n");
            } else {
                printf("consultas: %d de %d restantes, reinicia em %d s\n",
                       cota_restante, cota_limite, cota_reinicio);
            }
            return 1;
        case 't': executar(sql_tabelas); return 1;
        case 'f': executar(sql_funcoes); return 1;
        case 'd': {
            const char *tabela = linha + 2;
            while (*tabela == ' ') tabela++;
            if (!*tabela) { printf("uso: \\d <tabela>\n"); return 1; }

            char sql[512];
            snprintf(sql, sizeof sql,
                     "select column_name, data_type, is_nullable "
                     "from information_schema.columns where table_name = '%s' "
                     "order by ordinal_position;", tabela);
            executar(sql);
            return 1;
        }
        default:
            printf("comando desconhecido. \\h mostra a ajuda.\n");
            return 1;
    }
}

static void tirar_fim_de_linha(char *s, size_t *tam)
{
    size_t n = strlen(s);
    while (n && (s[n-1] == '\n' || s[n-1] == '\r')) s[--n] = '\0';
    *tam = n;
}

static void carregar_credenciais(void)
{
    DWORD n = GetEnvironmentVariableA("SUPABASE_ACCESS_TOKEN", token, sizeof token);
    if (n == 0 || n >= sizeof token) token[0] = '\0';

    n = GetEnvironmentVariableA("SUPABASE_PROJECT_REF", ref, sizeof ref);
    if (n == 0 || n >= sizeof ref) snprintf(ref, sizeof ref, "%s", REF_PADRAO);
}

/* pede o token na propria janela quando ele nao esta no ambiente */
static int pedir_token(void)
{
    size_t tam;

    printf("token de acesso nao encontrado no ambiente.\n");
    printf("cole o token (sbp_...) e tecle enter: ");
    fflush(stdout);

    if (!fgets(token, sizeof token, stdin)) return 0;
    tirar_fim_de_linha(token, &tam);
    while (tam && token[tam-1] == ' ') token[--tam] = '\0';

    if (!token[0]) {
        printf("nenhum token informado.\n");
        return 0;
    }

    printf("\npara nao precisar colar de novo, rode uma vez no powershell:\n");
    printf("  setx SUPABASE_ACCESS_TOKEN \"<seu token>\"\n\n");
    return 1;
}

int main(int argc, char **argv)
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    setvbuf(stdout, NULL, _IOFBF, 1 << 16);

    carregar_credenciais();

    /* modo direto: supa "select 1;" */
    if (argc > 1) {
        if (!token[0]) {
            fprintf(stderr, "defina SUPABASE_ACCESS_TOKEN antes de usar o modo direto.\n");
            return 1;
        }
        char sql[TAM_ENTRADA] = {0};
        for (int i = 1; i < argc; i++) {
            strncat(sql, argv[i], sizeof sql - strlen(sql) - 2);
            if (i + 1 < argc) strcat(sql, " ");
        }
        int r = executar(sql);
        fflush(stdout);
        return r;
    }

    printf("supa - sql no projeto %s\n", ref);

    if (!token[0] && !pedir_token()) {
        fflush(stdout);
        pausar_se_janela_propria();
        return 1;
    }

    printf("digite o sql e tecle enter. \\h ajuda, \\q sai\n\n");

    char acumulado[TAM_ENTRADA] = {0};
    char linha[4096];
    int sair = 0;

    while (!sair) {
        printf("%s", acumulado[0] ? "  ... " : "supa> ");
        fflush(stdout);

        if (!fgets(linha, sizeof linha, stdin)) break;

        size_t tam;
        tirar_fim_de_linha(linha, &tam);

        /* ctrl+L chega como form feed dentro da linha */
        if (strchr(linha, '\f')) {
            limpar_tela();
            acumulado[0] = '\0';
            continue;
        }

        if (!acumulado[0]) {
            if (!tam) continue;
            if (comando(linha, &sair)) { fflush(stdout); continue; }
        }

        /* barra invertida no fim da linha continua a consulta na proxima */
        int continua = (tam > 0 && linha[tam-1] == '\\');
        if (continua) linha[--tam] = '\0';

        if (strlen(acumulado) + tam + 2 >= sizeof acumulado) {
            fprintf(stderr, "consulta longa demais.\n");
            acumulado[0] = '\0';
            continue;
        }
        if (acumulado[0]) strcat(acumulado, "\n");
        strcat(acumulado, linha);

        if (!continua) {
            executar(acumulado);
            fflush(stdout);
            acumulado[0] = '\0';
        }
    }

    fflush(stdout);
    pausar_se_janela_propria();
    return 0;
}
