(function(){
  var language='en',theme='light';
  try{var l=localStorage.getItem('tensorcat.language'),t=localStorage.getItem('tensorcat.theme');if(l==='zh-CN')language=l;if(t==='dark')theme=t;}catch(_){}
  var root=document.documentElement;root.lang=language;root.dataset.language=language;root.dataset.theme=theme;root.style.colorScheme=theme;
})();
