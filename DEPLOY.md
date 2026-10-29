# Deploy — passo a passo

## Parte 1 — GitHub

### Já feito por mim
- Git 2.56 instalado
- GitHub CLI 2.103.3 instalado
- Repositório inicializado em `C:\dev\portfolio` (branch `main`)
- Todos os arquivos adicionados ao stage (dados de teste ficaram de fora via `.gitignore`)

### Falta só o seu login
Eu não consigo — e não devo — criar conta ou autenticar no seu nome. Autentique uma vez:

```
! gh auth login --web --git-protocol https
```

No fluxo:
1. **What is your preferred protocol?** → `HTTPS`
2. **Authenticate Git with your GitHub credentials?** → `Yes`
3. **How would you like to authenticate?** → `Login with a web browser`
4. Copie o código de 8 dígitos que aparecer e cole no navegador
5. Autorize

Depois me avise — eu faço o resto:
- configuro `user.name` / `user.email` com os dados da sua conta
- faço o commit
- crio o repositório (me diga se **público** ou **privado**)
- faço o push

### Alternativa manual (sem gh)
1. Crie o repositório em <https://github.com/new> chamado `portfolio`
2. Rode:
   ```
   cd C:\dev\portfolio
   git config user.name "Seu Nome"
   git config user.email "seu@email.com"
   git commit -m "feat: automation pipeline and landing form"
   git remote add origin https://github.com/SEU_USUARIO/portfolio.git
   git push -u origin main
   ```

---

## Parte 2 — Render (demo ao vivo)

O `render.yaml` já está no repositório: ele cria **os dois serviços de uma vez**.

1. Acesse <https://render.com> e clique em **Get Started → GitHub**
2. Autorize o Render a ver seus repositórios
3. **New +** → **Blueprint**
4. Selecione o repositório `portfolio`
5. Render lê o `render.yaml` e mostra 2 serviços → **Apply**
6. Aguarde o build (~2 min). Você recebe duas URLs, algo como:
   - `https://automation-pipeline-xxxx.onrender.com`
   - `https://landing-form-xxxx.onrender.com`

### Se o Blueprint falhar
Crie manualmente **New + → Web Service** duas vezes:

| Campo | Serviço 1 | Serviço 2 |
|---|---|---|
| Repository | portfolio | portfolio |
| Runtime | Node | Node |
| Build command | `echo "no dependencies"` | `echo "no dependencies"` |
| Start command | `node automation-pipeline/src/server.js` | `node landing-form/server.js` |
| Instance type | Free | Free |

### Limitações do plano free (importante)
- O serviço **dorme após 15 min** sem acesso. A primeira visita depois disso leva ~30–60 s.
- O disco é **efêmero**: os dados em `data/` resetam a cada deploy/restart. Para demo de portfólio, tudo bem.
- Se quiser que o link nunca durma, o plano pago começa em ~US$7/mês — não vale a pena agora.

### Depois de publicado
1. Abra as duas URLs e confirme que funcionam
2. Coloque os links no topo do perfil do Upwork e no `README.md` do GitHub
3. Tire um print do "Application is live" para o portfólio

---

## Parte 3 — Upwork

Siga o `UPWORK-PERFIL.md`. O cadastro exige verificação de identidade (documento + selfie) — isso só você pode fazer.
