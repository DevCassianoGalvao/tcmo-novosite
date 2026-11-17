/**
 * TCMO — envio dos formulários do site por e-mail via Brevo (API transacional).
 *
 * Rota: POST /api/contato  (Vercel Serverless Function, Node 18+)
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   BREVO_API_KEY      chave v3 do Brevo (Settings → SMTP & API → API Keys)        [obrigatória]
 *   CLINIC_EMAIL       e-mail que recebe os leads (padrão: admtcmo@outlook.com)    [opcional]
 *   SENDER_EMAIL       remetente verificado no Brevo (ex.: noreply@tcmo.com.br)    [obrigatória]
 *   SENDER_NAME        nome do remetente (padrão: "Site TCMO")                       [opcional]
 *   CLINIC_EMAIL_CC    cópias, separadas por vírgula                                 [opcional]
 *   BREVO_LIST_ID      ID de lista para salvar o contato quando houver e-mail       [opcional]
 *   ALLOWED_ORIGINS    domínios aceitos, separados por vírgula                       [opcional]
 *                      (ex.: https://tcmo.com.br,https://www.tcmo.com.br,https://tcmo-novosite.vercel.app)
 */

const BREVO = 'https://api.brevo.com/v3';
// Caixa que recebe os leads do site (pode ser trocada pela variável CLINIC_EMAIL).
const DEFAULT_CLINIC_EMAIL = 'admtcmo@outlook.com';

const LIMITS = { nome: 120, telefone: 40, email: 160, interesse: 160, mensagem: 2000, item: 120, itens: 30 };

function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanMultiline(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim().slice(0, max);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return null;
}

function row(label, value) {
  if (!value) return '';
  return '<tr><td style="padding:14px 0;border-bottom:1px solid #EFE8DB">' +
    '<div style="color:#8A8F9C;font:13px Arial,sans-serif;margin:0 0 4px">' + esc(label) + '</div>' +
    '<div style="color:#0B1526;font:16px/1.45 Arial,sans-serif">' + value + '</div></td></tr>';
}

function listaPt(itens) {
  if (itens.length <= 1) return itens.join('');
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
}

function waMessage(d) {
  const primeiro = d.nome.split(' ')[0];
  const sobre = d.tipo === 'pre-avaliacao'
    ? 'a sua pré-avaliação pelo site, com interesse em ' + listaPt(d.selecoes.map((s) => s.item.toLowerCase()))
    : 'a sua mensagem pelo site' + (d.interesse ? ' sobre ' + d.interesse.toLowerCase() : '');
  return 'Olá, ' + primeiro + '! Aqui é da TCMO Clínica Integrada. Recebemos ' + sobre +
    '. Vamos agendar a sua avaliação? Qual o melhor dia e horário para você?';
}

function buildEmail(d) {
  const origem = d.tipo === 'pre-avaliacao' ? 'Pré-avaliação do site' : 'Formulário de contato do site';
  const zap = d.telefone.replace(/\D/g, '');
  const waMsg = waMessage(d);
  const zapLink = zap.length >= 10 ? 'https://wa.me/' + (zap.startsWith('55') ? zap : '55' + zap) + '?text=' + encodeURIComponent(waMsg) : '';
  const primeiro = d.nome.split(' ')[0];

  let selecoesHtml = '';
  let selecoesTxt = '';
  if (d.selecoes.length) {
    const grupos = {};
    d.selecoes.forEach((s) => { (grupos[s.area] = grupos[s.area] || []).push(s.item); });
    selecoesHtml = Object.keys(grupos).map((g) =>
      '<div style="margin:0 0 6px"><strong>' + esc(g) + ':</strong> ' + grupos[g].map(esc).join(', ') + '</div>').join('');
    selecoesTxt = Object.keys(grupos).map((g) => g + ': ' + grupos[g].join(', ')).join('\n');
  }

  const intro = d.tipo === 'pre-avaliacao'
    ? esc(primeiro) + ' montou uma pré-avaliação no site e quer agendar uma avaliação.'
    : esc(primeiro) + ' enviou uma mensagem pelo site.';

  const botao = zapLink
    ? '<tr><td style="padding:4px 28px 8px">' +
      '<p style="margin:0 0 16px;color:#0B1526;font:16px/1.5 Arial,sans-serif">' + intro + ' Toque no botão para abrir a conversa no WhatsApp com a mensagem já escrita.</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" bgcolor="#25D366" style="border-radius:999px">' +
      '<a href="' + esc(zapLink) + '" style="display:block;padding:16px 24px;color:#ffffff;font:bold 16px Arial,sans-serif;text-decoration:none;border-radius:999px">Chamar ' + esc(primeiro) + ' no WhatsApp</a>' +
      '</td></tr></table>' +
      '<p style="margin:14px 0 0;padding:14px 16px;background:#F7F3EC;border-radius:12px;color:#4A5160;font:14px/1.5 Arial,sans-serif">' +
      '<span style="display:block;color:#8A8F9C;font-size:12px;margin-bottom:4px">Mensagem que vai abrir:</span>' + esc(waMsg) + '</p>' +
      '</td></tr>'
    : '<tr><td style="padding:4px 28px 8px"><p style="margin:0;color:#0B1526;font:16px/1.5 Arial,sans-serif">' + intro + '</p></td></tr>';

  const html =
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;background:#F3ECDF;padding:16px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">' +
    '<tr><td style="background:#0B1526;padding:22px 28px;color:#D9C6A1;font:22px Georgia,serif">TCMO Clínica Integrada' +
    '<div style="color:#A9B2C3;font:13px Arial,sans-serif;margin-top:4px">' + esc(origem) + '</div></td></tr>' +
    '<tr><td style="height:20px"></td></tr>' + botao +
    '<tr><td style="padding:8px 28px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">' +
    row('Nome', esc(d.nome)) +
    row('WhatsApp', esc(d.telefone)) +
    row('E-mail', d.email ? '<a href="mailto:' + esc(d.email) + '" style="color:#0B1526">' + esc(d.email) + '</a>' : '') +
    row('Interesse', esc(d.interesse)) +
    row('O que marcou', selecoesHtml) +
    row('Mensagem', d.mensagem ? esc(d.mensagem).replace(/\n/g, '<br>') : '') +
    '</table></td></tr>' +
    '<tr><td style="padding:18px 28px 26px;color:#8A8F9C;font:12px Arial,sans-serif">Enviado pelo site em ' + esc(d.quando) +
    (d.pagina ? ' a partir de ' + esc(d.pagina) : '') + '.</td></tr>' +
    '</table></body></html>';

  const text = [
    'TCMO Clínica Integrada | ' + origem,
    '',
    intro.replace(/<[^>]+>/g, ''),
    zapLink ? 'Abrir no WhatsApp: ' + zapLink : '',
    '',
    'Nome: ' + d.nome,
    d.telefone ? 'WhatsApp: ' + d.telefone : '',
    d.email ? 'E-mail: ' + d.email : '',
    d.interesse ? 'Interesse: ' + d.interesse : '',
    selecoesTxt ? 'O que marcou:\n' + selecoesTxt : '',
    d.mensagem ? 'Mensagem:\n' + d.mensagem : '',
    '',
    'Enviado pelo site em ' + d.quando + '.'
  ].filter(Boolean).join('\n');

  const resumo = d.interesse || (d.selecoes[0] && d.selecoes[0].item) || 'Avaliação';
  const subject = (d.tipo === 'pre-avaliacao' ? 'Pré-avaliação' : 'Novo contato') + ': ' + d.nome + ' | ' + resumo;
  return { html, text, subject: subject.slice(0, 180) };
}

