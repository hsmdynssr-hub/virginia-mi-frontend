"use strict";
const $=id=>document.getElementById(id),e=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const m=v=>new Intl.NumberFormat("ar-EG",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
const urls=[];
window.addEventListener("pagehide",()=>urls.forEach(u=>URL.revokeObjectURL(u)));
document.addEventListener("DOMContentLoaded",async()=>{
  if(!getToken()){location.href="../admin/login.html";return;}
  try{
    const p=new URLSearchParams(location.search),id=p.get("id"),companyId=Number(p.get("companyId")||getCompanyId()||1);
    if(!/^[1-9]\d*$/.test(id||"")||!Number.isSafeInteger(companyId)||companyId<1)throw Error("رقم السند أو الشركة غير صحيح");
    const result=await apiGet("/olive/receipts/"+encodeURIComponent(id),{companyId}),r=result.data||result;
    let settings={};try{const s=await apiGet("/olive/admin/print-settings",{companyId});settings=s.data||s;}catch(err){$("msg").textContent="تم تحميل السند؛ تعذر تحميل إعدادات الطباعة: "+err.message;}
    if(settings.has_logo){try{
      const url=new URL(API_BASE_URL+"/olive/admin/receipt-logo");url.searchParams.set("companyId",companyId);
      const response=await fetch(url,{headers:{Authorization:"Bearer "+getToken()},cache:"no-store"});
      if(response.ok){settings.logo_url=URL.createObjectURL(await response.blob());urls.push(settings.logo_url);}
    }catch(_){/* The receipt stays usable if the logo cannot be loaded. */}}
    $("title").textContent="سند "+r.receipt_no;
    if(r.receiving_status==="CANCELLED"){$("status").className="cancelled";$("status").textContent="ملغى — "+r.cancellation_reason+" — "+r.cancelled_by+" — "+new Date(r.cancelled_at).toLocaleString("ar-EG");}
    $("invoice").srcdoc=OliveReceiptPrint.render(r,settings,companyId);
    $("print").disabled=false;$("print").onclick=()=>OliveReceiptPrint.print(r,settings,companyId);
    $("supplier").innerHTML=[["المورد",r.supplier_name],["الهاتف",r.supplier_phone],["الرقم القومي",r.supplier_national_id],["العنوان",r.supplier_address],["السيارة",r.vehicle_plate],["المحاسب",r.created_by]].map(([k,v])=>`<p><strong>${e(k)}:</strong> ${e(v||"—")}</p>`).join("");
    $("payments").innerHTML=(r.payments||[]).length?`<table><thead><tr><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>التاريخ</th></tr></thead><tbody>${r.payments.map(x=>`<tr><td>${m(x.amount)}</td><td>${e(x.payment_method)}</td><td>${e(x.reference_no||"—")}</td><td>${e(new Date(x.paid_at).toLocaleString("ar-EG"))}</td></tr>`).join("")}</tbody></table>`:"لا توجد دفعات مسجلة";
    $("attachments").textContent=(r.attachments||[]).length?"":"لا توجد مرفقات لهذا السند";
    for(const a of r.attachments||[]){
      const box=document.createElement("div");box.className="attachment";
      const label=document.createElement("p");label.textContent=(a.attachment_type==="ID_CARD"?"صورة البطاقة":a.attachment_type==="RECEIPT"?"صورة المستند":"مرفق")+" — "+a.file_name;box.append(label);
      const view=document.createElement("button"),download=document.createElement("button");view.className=download.className="btn";view.textContent="عرض المرفق";download.textContent="تنزيل";box.append(view,document.createTextNode(" "),download);$("attachments").append(box);
      const path="/olive/receipts/"+encodeURIComponent(id)+"/attachments/"+encodeURIComponent(a.id);
      download.onclick=async()=>{download.disabled=true;try{await apiDownload(path,{companyId},a.file_name||"attachment");}catch(err){$("msg").textContent=err.message;}finally{download.disabled=false;}};
      view.onclick=async()=>{
        view.disabled=true;
        try{
          const url=new URL(API_BASE_URL+path);url.searchParams.set("companyId",companyId);
          const response=await fetch(url,{headers:{Authorization:"Bearer "+getToken()},cache:"no-store"});
          if(!response.ok)throw Error("تعذر تحميل المرفق: "+response.status);
          const type=response.headers.get("Content-Type")?.split(";")[0];
          if(!["image/jpeg","image/png","image/webp","image/gif","application/pdf"].includes(type))throw Error("هذا النوع متاح بالتنزيل فقط");
          const blob=await response.blob(),objectUrl=URL.createObjectURL(blob);urls.push(objectUrl);
          if(type==="application/pdf"){const link=document.createElement("a");link.href=objectUrl;link.target="_blank";link.rel="noopener noreferrer";link.textContent="فتح PDF";box.append(link);}
          else{const img=document.createElement("img");img.src=objectUrl;img.alt=label.textContent;img.className="preview";box.append(img);}
          view.textContent="تم عرض المرفق";
        }catch(err){$("msg").textContent=err.message;view.disabled=false;}
      };
    }
  }catch(err){$("msg").textContent=err.message||"تعذر تحميل السند";}
});
