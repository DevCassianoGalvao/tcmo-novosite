<?php
/**
 * TCMO — envio dos formulários por e-mail via Brevo (versão PHP para servidor próprio / cPanel).
 * Mesma lógica de api/contato.js (que só roda na Vercel).
 *
 * Lê as variáveis do arquivo .env na raiz do site (ou uma pasta acima dela, fora do public_html).
 * Variáveis: BREVO_API_KEY, SENDER_EMAIL [obrigatórias]; CLINIC_EMAIL, SENDER_NAME,
 * CLINIC_EMAIL_CC, BREVO_LIST_ID, ALLOWED_ORIGINS [opcionais].
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($status, $data) { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

/* ---------- .env ---------- */
function load_env() {
  $env = [];
  foreach ([dirname(__DIR__) . '/.env', dirname(__DIR__, 2) . '/.env'] as $f) {
    if (!is_readable($f)) continue;
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
      $line = trim($line);
      if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
      list($k, $v) = explode('=', $line, 2);
      $k = trim($k); $v = trim($v);
      if (strlen($v) > 1 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) $v = substr($v, 1, -1);
      if (!isset($env[$k])) $env[$k] = $v;
    }
  }
  return $env;
}
$ENV = load_env();
function env($k, $def = '') { global $ENV; $v = getenv($k); if ($v !== false && $v !== '') return $v; return isset($ENV[$k]) && $ENV[$k] !== '' ? $ENV[$k] : $def; }

/* ---------- utilidades ---------- */
function clean($v, $max) {
  if (!is_string($v)) return '';
  $v = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v);
  $v = trim(preg_replace('/\s+/u', ' ', $v));
  return mb_substr($v, 0, $max, 'UTF-8');
}
function clean_multi($v, $max) {
  if (!is_string($v)) return '';
  $v = preg_replace('/\r\n?/', "\n", $v);
  $v = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/u', ' ', $v);
  return mb_substr(trim($v), 0, $max, 'UTF-8');
}
function esc($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function is_email($e) { return (bool)preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', $e); }
function row($label, $value) {
  if ($value === '' || $value === null) return '';
  return '<tr><td style="padding:10px 16px;color:#6B7385;font:14px Arial,sans-serif;vertical-align:top;width:150px">' . esc($label) .
    '</td><td style="padding:10px 16px;color:#0B1526;font:15px Arial,sans-serif">' . $value . '</td></tr>';
}

function build_email($d) {
  $origem = $d['tipo'] === 'pre-avaliacao' ? 'Pré-avaliação do site' : 'Formulário de contato do site';
  $zap = preg_replace('/\D/', '', $d['telefone']);
  $zapLink = strlen($zap) >= 10 ? 'https://wa.me/' . (strpos($zap, '55') === 0 ? $zap : '55' . $zap) : '';

  $selHtml = ''; $selTxt = '';
  if ($d['selecoes']) {
    $g = [];
    foreach ($d['selecoes'] as $s) $g[$s['area']][] = $s['item'];
    foreach ($g as $area => $itens) {
      $selHtml .= '<p style="margin:0 0 6px"><strong>' . esc($area) . ':</strong> ' . implode(', ', array_map('esc', $itens)) . '</p>';
      $selTxt .= ($selTxt ? "\n" : '') . $area . ': ' . implode(', ', $itens);
    }
  }

  $tel = '';
  if ($d['telefone']) $tel = $zapLink ? '<a href="' . $zapLink . '" style="color:#0B1526">' . esc($d['telefone']) . '</a>' : esc($d['telefone']);
  $mail = $d['email'] ? '<a href="mailto:' . esc($d['email']) . '" style="color:#0B1526">' . esc($d['email']) . '</a>' : '';

  $html = '<!doctype html><html><body style="margin:0;background:#F3ECDF;padding:24px">' .
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">' .
    '<tr><td style="background:#0B1526;padding:22px 24px;color:#D9C6A1;font:20px Georgia,serif">TCMO Clínica Integrada' .
    '<div style="color:#A9B2C3;font:13px Arial,sans-serif;margin-top:4px">' . esc($origem) . '</div></td></tr>' .
    '<tr><td style="padding:8px 8px 0"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">' .
    row('Nome', esc($d['nome'])) . row('WhatsApp', $tel) . row('E-mail', $mail) .
    row('Interesse', esc($d['interesse'])) . row('O que marcou', $selHtml) .
    row('Mensagem', $d['mensagem'] ? nl2br(esc($d['mensagem'])) : '') .
    '</table></td></tr>' .
    '<tr><td style="padding:16px 24px 24px;color:#6B7385;font:12px Arial,sans-serif">Enviado pelo site em ' . esc($d['quando']) .
    ($d['pagina'] ? ' a partir de ' . esc($d['pagina']) : '') . '.</td></tr></table></body></html>';

  $text = implode("\n", array_filter([
    'TCMO Clínica Integrada | ' . $origem, '',
    'Nome: ' . $d['nome'],
    $d['telefone'] ? 'WhatsApp: ' . $d['telefone'] : '',
    $d['email'] ? 'E-mail: ' . $d['email'] : '',
    $d['interesse'] ? 'Interesse: ' . $d['interesse'] : '',
    $selTxt ? "O que marcou:\n" . $selTxt : '',
    $d['mensagem'] ? "Mensagem:\n" . $d['mensagem'] : '', '',
    'Enviado pelo site em ' . $d['quando'] . '.'
  ], function ($l) { return $l !== null; }));

  $resumo = $d['interesse'] ?: ($d['selecoes'] ? $d['selecoes'][0]['item'] : 'Avaliação');
  $subject = ($d['tipo'] === 'pre-avaliacao' ? 'Pré-avaliação' : 'Novo contato') . ': ' . $d['nome'] . ' | ' . $resumo;
  return ['html' => $html, 'text' => $text, 'subject' => mb_substr($subject, 0, 180, 'UTF-8')];
}

function brevo($path, $key, $payload) {
  $url = 'https://api.brevo.com/v3' . $path;
  $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
  $headers = ['api-key: ' . $key, 'content-type: application/json', 'accept: application/json'];
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
      CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $resp = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['ok' => $status >= 200 && $status < 300, 'status' => $status, 'body' => $resp === false ? $err : $resp];
  }
  $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body,
    'timeout' => 20, 'ignore_errors' => true]]);
  $resp = @file_get_contents($url, false, $ctx);
  $status = 0;
  if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $status = (int)$m[1];
  return ['ok' => $status >= 200 && $status < 300, 'status' => $status, 'body' => (string)$resp];
}

