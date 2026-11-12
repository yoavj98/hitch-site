(function(){
  if (window.__hitchFill) return; window.__hitchFill = true;
  var D = {"first":"Test","last":"User","email":"test.user@example.com","phone":"0501234567","cvName":"Test_User_CV.pdf","answers":{}};
  function post(m){ try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }catch(e){} }
  // Thank-you page after the user pressed Send (same page re-rendered, or a new confirmation page)
  var THANKS = /(thank you for (applying|your application)|thanks for applying|application (was |has been )?(sent|submitted|received)|we('ve| have) received your application|your application has been)/i;
  function sentNow(){ return THANKS.test(document.body ? document.body.innerText : '') && !document.querySelector('input[name=firstName],input[name=first_name],#first_name'); }
  function watchSent(){
    if (sentNow()) { post({type:'submitted', where: location.host}); return; }
    var obs = new MutationObserver(function(){ if (sentNow()) { obs.disconnect(); post({type:'submitted', where: location.host}); } });
    obs.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }
  if (document.body && sentNow()) { post({type:'submitted', where: location.host}); return; }
  function setVal(el, v){
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    ['input','change','blur'].forEach(function(t){ el.dispatchEvent(new Event(t, {bubbles:true, composed:true})); });
  }
  // Some forms (SmartRecruiters) build their fields inside web components (shadow DOM): search those too.
  function deepAll(sel, root, out){
    root = root || document; out = out || [];
    Array.prototype.push.apply(out, root.querySelectorAll(sel));
    root.querySelectorAll('*').forEach(function(e){ if (e.shadowRoot) deepAll(sel, e.shadowRoot, out); });
    return out;
  }
  function q(sel){ return document.querySelector(sel) || deepAll(sel)[0] || null; }
  function upOne(e){ return e.parentElement || (e.getRootNode && e.getRootNode().host) || null; }
  // text of the nearest surrounding block that says something (crosses shadow DOM boundaries)
  function nearText(e, min){
    for (var x = upOne(e), k = 0; x && k < 14; x = upOne(x), k++) {
      var t = (x.innerText || '').trim(); if (t.length >= (min || 4)) return t;
    }
    return '';
  }
  function dummyPdf(){
    var s = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
    return new Blob([s], {type:'application/pdf'});
  }
  function cvFile(){
    if (D.cvBase64) {
      var bin = atob(D.cvBase64), arr = new Uint8Array(bin.length);
      for (var i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], D.cvName, {type:'application/pdf'});
    }
    return new File([dummyPdf()], D.cvName, {type:'application/pdf'});
  }
  function attach(input){
    try {
      var dt = new DataTransfer(); dt.items.add(cvFile()); input.files = dt.files;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      return input.files && input.files.length === 1;
    } catch(e) { post({type:'log', msg:'attach error: '+e}); return false; }
  }
  function banner(text, ok){
    var b = document.getElementById('hitch-banner');
    if (!b) { b = document.createElement('div'); b.id='hitch-banner';
      b.style.cssText='position:sticky;top:0;z-index:2147483647;padding:12px 14px;font:600 15px -apple-system,system-ui;border-radius:10px;margin:8px';
      document.body.prepend(b); }
    b.style.background = ok ? '#e7f6ec' : '#fff4e5'; b.style.color = ok ? '#14532d' : '#7a4300'; b.textContent = text;
  }
  function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g,' ').trim(); }
  function labelOf(el){
    if (el.id) { var l = document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if (l) return l.innerText; }
    var p = el.closest('label'); return p ? p.innerText : (el.value || '');
  }
  // Saved answers to the company's own questions (radio / checkbox), e.g. "Do you live in Israel ?" -> "Yes"
  function answer(){
    var bank = {}; Object.keys(D.answers||{}).forEach(function(k){ bank[norm(k)] = String(D.answers[k]); });
    var done = [];
    var names = []; document.querySelectorAll('input[type=radio],input[type=checkbox]').forEach(function(e){ if (e.name && names.indexOf(e.name)<0) names.push(e.name); });
    names.forEach(function(name){
      var want = bank[norm(name)]; if (!want) return;
      var opts = document.querySelectorAll('input[name="'+CSS.escape(name)+'"]');
      for (var i=0;i<opts.length;i++){
        if (norm(labelOf(opts[i])) === norm(want)) {
          if (!opts[i].checked) { var l = opts[i].id && document.querySelector('label[for="'+CSS.escape(opts[i].id)+'"]'); (l||opts[i]).click(); }
          done.push(name); break;
        }
      }
    });
    return done;
  }
  // fields that are filled from the profile, never saved as "answers"
  var STD = /^(firstName|first_name|lastName|last_name|firstname|lastname|name|email|phone|_systemfield_name|_systemfield_email|_systemfield_phone|g-recaptcha-response|country|cv|resume|coverLetter|cover_letter)$/i;
  function isAnswerField(el){
    if (!el || el.disabled) return false;
    var t = (el.type||'').toLowerCase();
    if (['hidden','file','password','email','tel','submit','button','checkbox','radio','search'].indexOf(t) >= 0) return false;
    if (STD.test(el.name||'') || STD.test(el.id||'')) return false;
    return !!norm(labelOf(el));
  }
  // saved text answers (e.g. LinkedIn) into empty fields with the same question
  function answerText(){
    var bank = {}; Object.keys(D.answers||{}).forEach(function(k){ bank[norm(k)] = String(D.answers[k]); });
    var done = [];
    document.querySelectorAll('input,textarea').forEach(function(el){
      if (!isAnswerField(el) || el.value) return;
      var want = bank[norm(labelOf(el))];
      if (want) { setVal(el, want); done.push(norm(labelOf(el))); }
    });
    return done;
  }
  // when the user presses Submit: remember their answers to the company's questions, and tell the app
  function collectAnswers(){
    var out = {};
    document.querySelectorAll('input,textarea').forEach(function(el){
      if (isAnswerField(el) && el.value && el.value.length < 300) out[labelOf(el).replace(/\s*\*\s*$/,'').trim()] = el.value.trim();
    });
    document.querySelectorAll('input[type=radio]:checked').forEach(function(el){
      if (el.name && !STD.test(el.name)) out[el.name] = labelOf(el).trim();
    });
    return out;
  }
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('button,input[type=submit],[role=button]');
    if (!b) return;
    var txt = (b.innerText || b.value || '').trim();
    if (b.type === 'submit' || /^(submit|apply|send|שלח|הגש)/i.test(txt) || /submit application/i.test(txt)) {
      post({type:'answers', answers: collectAnswers()});
      post({type:'submit-clicked'});
    }
  }, true);
  function showForm(f){
    // land on the details section, not the top of the page
    try { var top = f.getBoundingClientRect().top + window.scrollY - 140; window.scrollTo(0, Math.max(0, top)); } catch(e){}
  }
  // first name (Comeet, Greenhouse, Workable) or full name (Lever, Ashby): whichever the form has
  var ANCHOR = 'input[name=firstName],input[name=first_name],#first_name,input[name=firstname],input[name=name],input[name=_systemfield_name]';
  // Forms without field names (Elbit, SmartRecruiters, ...): find the field by its label, placeholder or type.
  function textOf(el){
    var parts = [el.getAttribute('aria-label'), el.placeholder, el.name, el.id, el.getAttribute('autocomplete')];
    var root = el.getRootNode && el.getRootNode().querySelector ? el.getRootNode() : document;
    if (el.id) { var l = root.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if (l) parts.push(l.innerText); }
    var lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(' ').forEach(function(i){ var x = root.querySelector('#'+CSS.escape(i)); if (x) parts.push(x.innerText); });
    var c = el.closest('label'); if (c) parts.push(c.innerText);
    var box = el.parentElement;
    for (var k = 0; k < 3 && box; k++, box = box.parentElement) {
      var ll = box.querySelector('label,legend');
      if (ll && !ll.contains(el) && box.querySelectorAll('input,textarea').length <= 1) { parts.push(ll.innerText); break; }
    }
    return parts.filter(Boolean).join(' | ');
  }
  function visibleInputs(){
    return deepAll('input,textarea').filter(function(el){
      var t = (el.type||'text').toLowerCase();
      return ['text','email','tel','','textarea'].indexOf(t) >= 0 && !el.disabled && el.getClientRects().length > 0;
    });
  }
  var LABELS = {
    first: /first[ _-]?name|given name|שם פרטי/i,
    last: /last[ _-]?name|family name|surname|שם משפחה/i,
    name: /full ?name|^\s*name\b|your name|שם מלא|^\s*שם\s*\*?\s*$/i,
    email: /e-?mail|אימייל|מייל|דוא"?ל/i,
    phone: /phone|mobile|cell|טלפון|נייד/i
  };
  function byLabel(kind){
    var list = visibleInputs();
    if (kind === 'email') { var e = list.find(function(x){ return x.type === 'email'; }); if (e) return e; }
    if (kind === 'phone') { var p = list.find(function(x){ return x.type === 'tel'; }); if (p) return p; }
    return list.find(function(x){
      var t = textOf(x);
      if (kind === 'name' && (LABELS.first.test(t) || LABELS.last.test(t))) return false;
      return LABELS[kind].test(t);
    }) || null;
  }
  function anchor(){ return q(ANCHOR) || byLabel('first') || byLabel('name'); }
  function fill(){
    var f = anchor();
    if (!f) return false;
    var res = {where: location.host, fields: [], cv: false};
    var map = [
      ['input[name=firstName],input[name=first_name],#first_name,input[name=firstname]', D.first, 'first'],
      ['input[name=lastName],input[name=last_name],#last_name,input[name=lastname]', D.last, 'last'],
      ['input[name=name],input[name=_systemfield_name]', (D.first + ' ' + D.last).trim(), 'name'],
      ['input[name=email],#email,input[name=_systemfield_email],input[type=email]', D.email, 'email'],
      ['input[name=phone],#phone,input[name=_systemfield_phone],input[type=tel]', D.phone, 'phone']
    ];
    map.forEach(function(m){
      var el = q(m[0]) || byLabel(m[2]);
      if (el && !(m[2] === 'name' && (q(map[0][0]) || byLabel('first')))) { setVal(el, m[1]); res.fields.push(m[2]); }
    });
    // Greenhouse: phone country is a searchable dropdown (input#country). Type Israel and pick it.
    var country = q('input#country[role=combobox],input#country');
    if (country && !/israel/i.test(country.value || '')) {
      try {
        country.focus(); setVal(country, 'Israel');
        country.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
        setTimeout(function(){
          var opt = Array.prototype.find.call(document.querySelectorAll('[role=option]'), function(o){ return /^\s*israel\b/i.test(o.innerText||''); });
          if (opt) {
            ['mousedown','mouseup','click'].forEach(function(t){ opt.dispatchEvent(new MouseEvent(t, {bubbles:true})); });
            post({type:'log', msg:'country set to Israel'});
          } else post({type:'log', msg:'Israel option not found'});
        }, 600);
        res.fields.push('country');
      } catch(e) { post({type:'log', msg:'country error '+e}); }
    }
    var file = q('input[type=file][name=cv],input[type=file]#resume,input[type=file][name=resume],input[type=file][id*=resume i],input[type=file][name*=resume i]');
    if (!file) { // otherwise: the document file box whose label talks about a resume / CV, or the only / last one
      var files = deepAll('input[type=file]').filter(function(x){
        var a = (x.accept || '').toLowerCase(); return !a || /pdf|doc|\*/.test(a); }); // skip photo-only boxes
      file = files.find(function(x){ var t = nearText(x, 20); return /resume|\bcv\b|curriculum|קורות/i.test(t) && !/autocomplete|easy apply|indeed/i.test(t); })
        || (files.length === 1 ? files[0] : files[files.length - 1]) || null;
    }
    // a second "confirm e-mail" field
    deepAll('input[type=email]').forEach(function(x){ if (!x.value && x.getClientRects().length) setVal(x, D.email); });
    if (file) res.cv = attach(file);
    var fileShown = document.body.innerText.indexOf(D.cvName) >= 0;
    res.cvShown = fileShown;
    res.answered = answer().concat(answerText());
    if (res.answered.length) res.fields.push('answers');
    showForm(f);
    post({type:'filled', res: res});
    if (!res.cv) banner('Please attach your CV here, then press Submit.', false);
    return true;
  }
  // Comeet job page (comeet.com): the form lives in an embedded frame from comeet.co.
  // Open that form page itself, full screen, so the user lands straight on the form.
  if (window.top === window && /(^|\.)comeet\.com$/.test(location.hostname)) {
    var t0 = 0;
    (function findFrame(){
      var fr = Array.prototype.find.call(document.querySelectorAll('iframe'), function(f){
        var s = f.src || f.getAttribute('data-src') || ''; return /comeet\.co\/jobs\/.*\/apply/.test(s); });
      if (fr) { location.replace(fr.src || fr.getAttribute('data-src')); return; }
      // on phones the form frame is only created after "Apply for this job" is tapped: tap it for the user
      if (t0 % 8 === 0) {
        var btn = Array.prototype.find.call(document.querySelectorAll('button,a,[role=button]'), function(b){ return /apply/i.test(b.innerText||''); });
        if (btn) { try { btn.click(); } catch(e){} }
      }
      if (++t0 < 60) { setTimeout(findFrame, 250); return; }
      // last resort: open Comeet's form page directly from the job address (/jobs/<company>/<companyUid>/<slug>/<posUid>)
      var m = location.pathname.match(/\/jobs\/[^/]+\/([^/]+)\/[^/]+\/([^/?#]+)/);
      if (m) { post({type:'log', msg:'opening Comeet form directly'}); location.replace('https://www.comeet.co/jobs/' + m[1] + '/' + m[2] + '/apply'); }
      else post({type:'log', msg:'Comeet form frame not found'});
    })();
    return;
  }
  // Pages built with React (Greenhouse, Ashby) rebuild their fields when they finish loading and wipe early input.
  // So: wait until the fields exist, wait a bit more, fill, then check again and refill if they were wiped.
  var tries = 0, fills = 0;
  function stillFilled(){ var f = anchor(); return f && f.value !== ''; }
  function attempt(){
    fill(); fills++;
    setTimeout(function(){
      if (!stillFilled() && fills < 5) { post({type:'log', msg:'fields were reset, filling again'}); attempt(); return; }
      showForm(anchor());
      post({type:'ready', ms: Date.now() - T0});
      watchSent();
    }, 600);
  }
  var T0 = Date.now();
  function whenLoaded(fn){ if (document.readyState === 'complete') setTimeout(fn, 250); else window.addEventListener('load', function(){ setTimeout(fn, 250); }, {once:true}); }
  (function tick(){
    if (anchor()) { whenLoaded(attempt); return; }
    if (++tries < 150) setTimeout(tick, 200);
    else if (window.top === window && !document.querySelector('iframe')) post({type:'nofields', where: location.host});
  })();
})(); true;