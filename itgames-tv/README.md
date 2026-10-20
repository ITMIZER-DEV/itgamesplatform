# ITGames Telão (Android TV / Fire TV)

App nativo (Kotlin + Jetpack Compose) que mostra o leaderboard ao vivo numa TV. Recebe o placar já calculado por
**websocket** (`ws://servidor/ws/screen?token=CREDENCIAL`) e se atualiza sozinho a cada súmula lançada.

- Funciona em Android TV 5.1+ e Fire TV (Stick 2ª geração em diante).
- Rotaciona categorias a cada 15 s; categorias grandes são paginadas (7 equipes por tela).
- Reconecta sozinho (2 s → 30 s) e mantém o último placar na tela se a rede cair.
- Mantém a tela ligada.

## Controle remoto

| Tecla | Ação |
| --- | --- |
| ◀ ▶ | página/categoria anterior ou próxima |
| OK | pausa/retoma a rotação |
| MENU (☰) | abre a tela do servidor (endereço e Desparear) |

Na primeira abertura a TV mostra um **código de pareamento** grande (não precisa digitar nada no controle). No painel do
organizador, abra **Telões** e digite o código: a TV recebe uma credencial, guarda só no aparelho e passa a mostrar o telão
configurado no painel. Ao reabrir, reconecta sozinha e mantém o último placar se a rede cair. O código expira e a TV pede
outro automaticamente. Se o telão for removido no painel (ou a credencial for invalidada), a TV volta ao pareamento.

A tela do **MENU** edita o endereço do servidor e tem o botão **Desparear** (apaga a credencial deste aparelho).

## Gerar o APK

Requer JDK 17+ e Android SDK (platform 34). Crie `local.properties` com `sdk.dir=C:/caminho/Android/Sdk`.

```bash
./gradlew :app:assembleRelease -PapiUrl=https://api.seudominio.com.br
# saída: app/build/outputs/apk/release/app-release.apk
./gradlew :app:testDebugUnitTest   # testes
```

`-PapiUrl` só define o endereço sugerido do servidor. O release é assinado com a chave de debug (serve para
sideload); para publicar em loja, configure uma keystore própria em `app/build.gradle.kts`.

## Instalar

**Fire TV Stick:** Configurações → Meu Fire TV → Opções do desenvolvedor → ative *Depuração ADB* e *Apps de fontes
desconhecidas*; anote o IP em Sobre → Rede. Depois:

```bash
adb connect IP_DO_FIRESTICK:5555
adb install -r itgames-telao.apk
```

**Android TV:** ative as opções do desenvolvedor, depuração por rede, e use o mesmo `adb connect` / `adb install`. Sem
computador, dá para instalar pelo app *Downloader* apontando para um link do APK.

O app aparece na tela inicial como **ITGames Telão**.

## Servidor

O websocket vive na API (`itgames-api/src/modules/leaderboard`). Ele usa a mesma regra de visibilidade do
`GET /events/:code/leaderboard`: só campeonatos `live`. Se a API estiver atrás de proxy reverso (Nginx, Traefik,
Cloudflare), habilite *upgrade* de websocket para o caminho `/ws/leaderboard`.

O websocket envia o mesmo placar de `GET /events/:code/board`, calculado pela regra de cada campeonato: `points_table`
(PTS), `rank_sum` (SOMA das posições) ou `total_time` (TEMPO total, como no HYROX). O total na TV mostra a unidade da
regra (sem sufixo no tempo) e equipes canceladas aparecem esmaecidas com o selo CANCELADA. O cálculo fica em
`itgames-api/src/modules/scoring`.

## Identidade visual

Segue o tema escuro da plataforma (`itgames-platform/src/app/globals.css`): fundo `#090a0f`, card `#11131a`, muted `#1e2230`,
borda `#232838`, texto `#f3f4f6`, âmbar `#f59e0b`. Os tokens ficam em `ui/Theme.kt` (`Palette`).

- `res/drawable-nodpi/logo_itgames.png`: logo (720 px, sem a frase) usada no cabeçalho, na espera e na configuração.
- `res/drawable-xhdpi/banner.png`: banner da TV (640x360) com a logo completa.
- `res/drawable-nodpi/ic_launcher.png`: ícone (256x256) com o monograma "IT".

Os PNGs vêm de `itgames-platform/public/brand/logo-itgames-dark.png` (recortados e reduzidos).
