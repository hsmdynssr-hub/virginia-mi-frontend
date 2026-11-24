/* Presentation only: never writes product, pricing, stock or category data. */
(() => {
  'use strict';
  const groups = [
    ['olive','زيت الزيتون','Olive oil'],['tahini','الطحينة والزيت الحار','Tahini & flaxseed oil'],
    ['coconut','زيت جوز الهند','Coconut oil'],['dates','التمور ومشتقاتها','Dates & date products'],
    ['pickles','المعلبات والمخللات','Preserves & pickles'],['herbs','العطارة والشاي','Herbs & tea'],
    ['soap','الصابون','Soap'],['oils','الزيوت الطبيعية','Natural oils'],
    ['hair','العناية بالشعر والشامبو','Hair care & shampoo'],['care','مستحضرات التجميل والعناية الشخصية','Beauty & personal care'],
    ['chocolate','الشوكولاتة والزبدة','Chocolate & nut butter'],['review','منتجات أخرى','More products']
  ].map(([id,name,nameEn])=>({id,name,nameEn}));
  const clean=s=>String(s||'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F]/g,'').toLowerCase();
  function category(row) {
    const n=clean(row.productName), c=clean(row.categoryName);
    // A mixed gift bundle remains visible for review instead of guessing its primary group.
    if (/طحين.*دبس.*تمر|جوز الهند.*صابون/.test(n)) return 'review';
    if (/شامبو|للشعر|مخمريه|hair|shampoo/.test(n)) return 'hair';
    if (/صابون|soap/.test(n+' '+c)) return 'soap';
    if (/بشره|تجميل|كريم|سيروم|واقي|مرطب|شيا|body|cream/.test(n)) return 'care';
    if (/زيت زيتون|زيت الزيتون|الاكسترا فيرجن|الزيت الفيرجن|نصف فيرجن/.test(n) || /زيت الزيتون/.test(c)) return 'olive';
    if (/طحين|زيت حار|الزيت الحار/.test(n+' '+c)) return 'tahini';
    if (/زيت جوز الهند/.test(n)) return 'coconut';
    if (/تمر|تمور|معمول|دبس تمر|دبس التمر/.test(n)) return 'dates';
    if (/مخلل|صويا|معلبات/.test(n+' '+c)) return 'pickles';
    if (/شاي|شاى|نعناع|عطاره|زعتر|توابل|اعشاب|قهوه/.test(n+' '+c)) return 'herbs';
    if (/شيكولات|شوكولات|شوكولاته|شكولاته|زبده/.test(n)) return 'chocolate';
    if (/زيوت طبيعي/.test(c) || /^\s*(\[[^\]]+\])?\s*زيت /.test(n)) return 'oils';
    if (/العنايه والتجميل/.test(c)) return 'care';
    return 'review';
  }
  function size(name) {
    const m=String(name).match(/(?:نصف|ربع|\d+(?:[.,]\d+)?)\s*(?:كيلو(?:جرام)?|كجم|جرام|غرام|جم|لتر|مللي|مللى|مل|kg|ml|litre|liter|g)(?=\s|$|[)\]])/i);
    return m ? m[0] : '';
  }
  const isOffer=row=>/^\s*(?:\[[^\]]+\]\s*)?(?:عرض|عروض|اشتري|اشترى|باكدج|بكدج|bundle\b|offer\b|package\b)/i.test(String(row.productName||''));
  window.VirginiaMenu={groups,category,size,isOffer};
  let opened=false;
  try { opened=sessionStorage.getItem('virginia-menu-opened:' + location.pathname)==='1'; } catch (_) {}
  window.VirginiaWelcome={
    markup() { return ""; },
    content(en) {
      if(opened)return '';
      return `<section class="virginia-welcome" aria-labelledby="welcomeTitle">
        <div class="welcome-copy"><span class="premium-eyebrow">VIRGINIA · ${en?'ROOTED IN NATURE':'من الطبيعة'}</span><h2 id="welcomeTitle">${en?'Discover Virginia':'اكتشف منتجات فيرجينيا'}</h2>
        <p>${en?'From our olive press to your table. Explore a collection rooted in nature.':'من معصرتنا إلى مائدتك. اكتشف اختيارات فيرجينيا من خيرات الطبيعة.'}</p>
        <div class="welcome-actions"><button type="button" class="welcome-open">${en?'Open the menu':'افتح المنيو'} <span aria-hidden="true">↙</span></button><button type="button" class="welcome-skip">${en?'Skip introduction':'تخطي المقدمة'}</button></div></div>
        <div class="welcome-visual"><button type="button" class="heritage-lock" aria-label="${en?'Unlock the menu':'افتح المنيو بالمفتاح'}"><svg viewBox="0 0 280 210" fill="none" aria-hidden="true"><defs><linearGradient id="brass" x2="1" y2="1"><stop stop-color="#bba7e2"/><stop offset=".5" stop-color="#69508f"/><stop offset="1" stop-color="#e9def8"/></linearGradient></defs><circle cx="140" cy="105" r="96" stroke="#c1b2df" stroke-opacity=".25"/><circle cx="140" cy="105" r="83" stroke="#c1b2df" stroke-opacity=".2" stroke-dasharray="3 9"/><g class="lock-shackle"><path d="M107 97V68a33 33 0 0 1 66 0v29" stroke="url(#brass)" stroke-width="10"/></g><rect x="92" y="91" width="96" height="83" rx="13" fill="url(#brass)"/><rect x="100" y="99" width="80" height="67" rx="8" stroke="#604b81"/><path d="m108 111 8-5 8 5 8-5 8 5 8-5 8 5 8-5 8 5" stroke="#604b81"/><circle cx="140" cy="129" r="8" fill="#3c2e54"/><path d="m137 133-3 17h12l-3-17" fill="#3c2e54"/><g class="key-insert"><g class="ancient-key" stroke="url(#brass)" stroke-width="7" stroke-linecap="round"><circle cx="232" cy="149" r="17"/><path d="m215 149-62 0m10 0v13m13-13v9"/></g></g></svg></button></div>
      </section>`;
    },
    bind() {},
    mount(root,en,logo) {
      window.VirginiaMenuReady=true;
      if(opened){document.documentElement.classList.remove('menu-gated');return;}
      const overlay=document.createElement('div');overlay.className='menu-entry-overlay';
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','welcomeTitle');
      overlay.innerHTML=this.content(en);
      document.body.append(overlay);document.documentElement.classList.add('menu-gated');root.hidden=true;root.inert=true;
      const section=overlay.querySelector('.virginia-welcome');
      const finish=()=>{opened=true;try{sessionStorage.setItem('virginia-menu-opened:'+location.pathname,'1');}catch(_){}root.hidden=false;root.inert=false;document.documentElement.classList.remove('menu-gated');overlay.remove();window.removeEventListener('error',failOpen);window.removeEventListener('unhandledrejection',failOpen);window.scrollTo(0,0);root.querySelector('#customerSearch')?.focus({preventScroll:true});};
      const failOpen=()=>finish();window.addEventListener('error',failOpen);window.addEventListener('unhandledrejection',failOpen);
      const unlock=()=>{if(section.classList.contains('unlocking'))return;section.classList.add('unlocking');if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else setTimeout(finish,1200);};
      overlay.querySelector('.welcome-open').addEventListener('click',unlock);overlay.querySelector('.heritage-lock').addEventListener('click',unlock);overlay.querySelector('.welcome-skip').addEventListener('click',finish);
      overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish();}if(event.key==='Tab'){const buttons=[...overlay.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement);if(event.shiftKey&&i<=0){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&i===buttons.length-1){event.preventDefault();buttons[0].focus();}}});
      overlay.querySelector('.welcome-open').focus();
    }
  };
})();
