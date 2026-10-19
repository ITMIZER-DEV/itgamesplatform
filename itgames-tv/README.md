# ITGames Telão (Android TV / Fire TV)

App nativo (Kotlin + Jetpack Compose) que mostra o leaderboard ao vivo numa TV. Recebe o placar já calculado por
**websocket** (`ws://servidor/ws/leaderboard?game=CODIGO`) e se atualiza sozinho a cada súmula lançada.

- Funciona em Android TV 5.1+ e Fire TV (Stick 2ª geração em diante).
- Rotaciona categorias a cada 15 s; categorias grandes são paginadas (7 equipes por tela).
- Reconecta sozinho (2 s → 30 s) e mantém o último placar na tela se a rede cair.
- Mantém a tela ligada.

## Controle remoto

| Tecla | Ação |
| --- | --- |
| ◀ ▶ | página/categoria anterior ou próxima |
| OK | pausa/retoma a rotação |
| MENU (☰) | abre a configuração (servidor e campeonato) |

Na primeira abertura aparece a tela de configuração: confira o endereço do servidor, aperte **Atualizar** e escolha o
campeonato (só aparecem campeonatos liberados/`live`). A escolha fica salva no aparelho.

## Gerar o APK

Requer JDK 17+ e Android SDK (platform 34). Crie `local.properties` com `sdk.dir=C:/caminho/Android/Sdk`.

```bash
./gradlew :app:assembleRelease -PapiUrl=https://api.seudominio.com.br
# saída: app/build/outputs/apk/release/app-release.apk
./gradlew :app:testDebugUnitTest   # testes
```

`-PapiUrl` só define o endereço sugerido na tela de configuração. O release é assinado com a chave de debug (serve para
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

O cálculo de pontos fica em `itgames-api/src/modules/leaderboard/board.ts` e espelha
`itgames-platform/src/lib/scoring.ts`; ao mudar uma regra de pontuação, atualize os dois.
