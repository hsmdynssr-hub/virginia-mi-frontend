'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const scenes = {
    sales:{title:'أداء المبيعات والفروع',icon:'chart',metrics:[['قيمة المبيعات','٢٤٨٬٥٠٠','جنيه'],['طلبات البيع','٣٤٢','طلبًا'],['متوسط الطلب','٧٢٧','جنيه']],chart:'مقارنة أداء الفروع',bars:[['فرع ١',82],['فرع ٢',61],['فرع ٣',72]],focus:'من الإجمالي إلى التفاصيل',text:'راجع أداء الفروع والأصناف وحركة المبيعات خلال الفترة التي تختارها.',tags:['الفروع','الأصناف','الفترات'],foot:'تجميعات تساعدك على قراءة الأداء',description:'افهم ما يُباع، وأين، وكيف يتغير الأداء.'},
    inventory:{title:'المخزون وحركة الأصناف',icon:'box',metrics:[['الأصناف المتابعة','١٢٨','صنفًا'],['حركات المخزون','٤٦','حركة'],['للمراجعة','٧','أصناف']],chart:'توزيع الكميات',bars:[['موقع ١',60],['موقع ٢',85],['موقع ٣',43]],focus:'اعرف أين توجد الكمية',text:'تابع الأرصدة والحركات والجرد، وحدد الأصناف التي تحتاج مراجعة أو إعادة طلب.',tags:['الأرصدة','الحركات','الجرد'],foot:'رؤية للمخزون حسب المواقع والأصناف',description:'من الرصيد إلى الحركة والجرد، افهم موقف مخزونك.'},
    production:{title:'الإنتاج وتكلفة التصنيع',icon:'factory',metrics:[['أوامر الإنتاج','٢٤','أمرًا'],['الإنتاج المنجز','٨٬٤٠٠','وحدة'],['متوسط التكلفة','٣٢٫٥','جنيه / وحدة']],chart:'كميات الإنتاج',bars:[['يوم ١',51],['يوم ٢',76],['يوم ٣',92]],focus:'الكمية والتكلفة معًا',text:'راجع أوامر الإنتاج والخامات وتكلفة التصنيع لفهم نتائج التشغيل.',tags:['أوامر الإنتاج','الخامات','التكلفة'],foot:'متابعة التشغيل وتحليل تكلفة الإنتاج',description:'تابع ما تم إنتاجه وما استهلكه وما تكلفه.'},
    purchase:{title:'المشتريات وأداء الموردين',icon:'bag',metrics:[['قيمة الشراء','١٨٦٬٠٠٠','جنيه'],['أوامر الشراء','٣١','أمرًا'],['الموردون','١٢','موردًا']],chart:'توزيع المشتريات',bars:[['مورد ١',77],['مورد ٢',48],['مورد ٣',65]],focus:'قرار شراء مبني على المقارنة',text:'قارن أسعار الشراء، وتابع الأوامر المفتوحة وأداء الموردين خلال الفترة.',tags:['الأسعار','الموردون','الأوامر المفتوحة'],foot:'تحليل يساعد على مراجعة قرارات الشراء',description:'قارن الأسعار وتابع الموردين وما لم يكتمل من أوامر الشراء.'},
    olive:{title:'موسم الزيتون من الشراء للمعصرة',icon:'leaf',metrics:[['الكمية المشتراة','١٦٬٣٥٠','كجم'],['قيمة الشراء','١٬٠٧٥٬٩٢٥','جنيه'],['منصات الشراء','٣','منصات']],chart:'الشراء حسب المنصة',bars:[['القصر',74],['براني',88],['الضبعة',80]],focus:'كل مرحلة بمصدرها الواضح',text:'حلّل مشتريات المنصات وجهات التسليم، وراجع استلام المعاصر الفعلي بصافي البسكول.',tags:['المشتريات','العهد والمصاريف','البسكول'],foot:'المشتريات واستلام المعاصر تقريران مستقلان',description:'تابع منصات الشراء والمصاريف واستلامات المعاصر.'},
    customer:{title:'خدمة العملاء والمتابعات',icon:'users',metrics:[['حالات المتابعة','٤٨','حالة'],['مراجعات العملاء','٢٦','مراجعة'],['تمت المتابعة','٣٥','حالة']],chart:'نشاط المتابعة',bars:[['يوم ١',65],['يوم ٢',85],['يوم ٣',71]],focus:'المعلومة تتحول إلى متابعة',text:'راجع ملاحظات العملاء وحالات الخدمة والإجراءات المسجلة لدعم متابعة الفريق.',tags:['الملاحظات','المراجعات','الإجراءات'],foot:'موقف الحالات والمتابعات أمام الفريق',description:'حوّل الملاحظات والمراجعات إلى متابعة منظمة.'}
  };
  const keys=Object.keys(scenes), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let active='sales', motionWanted=!reduced.matches, hovered=false, timer=null, motionPresentation='';
  const icon = name => `<svg aria-hidden="true"><use href="#li-${name}"/></svg>`;
  function updateMotion(){
    clearTimeout(timer);
    const paused=!motionWanted||reduced.matches;
    $('motionToggle').setAttribute('aria-pressed',String(paused));$('motionToggle').disabled=reduced.matches;
    const label=reduced.matches?'حركة مخفّضة':paused?'تشغيل العرض':'إيقاف الحركة';
    // Keep the focused button's children stable between mousedown and click.
    if(motionPresentation!==label){$('motionToggle').innerHTML=icon(paused?'play':'pause')+`<span>${label}</span>`;motionPresentation=label;}
    const focused=document.activeElement;
    if(!paused&&!hovered&&!document.hidden&&!$('loginCard').contains(focused)&&!$('discovery').contains(focused))timer=setTimeout(()=>showScene(keys[(keys.indexOf(active)+1)%keys.length]),6500);
  }
  function showScene(key){
    const scene=scenes[key];active=key;
    document.querySelectorAll('[data-module]').forEach(button=>{const selected=button.dataset.module===key;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
    $('modulePanel').setAttribute('aria-labelledby','module-'+key);$('modulePanel').dataset.scene=key;
    $('boardTitle').textContent=scene.title;$('boardIcon').innerHTML=icon(scene.icon);
    $('boardMetrics').innerHTML=scene.metrics.map(m=>`<div class="demo-metric"><span>${m[0]}</span><strong>${m[1]}</strong><small>${m[2]}</small></div>`).join('');
    $('chartTitle').textContent=scene.chart;
    $('demoBars').innerHTML=scene.bars.map(b=>`<div class="demo-bar"><i style="height:${b[1]}%"></i><span>${b[0]}</span></div>`).join('');
    $('focusTitle').textContent=scene.focus;$('focusText').textContent=scene.text;
    $('focusTags').innerHTML=scene.tags.map(t=>`<span>${t}</span>`).join('');
    const index=String(keys.indexOf(key)+1).padStart(2,'0');$('sceneIndex').textContent=index;$('focusNumber').textContent=index;
    $('sceneDescription').textContent=scene.description;$('boardFootnote').textContent=scene.foot;
    if(!reduced.matches){$('modulePanel').classList.remove('scene-enter');void $('modulePanel').offsetWidth;$('modulePanel').classList.add('scene-enter');}
    updateMotion();
  }
  document.querySelectorAll('[data-module]').forEach(button=>{
    button.addEventListener('click',()=>{motionWanted=false;showScene(button.dataset.module);});
    button.addEventListener('keydown',event=>{
      const i=keys.indexOf(button.dataset.module),next=event.key==='ArrowLeft'?(i+1)%keys.length:event.key==='ArrowRight'?(i+keys.length-1)%keys.length:event.key==='Home'?0:event.key==='End'?keys.length-1:null;
      if(next!==null){event.preventDefault();motionWanted=false;showScene(keys[next]);$('module-'+keys[next]).focus();}
    });
  });
  $('motionToggle').addEventListener('click',()=>{motionWanted=!motionWanted;updateMotion();});
  $('discovery').addEventListener('mouseenter',()=>{hovered=true;updateMotion();});$('discovery').addEventListener('mouseleave',()=>{hovered=false;updateMotion();});
  document.addEventListener('focusin',updateMotion);document.addEventListener('focusout',()=>setTimeout(updateMotion,0));
  document.addEventListener('visibilitychange',updateMotion);reduced.addEventListener('change',()=>{if(reduced.matches)motionWanted=false;updateMotion();});
  showScene(active);

  // Keep the existing login endpoint, token keys, company selection and redirect.
  const card=$('loginCard'),originalForm=card.innerHTML;
  let busy=false,stage='form';
  function message(text){const target=$('loginMessage');if(target)target.textContent=text;}
  function clearSession(){for(const key of ['token','user','companyId','branchCode'])localStorage.removeItem(key);}
  function enterCompany(id){localStorage.setItem('companyId',String(id));localStorage.removeItem('branchCode');stage='complete';window.location.href='../dashboard/index.html';}
  function showCompanies(companies){
    stage='companies';card.replaceChildren();
    const kicker=document.createElement('span');kicker.className='company-step-kicker';kicker.textContent='تم تسجيل الدخول بنجاح';
    const title=document.createElement('h2');title.id='loginTitle';title.textContent='اختر نطاق العمل';
    const note=document.createElement('p');note.className='company-note';note.textContent='اختر الشركة التي تريد فتح تقاريرها. يمكنك تغيير الشركة النشطة لاحقًا من أعلى النظام.';
    const options=document.createElement('div');options.className='company-options';
    for(const company of companies){
      const button=document.createElement('button');button.type='button';button.className='company-option';button.dataset.loginCompany=String(company.companyId);
      const initial=document.createElement('span');initial.className='company-initial';initial.textContent=String(company.companyId)==='1'?'V':'C';
      const info=document.createElement('div'),name=document.createElement('strong'),small=document.createElement('small');
      name.textContent=String(company.companyName||'الشركة '+company.companyId);small.textContent='فتح تقارير الشركة';info.append(name,small);
      const arrow=document.createElement('span');arrow.innerHTML=icon('arrow');button.append(initial,info,arrow);
      button.addEventListener('click',()=>enterCompany(company.companyId));options.append(button);
    }
    const back=document.createElement('button');back.type='button';back.className='company-back';back.textContent='العودة إلى تسجيل الدخول';
    back.addEventListener('click',()=>{clearSession();stage='form';card.innerHTML=originalForm;bindForm();$('username').focus();});
    card.append(kicker,title,note,options,back);options.querySelector('button')?.focus();
  }
  async function login(){
    if(busy||stage!=='form')return;
    const username=$('username'),password=$('password'),button=$('loginBtn');message('');
    username.removeAttribute('aria-invalid');password.removeAttribute('aria-invalid');
    if(!username.value.trim()||!password.value){
      message('من فضلك أدخل اسم المستخدم وكلمة المرور');const empty=!username.value.trim()?username:password;empty.setAttribute('aria-invalid','true');empty.focus();return;
    }
    busy=true;button.disabled=true;button.setAttribute('aria-busy','true');button.querySelector('span').textContent='جاري الدخول…';
    username.readOnly=true;password.readOnly=true;$('passwordToggle').disabled=true;
    let sessionWritten=false,companyStep=false;
    try{
      const response=await apiPost('/auth/login',{username:username.value.trim(),password:password.value});
      if(!response.success||typeof response.token!=='string'||!response.token||!response.user){message('بيانات الدخول غير صحيحة. راجع اسم المستخدم وكلمة المرور.');return;}
      localStorage.setItem('token',response.token);sessionWritten=true;localStorage.setItem('user',JSON.stringify(response.user));localStorage.removeItem('companyId');localStorage.removeItem('branchCode');
      companyStep=true;const access=await apiGet('/company-access/me'),raw=access.data||access.companies||[];
      const companies=Array.isArray(raw)?raw.filter(c=>c&&Number.isSafeInteger(Number(c.companyId))&&Number(c.companyId)>0):[];
      if(!access.success||!companies.length){clearSession();message('لا توجد شركة مسموحة لهذا الحساب. تواصل مع مسؤول النظام.');return;}
      if(companies.length===1)enterCompany(companies[0].companyId);else showCompanies(companies);
    }catch(error){
      if(sessionWritten)clearSession();
      message(companyStep?'تعذر تحميل الشركات المتاحة. حاول تسجيل الدخول مرة أخرى.':error instanceof TypeError?'تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.':'تعذر تسجيل الدخول. راجع اسم المستخدم وكلمة المرور وحاول مرة أخرى.');
    }finally{
      busy=false;button.disabled=false;button.removeAttribute('aria-busy');button.querySelector('span').textContent='تسجيل الدخول';username.readOnly=false;password.readOnly=false;
      const toggle=$('passwordToggle');if(toggle)toggle.disabled=false;
    }
  }
  function bindForm(){
    $('loginForm').addEventListener('submit',event=>{event.preventDefault();login();});
    $('passwordToggle').addEventListener('click',()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('passwordToggle').setAttribute('aria-pressed',String(show));$('passwordToggle').setAttribute('aria-label',show?'إخفاء كلمة المرور':'إظهار كلمة المرور');});
    for(const id of ['username','password'])$(id).addEventListener('input',()=>{$(id).removeAttribute('aria-invalid');message('');});
    for(const name of ['keydown','keyup'])$('password').addEventListener(name,event=>{$('capsWarning').hidden=!event.getModifierState?.('CapsLock');});
    $('password').addEventListener('blur',()=>{$('capsWarning').hidden=true;});
  }
  window.login=login;bindForm();
})();
