/* TCMO — interações e animações */
(function () {
  'use strict';

  var WA = '5511966432515';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  function waLink(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }

  /* Envia os dados para o e-mail da clínica (Brevo, via /api/contato).
     Retorna uma Promise<boolean>: true quando o e-mail foi aceito pela API. */
  function sendLead(data) {
    data.pagina = location.href;
    try {
      var endpoint = /vercel\.app$/.test(location.hostname) ? '/api/contato' : '/api/contato.php';
      return fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), keepalive: true
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function navH() { return $('.nav').offsetHeight; }
  function goTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: target === 0 ? 0 : -navH() + 1 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navH() + 1, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- Nav ---------- */
  var nav = $('.nav'), toggle = $('.nav__toggle'), menu = $('#menu'), wa = $('.wa-float');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    wa.classList.toggle('is-visible', y > window.innerHeight * 0.8);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open && hasGsap && !reduce) gsap.from('#menu nav a', { y: 24, opacity: 0, stagger: .05, duration: .6, ease: 'power3.out' });
  }
  toggle.addEventListener('click', function () { setMenu(menu.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); } });

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2 && id !== '#') return;
      var t = id === '#topo' ? 0 : $(id);
      if (t === null) return;
      e.preventDefault();
      if (!menu.hidden) setMenu(false);
      goTo(t);
    });
  });

  // link ativo
  var links = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['clinica', 'tratamentos', 'tecnologias', 'pre-avaliacao', 'especialistas', 'resultados', 'contato'].forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- Comparador antes/depois ---------- */
  var cmp = $('#compare');
  if (cmp) {
    var range = $('.compare__range', cmp);
    var setPos = function (v) { cmp.style.setProperty('--pos', v + '%'); };
    range.addEventListener('input', function () { setPos(range.value); });
    var thumbs = $$('.thumb');
    var after = $('.compare__after', cmp), before = $('.compare__before img', cmp);
    thumbs.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('is-active')) return;
        thumbs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true');
        var c = b.getAttribute('data-case');
        var a2 = new Image(), b2 = new Image(), n = 0;
        var swap = function () {
          if (++n < 2) return;
          after.style.opacity = before.style.opacity = '0';
          setTimeout(function () {
            after.src = a2.src; before.src = b2.src;
            after.style.opacity = before.style.opacity = '1';
            range.value = 50; setPos(50);
          }, 220);
        };
        a2.onload = b2.onload = swap; a2.onerror = b2.onerror = swap;
        a2.src = 'assets/ba/' + c + '-depois.webp?v=b3'; b2.src = 'assets/ba/' + c + '-antes.webp?v=b3';
      });
    });
  }

  /* ---------- Pré-avaliação ---------- */
  var DATA = {
    rosto: { label: 'Rosto e pele', items: [
      { id: 'testa', t: 'Testa e linhas de expressão', p: 'Toxina botulínica', i: 'i-waves' },
      { id: 'olheiras', t: 'Olheiras e olhar cansado', p: 'Preenchimento facial', i: 'i-glow' },
      { id: 'nariz', t: 'Nariz', p: 'Preenchimento facial', i: 'i-profile' },
      { id: 'pele', t: 'Pele, poros e manchas', p: 'CO₂ Laser, Lavieen ou bioestimuladores', i: 'i-pores' },
      { id: 'sulco', t: 'Bigode chinês', p: 'Preenchimento ou bioestimulador', i: 'i-syringe' },
      { id: 'labios', t: 'Lábios', p: 'Preenchimento labial', i: 'i-drop' },
      { id: 'mandibula', t: 'Contorno da mandíbula', p: 'Preenchimento, fios ou Ultraformer', i: 'i-thread' },
      { id: 'papada', t: 'Queixo e papada', p: 'Lipo de papada (cirurgia da face) ou preenchimento', i: 'i-chin' }
    ] },
    sorriso: { label: 'Sorriso', items: [
      { id: 'cor', t: 'Cor e formato dos dentes', p: 'Lentes de contato, facetas ou restaurações estéticas', i: 'i-veneer' },
      { id: 'alinhamento', t: 'Dentes desalinhados', p: 'Ortodontia', i: 'i-braces' },
      { id: 'falta', t: 'Falta de dentes', p: 'Implantes ou próteses', i: 'i-implant' },
      { id: 'dor', t: 'Dor ou sensibilidade', p: 'Avaliação e tratamento de canal', i: 'i-root' },
      { id: 'urgencia', t: 'Preciso de atendimento urgente', p: 'Urgência odontológica 24h', i: 'i-clock' }
    ] },
    saude: { label: 'Saúde', items: [
      { id: 'checkup', t: 'Check-up e acompanhamento', p: 'Medicina: clínica geral', i: 'i-steth' },
      { id: 'alimentacao', t: 'Alimentação e peso', p: 'Nutrologia e nutrição', i: 'i-apple' },
      { id: 'idoso', t: 'Cuidado com a saúde depois dos 60', p: 'Geriatria', i: 'i-pulse' },
      { id: 'cirurgia', t: 'Avaliação para cirurgia', p: 'Cirurgia da face ou cirurgia geral', i: 'i-scalpel' }
    ] }
  };
  var picked = {}; // id -> {area, t}
  var current = 'rosto';
  var choicesEl = $('#choices'), listEl = $('#plan-list'), emptyEl = $('#plan-empty'), sendBtn = $('#plan-send'), nameEl = $('#plan-name');

  function icon(id, cls) { return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  function renderChoices() {
    var area = DATA[current];
    choicesEl.innerHTML = area.items.map(function (it) {
      var on = !!picked[it.id];
      return '<button type="button" class="choice" data-id="' + it.id + '" aria-pressed="' + on + '">' + icon(it.i) +
        '<span class="choice__t">' + it.t + '<span class="choice__d">Possível caminho: ' + it.p + '</span></span>' +
        '<span class="choice__box">' + icon('i-check') + '</span></button>';
    }).join('');
  }
  function renderPlan() {
    var ids = Object.keys(picked);
    listEl.innerHTML = ids.map(function (id) {
      return '<li>' + picked[id].t + '<button type="button" data-remove="' + id + '" aria-label="Remover ' + picked[id].t + '">' + icon('i-close') + '</button></li>';
    }).join('');
    emptyEl.hidden = ids.length > 0;
    sendBtn.disabled = ids.length === 0;
    $$('.pin').forEach(function (p) { p.setAttribute('aria-pressed', String(!!picked[p.getAttribute('data-zone')])); });
  }
  function findItem(id) {
    for (var k in DATA) { for (var i = 0; i < DATA[k].items.length; i++) { if (DATA[k].items[i].id === id) return { area: k, item: DATA[k].items[i] }; } }
    return null;
  }
  function togglePick(id, src) {
    var f = findItem(id); if (!f) return;
    if (picked[id]) delete picked[id]; else picked[id] = { area: f.area, t: f.item.t };
    renderChoices(); renderPlan();
    if (src && hasGsap && !reduce && picked[id]) {
      var last = listEl.querySelector('li:last-child');
      if (last) gsap.from(last, { scale: .8, opacity: 0, duration: .45, ease: 'back.out(2)' });
    }
  }

  choicesEl.addEventListener('click', function (e) { var b = e.target.closest('.choice'); if (b) togglePick(b.getAttribute('data-id'), true); });
  listEl.addEventListener('click', function (e) { var b = e.target.closest('[data-remove]'); if (b) togglePick(b.getAttribute('data-remove')); });
  $$('.pin').forEach(function (p) { p.addEventListener('click', function () { togglePick(p.getAttribute('data-zone'), true); }); });

  // abas
  var tabs = $$('.tool__tabs [role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    current = tab.id.replace('tab-', '');
    renderChoices();
    if (focus) tab.focus();
    if (hasGsap && !reduce) {
      gsap.from('#' + tab.getAttribute('aria-controls') + ' svg', { opacity: 0, scale: .94, y: 12, duration: .7, ease: 'power3.out' });
      gsap.from('#choices .choice', { opacity: 0, x: 16, stagger: .04, duration: .45, ease: 'power3.out' });
    }
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        selectTab(tabs[n], true);
      }
    });
  });

  var statusEl = $('#plan-status'), sendLabel = $('#plan-send-label');
  function planStatus(msg, bad) { statusEl.textContent = msg; statusEl.classList.toggle('is-bad', !!bad); statusEl.hidden = false; }

  sendBtn.addEventListener('click', function () {
    var name = nameEl.value.trim(), tel = ($('#plan-tel').value || '').trim();
    if (!name) { planStatus('Informe seu nome para enviarmos a pré-avaliação.', true); nameEl.focus(); return; }
    if (tel.replace(/\D/g, '').length < 10) { planStatus('Informe seu WhatsApp com DDD para a equipe retornar.', true); $('#plan-tel').focus(); return; }
    sendBtn.disabled = true; sendLabel.textContent = 'Enviando...'; statusEl.hidden = true;
    sendLead({
      tipo: 'pre-avaliacao', nome: name, telefone: tel,
      selecoes: Object.keys(picked).map(function (id) { return { area: DATA[picked[id].area].label, item: picked[id].t }; })
    }).then(function (ok) {
      sendLabel.textContent = 'Enviar pré-avaliação';
      if (ok) {
        planStatus('Pré-avaliação enviada. Nossa equipe entra em contato em breve pelo seu WhatsApp.');
      } else {
        sendBtn.disabled = Object.keys(picked).length === 0;
        planStatus('Não conseguimos enviar agora. Tente de novo em instantes ou fale com a gente pelo WhatsApp (11) 96643-2515.', true);
      }
    });
  });

  renderChoices(); renderPlan();

  /* ---------- Formulário de contato ---------- */
  var form = $('#contact-form'), err = $('#form-error');
  var formBtn = $('#form-send'), formOk = $('#form-ok'), formLabel = formBtn.querySelector('span');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form);
    var nome = (d.get('nome') || '').trim(), tel = (d.get('tel') || '').trim();
    formOk.hidden = true;
    if (!nome || tel.replace(/\D/g, '').length < 10) {
      err.textContent = 'Informe seu nome e seu WhatsApp com DDD para enviarmos a mensagem.';
      err.hidden = false; (!nome ? form.nome : form.tel).focus(); return;
    }
    err.hidden = true;
    formBtn.disabled = true; formLabel.textContent = 'Enviando...';
    sendLead({
      tipo: 'contato', nome: nome, telefone: tel, email: (d.get('email') || '').trim(),
      interesse: d.get('interesse'), mensagem: (d.get('msg') || '').trim(), empresa: d.get('empresa') || ''
    }).then(function (ok) {
      formBtn.disabled = false; formLabel.textContent = 'Enviar mensagem';
      if (ok) { formOk.hidden = false; form.reset(); }
      else {
        err.textContent = 'Não conseguimos enviar agora. Tente de novo em instantes ou fale com a gente pelo WhatsApp (11) 96643-2515.';
        err.hidden = false;
      }
    });
  });

  /* ---------- Tecnologias: abas ---------- */
  var onTech = null, techCur = 'co2';
  var techTabs = $$('.tech__tabs [role="tab"]');
  function selectTech(tab, focus) {
    var key = tab.getAttribute('data-tech');
    techTabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    if (key === techCur) return;
    var from = techCur; techCur = key;
    if (onTech) onTech(from, key);
    else $$('.laser-illus .tg').forEach(function (g) { g.style.opacity = g.classList.contains('t-' + key) ? 1 : 0; });
  }
  techTabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTech(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTech(techTabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + techTabs.length) % techTabs.length], true);
      }
    });
  });

  /* ---------- Avaliações: setas do carrossel ---------- */
  var track = $('.reviews__track');
  $$('.rv-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = track.querySelector('.rv');
      var step = card ? card.getBoundingClientRect().width + 16 : 300;
      track.scrollBy({ left: step * parseInt(b.getAttribute('data-dir'), 10), behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Contadores ---------- */
  function countUp(el) {
    var end = parseInt(el.getAttribute('data-count'), 10);
    if (reduce || !hasGsap) { el.textContent = end.toLocaleString('pt-BR'); return; }
    var o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('pt-BR'); } });
  }

  /* ---------- Animações GSAP ---------- */
  if (!hasGsap || reduce) {
    root.classList.add('is-ready');
    $$('[data-count]').forEach(function (el) { el.textContent = parseInt(el.getAttribute('data-count'), 10).toLocaleString('pt-BR'); });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Hero: um momento orquestrado
  var tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: function () { root.classList.add('is-ready'); } });
  tl.to('.hero__window', { clipPath: 'inset(0% 0% 0% 0% round 96px)', duration: 1.5, ease: 'expo.inOut' }, 0.1)
    .fromTo('.hero__window img', { scale: 1.28 }, { scale: 1, duration: 2.2 }, 0.3)
    .to('.hero__frame rect', { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' }, 0.5)
    .set('[data-hero-line]', { opacity: 1 }, 0.2)
    .fromTo('[data-hero-line]', { yPercent: 115 }, { yPercent: 0, duration: 1.3, stagger: .12 }, 0.25)
    .fromTo('.hero [data-hero]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1, stagger: .09, ease: 'power3.out' }, 0.75);

  // leve parallax do hero ao rolar
  gsap.to('.hero__window img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Profundidade sutil no hero acompanhando o cursor (desktop)
  if (window.matchMedia('(hover: hover) and (min-width: 901px)').matches) {
    var hero = $('.hero');
    var fx = gsap.quickTo('.hero__frame', 'xPercent', { duration: 1.2, ease: 'power3' }), fy = gsap.quickTo('.hero__frame', 'yPercent', { duration: 1.2, ease: 'power3' });
    var wx = gsap.quickTo('.hero__window', 'xPercent', { duration: 1.2, ease: 'power3' }), wy = gsap.quickTo('.hero__window', 'yPercent', { duration: 1.2, ease: 'power3' });
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX / r.width - .5), ny = (e.clientY / r.height - .5);
      fx(nx * 2.4); fy(ny * 2.4); wx(nx * -1); wy(ny * -1);
    });
  }

  // Ilustração de cuidado integrado: anéis se desenhando
  var rings = $$('.venn__rings circle');
  rings.forEach(function (c) { var L = c.getTotalLength(); c.style.strokeDasharray = L; c.style.strokeDashoffset = L; });
  var vt = gsap.timeline({ scrollTrigger: { trigger: '.about__art', start: 'top 75%', once: true } });
  vt.to(rings, { strokeDashoffset: 0, duration: 1.8, stagger: .25, ease: 'power2.inOut' })
    .from('.venn__rings circle', { fillOpacity: 0, duration: 1, stagger: .2 }, .6)
    .from('.venn__labels text', { opacity: 0, y: 8, stagger: .15, duration: .8, ease: 'power3.out' }, 1)
    .from('.venn__logo', { opacity: 0, scale: .6, transformOrigin: '50% 50%', duration: 1, ease: 'back.out(2)' }, 1.4);

  // Ícones dos diferenciais
  ScrollTrigger.batch('.values li', { start: 'top 88%', once: true, onEnter: function (b) { gsap.from(b, { opacity: 0, y: 20, stagger: .08, duration: .9, ease: 'power3.out' }); } });

  // Painéis empilhando (desktop)
  var mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', function () {
    var panels = $$('.panel');
    panels.forEach(function (p, i) {
      var next = panels[i + 1]; if (!next) return;
      gsap.fromTo(p, { scale: 1, filter: 'brightness(1)' }, { scale: .95, filter: 'brightness(.6)', ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top ' + (navH() + 24) + 'px', scrub: true } });
    });
  });

  // Ilustrações de linha se desenhando
  $$('svg.illus').forEach(function (svg) {
    var d = $$('.draw', svg);
    d.forEach(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    var t = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 78%', once: true } });
    t.to(d, { strokeDashoffset: 0, duration: 2.2, stagger: .08, ease: 'power2.inOut' })
     .from($$('.guides', svg), { opacity: 0, duration: 1.4 }, .6);
  });

  // Tecnologias estéticas: entrada + ciclos de cada tecnologia
  var lt = gsap.timeline({ scrollTrigger: { trigger: '.laser', start: 'top 65%', once: true } });
  lt.from('.laser__title', { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out' }, 0.2)
    .from('.tech__tabs', { opacity: 0, y: 12, duration: .8, ease: 'power3.out' }, 0.4)
    .from('#tp-co2 .benefits li', { opacity: 0, x: 24, stagger: .1, duration: .8, ease: 'power3.out' }, 0.5);

  var L = '.laser-illus ';
  var loops = {};
  loops.co2 = gsap.timeline({ repeat: -1, repeatDelay: .6, paused: true });
  loops.co2.set(L + '.mcol', { scaleY: 0, opacity: 1, transformOrigin: '50% 0%' })
    .set(L + '.mdot', { opacity: 0, scale: .4, transformOrigin: '50% 50%' })
    .to(L + '.hp', { y: 10, duration: .5, ease: 'power2.inOut' })
    .fromTo(L + '.t-co2 .beam', { opacity: 0 }, { opacity: 1, duration: .25, ease: 'none' })
    .to(L + '.mdot', { opacity: 1, scale: 1, duration: .3, stagger: { each: .06, from: 'center' }, ease: 'back.out(3)' }, '<')
    .to(L + '.mcol', { scaleY: 1, duration: .9, stagger: { each: .06, from: 'center' }, ease: 'power3.out' }, '<.1')
    .to(L + '.t-co2 .beam', { opacity: .35, duration: .15, repeat: 5, yoyo: true, ease: 'none' }, '<')
    .to(L + '.t-co2 .beam', { opacity: 0, duration: .4 })
    .to(L + '.hp', { y: 0, duration: .6, ease: 'power2.inOut' }, '<')
    .to(L + '.fibers path', { opacity: 1, stroke: '#EFE3C8', duration: .5, stagger: .1 }, '<')
    .to(L + '.fibers path', { opacity: .7, stroke: '#D9C6A1', duration: .8, stagger: .1 })
    .to({}, { duration: 1.4 })
    .to(L + '.mcol', { opacity: 0, duration: .6 });

  loops.ultra = gsap.timeline({ repeat: -1, repeatDelay: .4, paused: true });
  loops.ultra.set(L + '.uwave', { opacity: 0, y: -8 })
    .set(L + '.upt', { scale: 0, transformOrigin: '50% 50%' })
    .set(L + '.ucone', { opacity: 0 })
    .to(L + '.hp', { y: 18, duration: .6, ease: 'power2.inOut' })
    .to(L + '.uwave', { opacity: .9, y: 0, duration: .5, stagger: .18, ease: 'power2.out' })
    .to(L + '.ucone', { opacity: 1, duration: .5, stagger: .08 }, '-=.2')
    .to(L + '.upt', { scale: 1, duration: .45, stagger: .08, ease: 'back.out(3)' }, '<.2')
    .to(L + '.upt', { scale: 1.6, opacity: .5, duration: .5, repeat: 3, yoyo: true, stagger: .05, ease: 'sine.inOut' })
    .to(L + '.fibers path', { opacity: 1, stroke: '#EFE3C8', duration: .5, stagger: .1 }, '<')
    .to(L + '.uwave', { opacity: 0, duration: .4 })
    .to(L + '.fibers path', { opacity: .7, stroke: '#D9C6A1', duration: .8, stagger: .1 }, '<')
    .to(L + '.hp', { y: 0, duration: .6, ease: 'power2.inOut' }, '<')
    .to({}, { duration: 1 })
    .to([L + '.ucone', L + '.upt'], { opacity: 0, duration: .5 })
    .set(L + '.upt', { opacity: 1 });

  loops.lav = gsap.timeline({ repeat: -1, repeatDelay: .4, paused: true });
  loops.lav.set(L + '.ldot', { opacity: 0, scale: .3, transformOrigin: '50% 50%' })
    .set(L + '.lcol', { scaleY: 0, opacity: 1, transformOrigin: '50% 0%' })
    .set(L + '.beam-lav', { x: -50, opacity: 0 })
    .to(L + '.hp', { y: 8, x: -50, duration: .5, ease: 'power2.inOut' })
    .to(L + '.beam-lav', { opacity: .75, duration: .2 }, '<.3')
    .to([L + '.hp', L + '.beam-lav'], { x: 50, duration: 2.2, ease: 'none' })
    .to(L + '.ldot', { opacity: 1, scale: 1, duration: .25, stagger: .15, ease: 'back.out(3)' }, '<')
    .to(L + '.lcol', { scaleY: 1, duration: .5, stagger: .15, ease: 'power3.out' }, '<.1')
    .to(L + '.beam-lav', { opacity: 0, duration: .3 })
    .to(L + '.hp', { x: 0, y: 0, duration: .7, ease: 'power2.inOut' }, '<')
    .to(L + '.fibers path', { opacity: 1, stroke: '#EFE3C8', duration: .5, stagger: .1 }, '<')
    .to(L + '.fibers path', { opacity: .7, stroke: '#D9C6A1', duration: .8, stagger: .1 })
    .to({}, { duration: 1.2 })
    .to([L + '.ldot', L + '.lcol'], { opacity: 0, duration: .5 });

  var techNow = 'co2', techInView = false;
  function playTech() { Object.keys(loops).forEach(function (k) { if (k === techNow && techInView) loops[k].play(); else loops[k].pause(); }); }
  ScrollTrigger.create({ trigger: '.laser__art', start: 'top 85%', end: 'bottom 10%', onToggle: function (self) { techInView = self.isActive; playTech(); } });

  onTech = function (from, to) {
    loops[from].pause(0);
    gsap.set(L + '.hp', { x: 0, y: 0 });
    gsap.to(L + '.t-' + from, { opacity: 0, duration: .4 });
    gsap.to(L + '.t-' + to, { opacity: 1, duration: .5, delay: .2 });
    techNow = to;
    loops[to].restart();
    if (!techInView) loops[to].pause();
    gsap.from('#tp-' + to + ' .tech__name, #tp-' + to + ' .laser__sub', { opacity: 0, y: 14, stagger: .06, duration: .6, ease: 'power3.out' });
    gsap.from('#tp-' + to + ' .benefits li', { opacity: 0, x: 20, stagger: .07, duration: .6, ease: 'power3.out' });
  };

  // Centro cirúrgico
  ScrollTrigger.batch('.sg', { start: 'top 85%', once: true, onEnter: function (b) { gsap.from(b, { clipPath: 'inset(100% 0% 0% 0% round 40px)', stagger: .12, duration: 1.3, ease: 'expo.inOut' }); } });

  // Dica de arraste no comparador
  ScrollTrigger.create({ trigger: '#compare', start: 'top 70%', once: true, onEnter: function () {
    var o = { v: 50 };
    gsap.timeline().to(o, { v: 32, duration: .8, ease: 'power2.inOut', onUpdate: function () { cmp.style.setProperty('--pos', o.v + '%'); } })
      .to(o, { v: 68, duration: 1.1, ease: 'power2.inOut', onUpdate: function () { cmp.style.setProperty('--pos', o.v + '%'); } })
      .to(o, { v: 50, duration: .8, ease: 'power2.inOut', onUpdate: function () { cmp.style.setProperty('--pos', o.v + '%'); } });
  } });

  // Jornada: linha percorre os passos
  var steps = $$('.step');
  var line = $('.journey__line');
  ScrollTrigger.create({
    trigger: '.journey__track', start: 'top 75%', end: 'bottom 55%', scrub: true,
    onUpdate: function (self) {
      line.style.setProperty('--p', self.progress.toFixed(3));
      steps.forEach(function (s, i) { s.classList.toggle('is-on', self.progress >= (i / (steps.length - 1)) * 0.98); });
    }
  });
  line.style.setProperty('--p', 0);

  // Contadores
  $$('[data-count]').forEach(function (el) {
    el.textContent = '0';
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { countUp(el); } });
  });

  // Foto da estrutura: revelação + parallax
  gsap.from('.space__photo', { clipPath: 'inset(100% 0% 0% 0% round 48px)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: '.space__photo', start: 'top 80%', once: true } });
  gsap.fromTo('.space__photo img', { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.space__photo', start: 'top bottom', end: 'bottom top', scrub: true } });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
