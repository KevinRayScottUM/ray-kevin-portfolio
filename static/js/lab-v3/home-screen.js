import {t} from '../i18n.js';
export function drawConsoleHome(context,logo,button){
  context.drawImage(logo,189,13,134,134);
  context.fillStyle='#b5ccc7';context.font='15px system-ui, sans-serif';context.fillText(t('console.title'),124,170);
  ['labs','cartridges','inspector','settings'].forEach((key,index)=>button(t('console.'+key),index,22+index*120,204,108,48));
}
