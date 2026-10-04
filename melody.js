let melodyRecording=false, melodySamples=[], melodyStart=0, melodyLimit=null, savedMelodies=[];
let recordingPending=false;
const recordButton=document.querySelector('#record'), melodyStatus=document.querySelector('#melody-status');
const library=document.querySelector('#library'), shiftSelect=document.querySelector('#shift');
const storageKey='guitare-melodies-v1';
function validMelody(m){return m&&typeof m.id==='string'&&typeof m.title==='string'&&Array.isArray(m.events)&&m.events.length<2000&&m.events.every(e=>(e.midi===null||(Number.isInteger(e.midi)&&e.midi>=0&&e.midi<=127))&&Number.isFinite(e.duration)&&e.duration>=0&&e.duration<=120);}
try{const parsed=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(parsed))savedMelodies=parsed.filter(validMelody).slice(-20);}catch{}
function refreshLibrary(selected){
 library.replaceChildren();
 for(const m of savedMelodies){const option=document.createElement('option');option.value=m.id;option.textContent=m.title;library.append(option);}
 if(selected)library.value=selected;else if(savedMelodies.length)library.value=savedMelodies[savedMelodies.length-1].id;
 renderMelody();
}
function selectedMelody(){return savedMelodies.find(m=>m.id===library.value);}
function melodySample(f){
 if(!melodyRecording)return;
 melodySamples.push({t:(performance.now()-melodyStart)/1000,midi:f>200&&f<4000?Math.round(midiFromFreq(f)):null});
 const seconds=Math.floor((performance.now()-melodyStart)/1000);
 document.querySelector('#record-time').textContent=seconds+' s / 120 s';
}
function finishMelody(){
 if(!melodyRecording)return;
 melodyRecording=false;clearTimeout(melodyLimit);melodyLimit=null;
 recordButton.textContent='🔴 Mémoriser la mélodie';
 document.querySelector('#guitar').disabled=false;document.querySelector('#whistle').disabled=false;
 const events=Melody.transcribe(melodySamples,Math.min(120,(performance.now()-melodyStart)/1000));
 if(!events.some(e=>e.midi!==null)){melodyStatus.textContent='Aucune note stable détectée. Réessaie en sifflant lentement une note à la fois.';return;}
 const now=new Date(), item={id:String(now.getTime()),title:'Mélodie du '+now.toLocaleString('fr-FR'),events};
 savedMelodies.push(item);savedMelodies=savedMelodies.slice(-20);
 let stored=true;try{localStorage.setItem(storageKey,JSON.stringify(savedMelodies));}catch{stored=false;}
 shiftSelect.value='auto';refreshLibrary(item.id);
 melodyStatus.textContent=stored?'Mélodie mémorisée sur cet appareil. Notes et tablature ci-dessous.':'Mélodie disponible ici, mais stockage bloqué. Télécharge le fichier texte pour la conserver.';
}
recordButton.onclick=async()=>{
 if(melodyRecording){finishMelody();stopListening();return;}
 if(recordingPending||starting)return;
 recordingPending=true;recordButton.disabled=true;
 try{
  selectMode('whistle');
  if(!running)await button.onclick();
  if(!running){melodyStatus.textContent='Le micro doit être actif pour mémoriser une mélodie. Consulte le message sous Démarrer.';return;}
  melodySamples=[];melodyStart=performance.now();melodyRecording=true;
  recordButton.textContent='⏹ Terminer la mélodie';document.querySelector('#record-time').textContent='0 s / 120 s';
  document.querySelector('#guitar').disabled=true;document.querySelector('#whistle').disabled=true;
  melodyStatus.textContent='Siffle lentement. Laisse un bref silence entre deux notes identiques. Appuie sur Terminer à la fin.';
  melodyLimit=setTimeout(()=>{finishMelody();stopListening();},120000);
 }finally{recordingPending=false;recordButton.disabled=false;}
};
function arrangement(){const m=selectedMelody();if(!m)return null;const shift=shiftSelect.value==='auto'?Melody.autoShift(m.events):Number(shiftSelect.value);return {m,shift,rows:Melody.arrange(m.events,shift)};}
function renderMelody(){
 const result=arrangement();document.querySelector('#melody-result').hidden=!result;
 document.querySelector('#download').disabled=!result;
 if(!result)return;
 const {m,shift,rows}=result;
 renderStaff(rows);
 document.querySelector('#original-notes').textContent=m.events.map(e=>e.midi===null?'(silence)':Melody.name(e.midi)).join(' → ');
 const missing=rows.filter(e=>e.target!==null&&!e.position).length;
 document.querySelector('#transpose-info').textContent=(shift===0?'Hauteur originale.':(shift<0?'Descendue de ':'Montée de ')+Math.abs(shift/12)+' octave(s) pour la guitare.')+(missing?' '+missing+' note(s) hors des cases 0 à 12 : signalées dans le tableau.':'');
 const tbody=document.querySelector('#note-rows');tbody.replaceChildren();
 rows.forEach((e,i)=>{const tr=document.createElement('tr');const values=[String(i+1),e.midi===null?'Silence':Melody.name(e.midi),e.duration.toFixed(2)+' s',e.target===null?'—':Melody.name(e.target),e.position?'Corde '+(e.position.string+1)+' · case '+e.position.fret:e.target===null?'Pause':'Hors tessiture'];for(const v of values){const td=document.createElement('td');td.textContent=v;tr.append(td);}tbody.append(tr);});
 document.querySelector('#tab-output').textContent=Melody.tablature(rows);
}
function renderStaff(rows){
 const box=document.querySelector('#staff'); if(!box)return; box.replaceChildren();
 const ns='http://www.w3.org/2000/svg', width=Math.max(640,rows.length*72+90), svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox',`0 0 ${width} 140`);svg.setAttribute('role','img');
 for(let i=0;i<5;i++){const line=document.createElementNS(ns,'line');line.setAttribute('x1','42');line.setAttribute('x2',width-18);line.setAttribute('y1',40+i*16);line.setAttribute('y2',40+i*16);line.setAttribute('stroke','#222');line.setAttribute('stroke-width','1.5');svg.append(line);}
 const clef=document.createElementNS(ns,'text');clef.textContent='𝄞';clef.setAttribute('x','10');clef.setAttribute('y','91');clef.setAttribute('font-size','55');clef.setAttribute('fill','#222');svg.append(clef);
 const natural=[0,2,4,5,7,9,11], namesShort=['Do','Ré','Mi','Fa','Sol','La','Si'];
 const yFor=midi=>{const pc=((midi%12)+12)%12, octave=Math.floor(midi/12)-1;let best=0,d=99;natural.forEach((n,i)=>{const diff=Math.abs(pc-n);if(diff<d){d=diff;best=i;}});const step=(octave-4)*7+best;return 104-step*8;};
 rows.forEach((e,i)=>{const x=68+i*72;if(e.target===null){const rest=document.createElementNS(ns,'text');rest.textContent='𝄽';rest.setAttribute('x',x);rest.setAttribute('y','78');rest.setAttribute('font-size','24');rest.setAttribute('fill','#333');svg.append(rest);return;}const y=yFor(e.target), stem=document.createElementNS(ns,'line');stem.setAttribute('x1',x+5);stem.setAttribute('x2',x+5);stem.setAttribute('y1',y);stem.setAttribute('y2',y-30);stem.setAttribute('stroke','#222');stem.setAttribute('stroke-width','2');svg.append(stem);const head=document.createElementNS(ns,'ellipse');head.setAttribute('cx',x);head.setAttribute('cy',y);head.setAttribute('rx','9');head.setAttribute('ry','6');head.setAttribute('transform',`rotate(-20 ${x} ${y})`);head.setAttribute('fill','#111');svg.append(head);const label=document.createElementNS(ns,'text');label.textContent=Melody.name(e.target).replace(/[0-9]+$/,'');label.setAttribute('x',x-14);label.setAttribute('y','128');label.setAttribute('class','note-label');svg.append(label);});
 box.append(svg);
}
library.onchange=()=>{shiftSelect.value='auto';renderMelody();};shiftSelect.onchange=renderMelody;
document.querySelector('#download').onclick=()=>{
 const result=arrangement();if(!result)return;
 const {m,shift,rows}=result;
 const text=m.title+'\nAccordage standard Mi La Ré Sol Si Mi. Cases 0 à 12.\nTransposition guitare : '+shift+' demi-tons.\nDurées approximatives ; colonnes de tablature de largeur fixe.\n\n'+rows.map((e,i)=>(i+1)+'. '+(e.midi===null?'Silence':Melody.name(e.midi))+' — '+e.duration.toFixed(2)+' s — '+(e.target===null?'pause':Melody.name(e.target)+(e.position?' / corde '+(e.position.string+1)+' case '+e.position.fret:' / hors tessiture'))).join('\n')+'\n\n'+Melody.tablature(rows);
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='melodie-'+m.id+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
refreshLibrary();
