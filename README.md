# TCMO Clínica Integrada — site

Site estático (HTML, CSS e JS) publicado na Vercel, com uma função serverless para enviar os formulários por e-mail via Brevo.

## Estrutura
- `index.html` — página
- `assets/` — CSS, JS, fontes, imagens e bibliotecas (GSAP, ScrollTrigger, Lenis)
- `api/contato.js` — `POST /api/contato`: recebe o formulário de contato e a pré-avaliação e envia para o e-mail da clínica pela API transacional do Brevo

## E-mail dos formulários (Brevo)
1. No Brevo, crie uma chave em **Settings → SMTP & API → API Keys** (chave de API v3, não a chave SMTP).
2. Em **Senders & IP**, adicione e verifique o remetente (ex.: `site@tcmo.com.br`). Para melhor entrega, autentique o domínio (DKIM/DMARC).
3. Na Vercel, em **Settings → Environment Variables**, cadastre as variáveis do `.env.example`:
   - `BREVO_API_KEY` e `SENDER_EMAIL` (obrigatórias)
   - `CLINIC_EMAIL` (padrão: admtcmo@outlook.com), `SENDER_NAME`, `CLINIC_EMAIL_CC`, `BREVO_LIST_ID`, `ALLOWED_ORIGINS` (opcionais)
4. Faça um novo deploy (Deployments → Redeploy) para as variáveis valerem.

Sem as variáveis, a rota responde 503 e o site continua funcionando normalmente: o formulário só abre o WhatsApp.

O que chega no e-mail: nome, WhatsApp (com link), e-mail, interesse, itens marcados na pré-avaliação, mensagem, data e página de origem. Se a pessoa informar e-mail, ele vira o "responder para". Com `BREVO_LIST_ID`, o contato também é salvo nessa lista.

Proteções: campo-armadilha contra robôs, limite de tamanho dos campos, texto escapado no HTML e, opcionalmente, bloqueio de domínios fora de `ALLOWED_ORIGINS`.

### Testar depois de configurar
```bash
curl -X POST https://tcmo-novosite.vercel.app/api/contato \
  -H "Content-Type: application/json" \
  -d '{"tipo":"contato","nome":"Teste","telefone":"(11) 90000-0000","interesse":"Medicina","mensagem":"Teste de envio"}'
```
Resposta esperada: `{"ok":true}` e o e-mail na caixa da clínica.
