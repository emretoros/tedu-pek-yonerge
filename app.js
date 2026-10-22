'use strict';
(() => {
  const articles = [...document.querySelectorAll('[data-article]')];
  const clauseDetails = [...document.querySelectorAll('.clause-detail')];
  const search = document.getElementById('search');
  const clear = document.getElementById('clear-search');
  const expand = document.getElementById('expand-all');
  const result = document.getElementById('result-count');
  const toast = document.getElementById('toast');
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
      document.querySelectorAll(`[data-nav="${article.id}"]`).forEach(link => {link.hidden = !match;});
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
    document.querySelector('.mobile-index').open=false;
    requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
  }
  window.addEventListener('hashchange', revealTarget);
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    if(link.hash === location.hash) revealTarget();
    if(link.closest('.mobile-index')) document.querySelector('.mobile-index').open=false;
  }));
  revealTarget();

  const observer = new IntersectionObserver(entries => {
    for(const entry of entries) {
      if(!entry.isIntersecting) continue;
      document.querySelectorAll('[data-nav]').forEach(link => {
        const active = link.dataset.nav === entry.target.id;
        link.classList.toggle('active', active);
        if(active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
      });
    }
  }, {rootMargin:'-100px 0px -65% 0px', threshold:0});
  articles.forEach(article => observer.observe(article));
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
