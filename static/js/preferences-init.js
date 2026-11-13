(function(){
  var language='en',theme='light';
  try{var l=localStorage.getItem('tensorcat.language'),t=localStorage.getItem('tensorcat.theme');if(l==='zh-CN')language=l;if(t==='dark')theme=t;}catch(_){}
  var root=document.documentElement,effective=root.dataset.appearanceScope==='lab'?'dark':theme;root.lang=language;root.dataset.language=language;root.dataset.theme=theme;root.dataset.effectiveTheme=effective;root.style.colorScheme=effective;
})();
