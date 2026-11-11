export function drawConsoleHome(context,logo,button){
  context.drawImage(logo,189,13,134,134);
  context.fillStyle='#b5ccc7';context.font='15px system-ui, sans-serif';context.fillText('TENSORCAT RESEARCH CONSOLE',124,170);
  ['Labs','Cartridges','Inspector','Settings'].forEach((name,index)=>button(name,index,22+index*120,204,108,48));
}