/* ---------- requisição ---------- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); out(405, ['ok' => false, 'error' => 'Use POST.']); }

$allowed = array_filter(array_map('trim', explode(',', env('ALLOWED_ORIGINS'))));
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($allowed && $origin && !in_array($origin, $allowed, true)) out(403, ['ok' => false, 'error' => 'Origem não permitida.']);

$KEY = env('BREVO_API_KEY');
$SENDER = env('SENDER_EMAIL');
if (!$KEY || !$SENDER) out(503, ['ok' => false, 'error' => 'Envio por e-mail ainda não configurado.']);

$b = json_decode(file_get_contents('php://input'), true);
if (!is_array($b)) out(400, ['ok' => false, 'error' => 'Dados inválidos.']);

// Campo-armadilha: pessoas não veem, robôs preenchem.
if (clean(isset($b['empresa']) ? $b['empresa'] : '', 100) !== '') out(200, ['ok' => true]);

$g = function ($k) use ($b) { return isset($b[$k]) ? $b[$k] : ''; };
$sel = [];
if (isset($b['selecoes']) && is_array($b['selecoes'])) {
  foreach (array_slice($b['selecoes'], 0, 30) as $s) {
    if (!is_array($s)) continue;
    $item = clean(isset($s['item']) ? $s['item'] : '', 120);
    if ($item === '') continue;
    $sel[] = ['area' => clean(isset($s['area']) ? $s['area'] : '', 40) ?: 'Outros', 'item' => $item];
  }
}
$dt = new DateTime('now', new DateTimeZone('America/Sao_Paulo'));
$d = [
  'tipo' => $g('tipo') === 'pre-avaliacao' ? 'pre-avaliacao' : 'contato',
  'nome' => clean($g('nome'), 120),
  'telefone' => clean($g('telefone'), 40),
  'email' => strtolower(clean($g('email'), 160)),
  'interesse' => clean($g('interesse'), 160),
  'mensagem' => clean_multi($g('mensagem'), 2000),
  'pagina' => clean($g('pagina'), 200),
  'selecoes' => $sel,
  'quando' => $dt->format('d/m/Y H:i'),
];
if ($d['nome'] === '') out(422, ['ok' => false, 'error' => 'Informe o nome.']);
if ($d['email'] && !is_email($d['email'])) $d['email'] = '';
if ($d['tipo'] === 'pre-avaliacao' && !$sel) out(422, ['ok' => false, 'error' => 'Nenhum item selecionado.']);

$mail = build_email($d);
$payload = [
  'sender' => ['name' => env('SENDER_NAME', 'Site TCMO'), 'email' => $SENDER],
  'to' => [['email' => env('CLINIC_EMAIL', 'admtcmo@outlook.com'), 'name' => 'TCMO Clínica Integrada']],
  'subject' => $mail['subject'],
  'htmlContent' => $mail['html'],
  'textContent' => $mail['text'],
  'tags' => ['site', $d['tipo']],
];
$cc = array_values(array_filter(array_map('trim', explode(',', env('CLINIC_EMAIL_CC'))), 'is_email'));
if ($cc) $payload['cc'] = array_map(function ($e) { return ['email' => $e]; }, $cc);
if ($d['email']) $payload['replyTo'] = ['email' => $d['email'], 'name' => $d['nome']];

$sent = brevo('/smtp/email', $KEY, $payload);
if (!$sent['ok']) {
  error_log('Brevo /smtp/email ' . $sent['status'] . ' ' . $sent['body']);
  out(502, ['ok' => false, 'error' => 'Não foi possível enviar agora.']);
}

$listId = (int)env('BREVO_LIST_ID');
if ($listId && $d['email']) {
  $c = brevo('/contacts', $KEY, ['email' => $d['email'], 'updateEnabled' => true, 'listIds' => [$listId],
    'attributes' => ['FIRSTNAME' => explode(' ', $d['nome'])[0]]]);
  if (!$c['ok']) error_log('Brevo /contacts ' . $c['status'] . ' ' . $c['body']);
}

out(200, ['ok' => true]);
