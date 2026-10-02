(function(root){
  const names=['Do','Do♯','Ré','Ré♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si'];
  const strings=[64,59,55,50,45,40]; // High E to low E, standard tuning.
  const name=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
  function transcribe(samples,end){
    if(!samples.length)return [];
    const runs=[];
    for(const s of samples){
      const last=runs[runs.length-1];
      if(last&&last.midi===s.midi)last.count++;
      else runs.push({midi:s.midi,start:s.t,count:1});
    }
    // Reject fleeting pitch changes and preserve meaningful pauses.
    const spans=runs.map((r,i)=>({midi:r.count>=2&&((runs[i+1]?.start??end)-r.start)>=0.16?r.midi:null,start:r.start,duration:Math.max(0,(runs[i+1]?.start??end)-r.start)}));
    const merged=[];
    for(const span of spans){
      const prev=merged[merged.length-1];
      if(prev&&prev.midi===span.midi)prev.duration+=span.duration;
      else merged.push({...span});
    }
    while(merged.length&&merged[0].midi===null)merged.shift();
    while(merged.length&&merged[merged.length-1].midi===null)merged.pop();
    return merged;
  }
  function positions(m){return strings.flatMap((open,i)=>m-open>=0&&m-open<=12?[{string:i,fret:m-open}]:[]);}
  function autoShift(events){
    const notes=events.filter(e=>e.midi!==null);if(!notes.length)return 0;
    return [-36,-24,-12,0,12,24].map(shift=>({shift,fit:notes.filter(e=>positions(e.midi+shift).length).length})).sort((a,b)=>b.fit-a.fit||Math.abs(a.shift)-Math.abs(b.shift))[0].shift;
  }
  function arrange(events,shift){
    let previous=null;
    return events.map(e=>{
      if(e.midi===null)return {...e,position:null,target:null};
      const target=e.midi+shift;
      const candidates=positions(target);
      candidates.sort((a,b)=>cost(a)-cost(b));
      function cost(p){return p.fret*0.35+(previous?Math.abs(p.fret-previous.fret)+0.6*Math.abs(p.string-previous.string):0);}
      const position=candidates[0]||null;if(position)previous=position;
      return {...e,target,position};
    });
  }
  function tablature(arranged){
    const blocks=[];
    for(let base=0;base<arranged.length;base+=8){
      const chunk=arranged.slice(base,base+8), labels=['e aigu','Si    ','Sol   ','Ré    ','La    ','E grave'];
      const lines=['N°     '+chunk.map((_,i)=>String(base+i+1).padEnd(5)).join('')];
      for(let s=0;s<6;s++)lines.push(labels[s]+'|'+chunk.map(e=>(e.position?.string===s?String(e.position.fret):'-').padEnd(5,'-')).join('')+'|');
      blocks.push(lines.join('\n'));
    }
    return blocks.join('\n\n');
  }
  const api={name,transcribe,positions,autoShift,arrange,tablature};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Melody=api;
})(typeof window==='undefined'?globalThis:window);
