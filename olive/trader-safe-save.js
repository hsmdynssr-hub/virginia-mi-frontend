'use strict';
// Persist financial intent, never credentials. Unknown outcomes remain available only to their owner.
window.TraderSafeSave=class TraderSafeSave {
 constructor(context){this.context=context;this.initial=context();this.suspended=false;this.controller=null;}
 suspend(){this.suspended=true;this.controller?.abort();}
 same(a,b){return a.userId===b.userId&&a.companyId===b.companyId;}
 assert(p){if(p.version!==2||!p.context)throw Error('طلب قديم غير مربوط بسياق موثق؛ ممنوع إرساله تلقائيًا. راجع نتيجة العملية مع المسؤول قبل بدء حركة جديدة.');const current=this.context();if(this.suspended||!current.authenticated||!this.same(current,this.initial)||!this.same(p.context,current)||String(p.body.companyId)!==current.companyId||String(p.body.sessionId||'')!==p.context.sessionId||(p.context.sessionId&&current.sessionId!==p.context.sessionId))throw Error('توقف الإرسال: تغيّر المستخدم أو الشركة أو الجلسة. ارجع للسياق الأصلي وأعد تحميل الصفحة.');}
 key(context=this.initial){return `olive-traders-v2:${context.companyId}:${context.userId}`;}
 envelope(path,body,permission){const context=this.context();if(!context.authenticated||!this.same(context,this.initial)||this.suspended)throw Error('أعد تسجيل الدخول وتحميل الصفحة');return {version:2,path,body,permission,context:{userId:context.userId,companyId:context.companyId,sessionId:String(body.sessionId||'')},storageKey:this.key(context),createdAt:new Date().toISOString()};}
 async store(mode,value){
  const storageKey=value?.storageKey||this.key(),legacyKey=`olive-traders:${this.initial.companyId}:${this.initial.userId}`;
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open('olive-trader-safe-save',1);req.onupgradeneeded=()=>req.result.createObjectStore('requests');req.onerror=()=>reject(Error('تعذر فتح حفظ الطلب؛ لم يرسل طلب جديد'));
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction('requests',mode==='get'?'readonly':'readwrite'),s=tx.objectStore('requests');let result,error;
    const existing=s.get(storageKey);existing.onsuccess=()=>{
     const old=existing.result;
     if(mode==='delete'){if(old?.body.requestKey===value.body.requestKey)s.delete(storageKey);return;}
     const legacy=s.get(legacyKey);legacy.onsuccess=()=>{
      if(mode==='get'){result=old||legacy.result;return;}
      if(legacy.result||(old&&old.body.requestKey!==value.body.requestKey)){error=Error('يوجد طلب محفوظ في تبويب آخر؛ أعد تحميل الصفحة وراجع نتيجته أولًا');tx.abort();return;}
      s.put(value,storageKey);
     };
    };
    tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(error||Error('تعذر حفظ الطلب؛ لم يرسل طلب جديد'));};
   };
  });
 }
 async send(p,{authorize,url,headers}){
  this.assert(p);this.controller=new AbortController();
  try{const access=await authorize();this.assert(p);if(String(access.userId)!==p.context.userId||String(access.companyId)!==p.context.companyId)throw Error('هوية الدخول الحالية من الخادم تختلف عن صاحب الطلب؛ توقف الإرسال');if(!access.permissions.includes(p.permission))throw Error('تم سحب صلاحية العملية؛ الطلب محفوظ دون إعادة إرسال');
   // No await between the final context check and retrieving fresh credentials/sending.
   this.assert(p);return await fetch(url+p.path,{method:'POST',headers:headers(),body:JSON.stringify(p.body),signal:this.controller.signal});
  }finally{this.controller=null;}
 }
};
