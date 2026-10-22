'use strict';
(() => {
  const articles = [...document.querySelectorAll('[data-article]')];
  const clauseDetails = [...document.querySelectorAll('.clause-detail')];
  const search = document.getElementById('search');
  const clear = document.getElementById('clear-search');
  const expand = document.getElementById('expand-all');
  const result = document.getElementById('result-count');
  const toast = document.getElementById('toast');
  const preview = JSON.parse(document.getElementById('word-preview-data').textContent);
  const pageSelect = document.getElementById('word-page');
  const pageImage = document.getElementById('word-page-image');
  const canvas = document.getElementById('word-canvas');
  const viewport = document.getElementById('word-viewport');
  const highlight = document.getElementById('word-highlight');
  const follow = document.getElementById('word-follow');
  const pagePrevious = document.getElementById('word-previous');
  const pageNext = document.getElementById('word-next');
  const zoomOut = document.getElementById('word-zoom-out');
  const zoomIn = document.getElementById('word-zoom-in');
  const wordLocation = document.getElementById('word-location');
  const wordOpen = document.getElementById('word-open');
  const backdrop = document.getElementById('word-backdrop');
  let wordPage = 1, wordZoom = 100, activeTarget = null, readingTarget = null;
  let previewReturnFocus = wordOpen;
  let toastTimer;
  const fold = value => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const indexed = articles.map(article => ({article, text: fold(article.textContent)}));

  function filter() {
    const words = fold(search.value.trim()).split(/\s+/).filter(Boolean);
    let shown = 0, clauses = 0;
    indexed.forEach(({article,text}) => {
      const match = words.every(word => text.includes(word));
      article.hidden = !match;
      if (match) { shown++; clauses += article.querySelectorAll('.clause').length; }
    });
    clear.hidden = !search.value;
    document.getElementById('no-results').hidden = shown > 0;
    result.textContent = `${shown} madde başlığı · ${clauses} fıkra${words.length ? ' (arama sonucu)' : ''}`;
  }
  search.addEventListener('input', filter);
  function resetSearch() {search.value=''; filter(); search.focus();}
  clear.addEventListener('click', resetSearch);
  document.getElementById('reset-search').addEventListener('click', resetSearch);
  search.addEventListener('keydown', event => { if(event.key === 'Escape') resetSearch(); });

  function isCompact() { return Boolean(window.matchMedia?.('(max-width: 1024px)').matches); }
  function openWord(trigger=wordOpen) {
    previewReturnFocus=trigger;
    document.body.classList.add('preview-open'); backdrop.hidden=false;
    wordOpen.setAttribute('aria-expanded','true');
    if(readingTarget) showWordTarget(readingTarget,{force:true});
    document.getElementById('word-close').focus();
  }
  function closeWord() {
    document.body.classList.remove('preview-open'); backdrop.hidden=true;
    wordOpen.setAttribute('aria-expanded','false'); previewReturnFocus.focus({preventScroll:true});
  }
  wordOpen.addEventListener('click',()=>openWord(wordOpen));
  document.getElementById('word-close').addEventListener('click',closeWord);
  backdrop.addEventListener('click',closeWord);
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('preview-open')) return;
    if(event.key==='Escape') { event.preventDefault(); closeWord(); }
    if(event.key==='Tab' && isCompact()) {
      const controls=[...document.getElementById('word-panel').querySelectorAll('button:not([disabled]),select,input,a[href],div[tabindex]')];
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
    }
  });
  window.addEventListener('resize',()=>{
    if(!isCompact()) {document.body.classList.remove('preview-open');backdrop.hidden=true;wordOpen.setAttribute('aria-expanded','false');}
  });

  function centerWordTarget() {
    if(!activeTarget) return;
    const target=preview.targets[activeTarget];
    if(!target?.box) return;
    requestAnimationFrame(()=>{
      if(activeTarget===null) return;
      const current=preview.targets[activeTarget];
      if(!current?.box || current.page!==wordPage) return;
      const [x,y,width,height]=current.box;
      const pageHeight=canvas.clientHeight || (canvas.clientWidth * pageImage.height / pageImage.width);
      const top=y*pageHeight;
      const room=Math.max(0,viewport.clientHeight-height*pageHeight);
      viewport.scrollTo({top:Math.max(0,top-room/2),left:Math.max(0,x*canvas.clientWidth-16),behavior:'auto'});
    });
  }
  function renderWordPage(number,targetId=null) {
    number=Math.min(preview.pages.length,Math.max(1,Number(number)||1));
    const page=preview.pages[number-1];
    if(wordPage!==number || pageImage.getAttribute('src')!==page.image) {
      pageImage.src=page.image;
      pageImage.width=page.width;pageImage.height=page.height;
      pageImage.alt=`Yönerge taslağı Word görünümü, sayfa ${number}, ${page.label}`;
      canvas.style.aspectRatio=`${page.width}/${page.height}`;
      document.getElementById('word-image-error').hidden=true;
    }
    wordPage=number;pageSelect.value=String(number);activeTarget=targetId;
    pagePrevious.disabled=number===1;pageNext.disabled=number===preview.pages.length;
    const target=targetId ? preview.targets[targetId] : null;
    highlight.hidden=!target?.box;
    if(target?.box) {
      const [x,y,width,height]=target.box;
      Object.assign(highlight.style,{left:`${x*100}%`,top:`${y*100}%`,width:`${width*100}%`,height:`${height*100}%`});
    }
    wordLocation.textContent=target ? `${target.label} · s.${number}` : `Sayfa ${number} / ${preview.pages.length}`;
    if(target) centerWordTarget(); else viewport.scrollTo({top:0,left:0,behavior:'auto'});
  }
  function showWordTarget(id,{force=false}={}) {
    const target=preview.targets[id];
    if(!target)return;
    readingTarget=id;
    if(!follow.checked && !force)return;
    if(activeTarget===id && wordPage===target.page && !force)return;
    renderWordPage(target.page,id);
  }
  function manualWordPage(number) {follow.checked=false;renderWordPage(number);}
  pagePrevious.addEventListener('click',()=>manualWordPage(wordPage-1));
  pageNext.addEventListener('click',()=>manualWordPage(wordPage+1));
  pageSelect.addEventListener('change',()=>manualWordPage(pageSelect.value));
  follow.addEventListener('change',()=>{if(follow.checked && readingTarget) showWordTarget(readingTarget,{force:true});});
  function setWordZoom(value) {
    const oldZoom=wordZoom;wordZoom=Math.min(250,Math.max(100,value));
    canvas.style.width=`${wordZoom}%`;
    document.getElementById('word-zoom-label').textContent=`${wordZoom}%`;
    zoomOut.disabled=wordZoom===100;zoomIn.disabled=wordZoom===250;
    if(activeTarget)centerWordTarget();
    else viewport.scrollTo({top:viewport.scrollTop*wordZoom/oldZoom,left:viewport.scrollLeft*wordZoom/oldZoom,behavior:'auto'});
  }
  zoomOut.addEventListener('click',()=>setWordZoom(wordZoom-25));
  zoomIn.addEventListener('click',()=>setWordZoom(wordZoom+25));
  pageImage.addEventListener('load',centerWordTarget);
  pageImage.addEventListener('error',()=>{document.getElementById('word-image-error').hidden=false;});
  document.querySelectorAll('[data-preview-target]').forEach(button=>{
    button.addEventListener('click',event=>{
      event.stopPropagation();follow.checked=true;
      showWordTarget(button.dataset.previewTarget,{force:true});
      if(isCompact())openWord(button);
    });
  });
  document.querySelectorAll('.clause').forEach(clause=>{
    clause.addEventListener('click',()=>showWordTarget(clause.id));
  });
  document.addEventListener('focusin',event=>{
    const clause=event.target.closest?.('.clause');
    if(clause)showWordTarget(clause.id);
  });

  function syncExpand() {
    const allOpen = clauseDetails.every(detail => detail.open);
    expand.innerHTML = allOpen ? 'Tüm açıklamaları kapat <span aria-hidden="true">−</span>' : 'Tüm açıklamaları aç <span aria-hidden="true">+</span>';
    expand.setAttribute('aria-expanded', String(allOpen));
  }
  expand.addEventListener('click', () => {
    const shouldOpen = !clauseDetails.every(detail => detail.open);
    clauseDetails.forEach(detail => {detail.open=shouldOpen;});
    syncExpand();
  });
  clauseDetails.forEach(detail => detail.addEventListener('toggle', syncExpand));

  function notify(message) {
    clearTimeout(toastTimer); toast.textContent=message; toast.classList.add('visible');
    toastTimer=setTimeout(() => toast.classList.remove('visible'), 3200);
  }
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const url=new URL(location.href); url.hash=button.dataset.copy;
      try {
        await navigator.clipboard.writeText(url.href);
        notify('Fıkra bağlantısı kopyalandı.');
      } catch (_) {
        location.hash=button.dataset.copy;
        notify('Fıkra adresi açıldı. Tarayıcı adres çubuğundan kopyalayabilirsiniz.');
      }
    });
  });

  function revealTarget() {
    let id; try {id=decodeURIComponent(location.hash.slice(1));} catch (_) {return;}
    if(!id) return;
    const target=document.getElementById(id);
    if(!target) return;
    const article=target.closest('[data-article]');
    if(article?.hidden){search.value=''; filter();}
    if(target.classList.contains('clause')) target.querySelector('details').open=true;
    if(target.classList.contains('verification')) target.open=true;
    const enclosing=target.closest('details'); if(enclosing) enclosing.open=true;
    showWordTarget(id,{force:true});
    requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
  }
  window.addEventListener('hashchange', revealTarget);
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    if(link.hash === location.hash) revealTarget();
  }));
  revealTarget();

  const observer = new IntersectionObserver(entries => {
    const visible=entries.filter(entry=>entry.isIntersecting && !entry.target.closest('[data-article]')?.hidden);
    visible.sort((a,b)=>Math.abs(a.boundingClientRect.top-120)-Math.abs(b.boundingClientRect.top-120));
    if(visible[0])showWordTarget(visible[0].target.id);
  }, {rootMargin:'-110px 0px -65% 0px', threshold:0});
  document.querySelectorAll('.clause,#ek-1,#ek-2,#teyitler,#kaynaklar').forEach(section=>observer.observe(section));
  let printState;
  window.addEventListener('beforeprint', () => {
    printState={details:[...document.querySelectorAll('details')].map(el=>[el,el.open]), hidden:articles.map(el=>[el,el.hidden])};
    document.querySelectorAll('details:not(.mobile-index)').forEach(el=>{el.open=true;});
    articles.forEach(el=>{el.hidden=false;});
  });
  window.addEventListener('afterprint', () => {
    if(!printState)return;
    printState.details.forEach(([el,open])=>{el.open=open;});
    printState.hidden.forEach(([el,hidden])=>{el.hidden=hidden;});
    printState=null;
  });
  document.getElementById('print-page').addEventListener('click',()=>window.print());
})();
