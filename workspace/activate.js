'use strict';
const invite=new URLSearchParams(location.hash.slice(1)).get('invite');
history.replaceState(null,'',location.pathname);
document.getElementById('activate').onsubmit=async e=>{
  e.preventDefault();const status=document.getElementById('status'),password=document.getElementById('password'),confirm=document.getElementById('confirm');
  if(password.value!==confirm.value){status.textContent='كلمتا المرور غير متطابقتين';return;}
  const button=e.target.querySelector('button');button.disabled=true;
  try{const response=await fetch(`${window.WORKSPACE_API}/workspace/activate`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,password:password.value})});
    const data=await response.json();if(!response.ok)throw new Error(data.message);password.value='';confirm.value='';e.target.hidden=true;status.textContent='تم التفعيل. استخدم رقم الموظف وكلمة المرور للدخول.';
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
};