async function brevo(path, apiKey, payload) {
  const r = await fetch(BREVO + path, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await r.text();
  return { ok: r.ok, status: r.status, body };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowed.length && origin && allowed.indexOf(origin) === -1) {
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
  }

  const { BREVO_API_KEY, SENDER_EMAIL } = process.env;
  const CLINIC_EMAIL = process.env.CLINIC_EMAIL || DEFAULT_CLINIC_EMAIL;
  if (!BREVO_API_KEY || !SENDER_EMAIL) {
    return res.status(503).json({ ok: false, error: 'Envio por e-mail ainda não configurado.' });
  }

  const b = parseBody(req);
  if (!b) return res.status(400).json({ ok: false, error: 'Dados inválidos.' });

  // Campo-armadilha: pessoas não veem, robôs preenchem. Responde 200 sem enviar.
  if (clean(b.empresa, 100)) return res.status(200).json({ ok: true });

  const d = {
    tipo: b.tipo === 'pre-avaliacao' ? 'pre-avaliacao' : 'contato',
    nome: clean(b.nome, LIMITS.nome),
    telefone: clean(b.telefone, LIMITS.telefone),
    email: clean(b.email, LIMITS.email).toLowerCase(),
    interesse: clean(b.interesse, LIMITS.interesse),
    mensagem: cleanMultiline(b.mensagem, LIMITS.mensagem),
    pagina: clean(b.pagina, 200),
    selecoes: Array.isArray(b.selecoes)
      ? b.selecoes.slice(0, LIMITS.itens).map((s) => ({ area: clean(s && s.area, 40) || 'Outros', item: clean(s && s.item, LIMITS.item) })).filter((s) => s.item)
      : [],
    quando: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  };

  if (!d.nome) return res.status(422).json({ ok: false, error: 'Informe o nome.' });
  if (d.email && !isEmail(d.email)) d.email = '';
  if (d.tipo === 'pre-avaliacao' && !d.selecoes.length) return res.status(422).json({ ok: false, error: 'Nenhum item selecionado.' });

  const mail = buildEmail(d);
  const cc = (process.env.CLINIC_EMAIL_CC || '').split(',').map((s) => s.trim()).filter(isEmail).map((email) => ({ email }));
  const payload = {
    sender: { name: process.env.SENDER_NAME || 'Site TCMO', email: SENDER_EMAIL },
    to: [{ email: CLINIC_EMAIL, name: 'TCMO Clínica Integrada' }],
    subject: mail.subject,
    htmlContent: mail.html,
    textContent: mail.text,
    tags: ['site', d.tipo]
  };
  if (cc.length) payload.cc = cc;
  if (d.email) payload.replyTo = { email: d.email, name: d.nome };

  try {
    const sent = await brevo('/smtp/email', BREVO_API_KEY, payload);
    if (!sent.ok) {
      console.error('Brevo /smtp/email', sent.status, sent.body);
      return res.status(502).json({ ok: false, error: 'Não foi possível enviar agora.' });
    }

    // Opcional: guardar o contato numa lista do Brevo (só quando a pessoa informou e-mail).
    const listId = parseInt(process.env.BREVO_LIST_ID || '', 10);
    if (listId && d.email) {
      const c = await brevo('/contacts', BREVO_API_KEY, {
        email: d.email, updateEnabled: true, listIds: [listId],
        attributes: { FIRSTNAME: d.nome.split(' ')[0] }
      });
      if (!c.ok) console.error('Brevo /contacts', c.status, c.body);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Brevo erro', err);
    return res.status(502).json({ ok: false, error: 'Não foi possível enviar agora.' });
  }
};

module.exports.buildEmail = buildEmail;
