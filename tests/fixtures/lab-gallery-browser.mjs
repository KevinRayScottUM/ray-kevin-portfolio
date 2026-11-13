// Local browser QA only. This directory is not copied into Zola's public output.
export async function mountGalleryFixtures(){
  const {mountGallery,unmountGallery}=await import('/js/lab-gallery.js');
  const host=document.querySelector('[data-exhibit-gallery]');unmountGallery(host);
  host.querySelectorAll('.lab-project-reserved').forEach(row=>row.remove());
  const original=host.querySelector('[data-preview-template]'),row=host.querySelector('[data-exhibit-select]');
  for(const item of [
    {id:'fixture-rear',order:2,number:'02',title:'Rear geometry study',image:'/lab/tc06/previews/rear.png'},
    {id:'fixture-cartridges',order:3,number:'03',title:'Cartridge materials and an intentionally longer multi-line heading for layout validation',image:'/lab/tc06/previews/cartridges.png'},
  ]){
    const template=original.cloneNode(true);template.dataset.previewTemplate=item.id;template.dataset.order=item.order;
    const layer=template.content.firstElementChild;layer.dataset.previewId=item.id;layer.setAttribute('aria-labelledby','lab-title-'+item.id);
    const title=layer.querySelector('h2');title.id='lab-title-'+item.id;title.textContent=item.title+' / Development fixture';
    layer.querySelector('.lab-preview-header p>span:last-child').textContent='/ '+item.number;
    const eyebrow=layer.querySelector('.lab-preview-copy>.lab-eyebrow');eyebrow.removeAttribute('data-i18n');eyebrow.textContent='Local QA / '+item.number;
    layer.querySelector('.lab-preview-description').textContent='Development-only test content. This is not a registered public exhibit. The alternate source image exercises decoding, reverse transitions and stable information geometry.';
    const visual=layer.querySelector('[data-preview-visual]');
    if(visual.classList.contains('lab-showcase')){
      const link=document.createElement('a');link.className='lab-preview-visual';link.dataset.previewVisual='';link.href='/lab/world-simulator/';link.append(visual.querySelector('img').cloneNode(true));visual.replaceWith(link);
    }
    layer.querySelector('[data-preview-visual] img').src=item.image;
    layer.querySelectorAll('a').forEach(a=>a.href='/lab/world-simulator/');
    host.append(template);
    const button=row.cloneNode(true);button.dataset.exhibitSelect=item.id;button.classList.remove('is-selected');button.setAttribute('aria-pressed','false');
    button.querySelector('.lab-project-number').firstChild.textContent=item.number+' / Local QA fixture';button.querySelector('strong').textContent=item.title;
    host.querySelector('[data-project-list]').append(button);
  }
  return mountGallery(host).switcher.snapshot();
}
