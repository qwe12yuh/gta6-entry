import { BOATHOUSE, CAMPAIGN, CREW, DISTRICTS, HOME, VEHICLES, WEAPONS, clamp, districtAt, isGround } from './config.js';
import { clockLabel, openVehicle } from './engine.js';
import { portrait, renderCityChart } from './hud.js';
import { careerSummary, currentObjective, DROPS, emptyCareer, RAMPS, RACES, RELICS, startActivity } from './missions.js';
import { raiseWanted } from './police.js';
import { canSail, resprayVehicle } from './vehicles.js';

const prefix='solaris-keys.v1.';
const slots=['autosave','slot-1','slot-2'];
const previousOperations=[0,1,2,4,5,7];
const reserve=[0,0,68,125,32,150,6];
const completionLabels=['Story','Races','Stunt Ramps','Reef Relics','Contraband','Districts Controlled','Crew Recruited','Gold Ratings'];
const tabs=['Pause','Atlas','Story','Career','Crew','Garage','Save'];
const controls=[
  ['WASD','Walk / steer / throttle'],['MOUSE','Drag to look'],['F','Enter / exit vehicle'],['E','Interact / use cover'],
  ['SHIFT','Sprint / nitro'],['SPACE','Handbrake / lift'],['CTRL','Descend'],['LMB','Attack / drive-by'],
  ['1–7 / R','Select / reload weapon'],['M / ESC','Atlas / pause'],['V','Change camera'],['Q / T','Radio / time of day'],
];

function writeSlot(name,state){
  try{localStorage.setItem(prefix+name,JSON.stringify(state));return true;}catch{return false;}
}

function normalizeCareer(st){
  const career=emptyCareer();
  if(st.version===1){
    previousOperations.slice(0,clamp(Math.floor(st.completed||0),0,6)).forEach(i=>career.medals[i]='Bronze');
    career.crew=[...new Set(CAMPAIGN.filter((_,i)=>career.medals[i]).map(op=>op.crew))];
    return career;
  }
  const source=st.career??{};
  career.medals=CAMPAIGN.map((_,i)=>['Gold','Silver','Bronze'].includes(source.medals?.[i])?source.medals[i]:null);
  for(const [key,max] of Object.entries({races:RACES.length,stunts:RAMPS.length,relics:RELICS.length,drops:DROPS.length})){
    career[key]=Array.isArray(source[key])?[...new Set(source[key].filter(i=>Number.isInteger(i)&&i>=0&&i<max))]:[];
  }
  career.crew=Object.keys(CREW).filter(name=>Array.isArray(source.crew)&&source.crew.includes(name));
  return career;
}

function readSlot(name){
  try {
    const st=JSON.parse(localStorage.getItem(prefix+name));
    if(![1,2].includes(st?.version)||!Number.isFinite(st.money)||!Array.isArray(st.position)||st.position.length!==3||!st.position.every(Number.isFinite))return null;
    const career=normalizeCareer(st);
    const old=Math.floor(st.index||0);
    const index=st.version===1?(previousOperations[old]??career.medals.indexOf(null)):st.index;
    const operation=clamp(Number.isInteger(index)&&index>=0?index:0,0,CAMPAIGN.length);
    return {...st,career,index:operation,stage:clamp(Math.floor(st.stage||0),0,(CAMPAIGN[operation]?.stages.length??1)-1),
      control:DISTRICTS.map((_,i)=>clamp(Number(st.control?.[i])||0,0,100))};
  }catch{return null;}
}

function snapshot(sim){
  const p=sim.player,v=p.vehicle,m=sim.missions;
  return {version:2,savedAt:Date.now(),money:sim.stats.money,rp:sim.stats.rp,control:sim.stats.control,career:sim.career,
    index:m.index,stage:m.stage,elapsed:m.elapsed,damage:m.damage,hits:m.hits,alternate:m.alternate,waypoint:m.waypoint,
    clock:sim.clock,position:sim.focus().toArray(),yaw:v?.yaw??p.yaw,health:p.health,armor:p.armor,
    vehicle:v?.type??null,hull:v?.hull??100,nitro:v?.nitro??100,paint:v?.paint??0,station:sim.audio.radio.station,
    wanted:sim.police.stars,weapon:sim.combat.weapon,ammo:sim.combat.ammo,reserve:sim.combat.reserve,cooldowns:sim.cooldowns};
}

function seedDossiers(){
  const first=n=>Array.from({length:n},(_,i)=>i);
  const crew=Object.keys(CREW);
  const demos=[
    {index:4,stage:2,money:18450,rp:1900,clock:17+4/60,position:[64,0,121],vehicle:'apex',wanted:5,
      control:[76,66,52,49,23,17],medals:['Gold','Silver','Gold','Gold','Gold'],counts:[3,6,12,4,3]},
    {index:2,stage:1,money:6640,rp:730,clock:19+12/60,position:[-123,0,-137],weapon:5,
      control:[42,48,39,21,9,6],medals:['Gold','Silver'],counts:[1,2,11,2,2]},
    {index:8,stage:0,money:42900,rp:3020,clock:17+58/60,position:[470,0,-211],vehicle:'heli',yaw:-1.48,
      control:[83,74,66,52,35,27],medals:['Gold','Gold','Gold','Silver','Gold','Gold','Gold','Bronze'],counts:[3,6,14,5,3]},
  ];
  for(let i=0;i<slots.length;i++){
    try{if(localStorage.getItem(prefix+slots[i])!==null)continue;}catch{return;}
    const {medals,counts,...state}=demos[i];
    const [races,stunts,relics,drops,recruits]=counts;
    const career={medals:CAMPAIGN.map((_,n)=>medals[n]??null),races:first(races),stunts:first(stunts),relics:first(relics),
      drops:first(drops),crew:i===1?['Rico','Vega']:crew.slice(0,recruits)};
    writeSlot(slots[i],{version:2,savedAt:100-i,...state,career});
  }
}

function restore(sim,st){
  if(!st)return false;
  sim.resetActors();
  const p=sim.player,m=sim.missions;
  const [x,rawY,z]=st.position,y=clamp(rawY,0,230),yaw=Number(st.yaw)||0;
  const ground=sim.world.canMove(x,z,0,.5);
  p.person.group.position.set(ground?x:HOME.x,0,ground?z:HOME.z+3);
  p.person.group.visible=true;p.yaw=yaw;p.pitch=0;p.orbit=0;
  if(st.vehicle&&Object.hasOwn(VEHICLES,st.vehicle)){
    const style=VEHICLES[st.vehicle].style;
    if(style==='boat'?canSail(x,z):sim.world.canMove(x,z,style==='heli'?y:0,.75)){
      const altitude=style==='heli'?y:0;
      const parked=sim.vehicles.find(v=>v.type===st.vehicle&&v.pos.distanceTo(p.person.group.position)<5&&
        Math.hypot(v.pos.x-x,v.pos.z-z)<4);
      const v=parked??openVehicle(sim,st.vehicle,x,z,yaw,altitude);
      if(parked){parked.pos.set(x,altitude,z);parked.yaw=yaw;sim.takeVehicle(parked,true);}
      v.hull=clamp(Number(st.hull)||100,1,100);v.nitro=clamp(Number(st.nitro??100)||0,0,100);
      if(Number.isInteger(st.paint)&&st.paint>0)resprayVehicle(v,st.paint);
    }
  }
  p.health=clamp(Number(st.health)||100,1,100);p.armor=clamp(Number(st.armor??50)||0,0,100);
  sim.stats={money:Math.max(0,Math.floor(st.money)),rp:Math.max(0,Math.floor(st.rp||0)),control:st.control};
  sim.career=st.career;
  m.index=st.index;m.stage=clamp(Math.floor(st.stage||0),0,(CAMPAIGN[m.index]?.stages.length??1)-1);
  m.elapsed=Math.max(0,Number(st.elapsed)||0);m.damage=Math.max(0,Number(st.damage)||0);
  m.hits=Math.max(0,Math.floor(st.hits||0));m.alternate=null;
  const activity=st.alternate;
  if(activity?.kind==='race'&&RACES[activity.id]?.points[activity.step]&&Number.isFinite(activity.time)&&activity.time>0)m.alternate={...activity};
  if(activity?.kind==='drop'&&DROPS[activity.step])m.alternate={...activity};
  m.waypoint=Number.isFinite(st.waypoint?.x)&&Number.isFinite(st.waypoint?.z)?st.waypoint:null;
  const stage=CAMPAIGN[m.index]?.stages[m.stage][0];
  raiseWanted(sim,clamp(Number(st.wanted??(stage==='evade'?(m.index===7?5:3):0))||0,0,5));
  sim.clock=clamp(Number(st.clock??16.6)||0,0,23.99);
  sim.audio.radio.station=clamp(Math.floor(st.station??1),0,3);
  sim.combat.ammo=WEAPONS.map((w,i)=>clamp(Math.floor(st.ammo?.[i]??w.capacity),0,w.capacity));
  sim.combat.reserve=WEAPONS.map((_,i)=>Math.max(0,Math.floor(st.reserve?.[i]??reserve[i])));
  sim.combat.select(clamp(Math.floor(st.weapon??2),0,6));
  sim.cooldowns=Object.values(CREW).map(({cooldown},i)=>clamp(Number(st.cooldowns?.[i])||0,0,cooldown));
  sim.cameraCut=true;sim.hitUntil=sim.hitMarkerUntil=sim.aimUntil=0;
  sim.messages.until=sim.messages.commsUntil=0;
  return true;
}

function button(label,action,primary=false,disabled=false){
  return '<button type="button" class="action-button'+(primary?' primary':'')+'" data-action="'+action+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
}

function careerCard(career,control,expanded=false){
  const {counts,limits,percent}=careerSummary(career,control);
  const shown=expanded?completionLabels.length:4;
  const metrics=completionLabels.slice(0,shown).map((label,i)=>'<div><span>'+label+'</span><b>'+counts[i]+'<small> / '+limits[i]+'</small></b></div>').join('');
  const medals=career.medals.map((medal,i)=>'<span class="medal '+(medal?.toLowerCase()??'open')+'" title="Operation '+(i+1)+' · '+(medal??'Open')+'" aria-label="'+(medal??'Open')+'">'+(medal?.[0]??'·')+'</span>').join('');
  return '<section class="career-card panel"><div class="progress-ring" style="--progress:'+percent+'%"><div><strong>'+percent+'%</strong><span>COMPLETE</span></div></div>'+
    '<div class="career-body"><h2>Career Progress</h2><div class="career-metrics">'+metrics+'</div><div class="medals" aria-label="Operation medals">'+medals+'</div></div></section>';
}

function controlSheet(){
  return '<section class="panel control-sheet"><h2>FIELD CONTROLS</h2><div class="control-grid">'+
    controls.map(([key,label])=>'<div><kbd>'+key+'</kbd>'+label+'</div>').join('')+'</div></section>';
}

function saveCards(data,writable){
  return data.map((st,i)=>{
    const title=st?CAMPAIGN[st.index]?.name.toUpperCase()??'FREE ROAM':'EMPTY SLOT';
    const op=st&&st.index<CAMPAIGN.length?'OP '+(st.index+1)+' · ':'';
    const d=st?DISTRICTS[districtAt(st.position[0],st.position[2])].name:'';
    const caption=st?'<p>'+d+'</p><div class="slot-meta"><span>$'+st.money.toLocaleString('en-US')+'</span><time>'+clockLabel(st.clock??16.6)+'</time></div>':'';
    const percent=st?careerSummary(st.career,st.control).percent+'%':'';
    return '<article class="save-slot"><header><span>SLOT '+(i+1)+'</span><strong>'+percent+'</strong></header>'+
      '<h3>'+op+title+'</h3>'+caption+'<div class="save-actions">'+(writable?button('Save','save-'+i):'')+button('Load','load-'+i,false,!st)+'</div></article>';
  }).join('');
}

function activityList(sim){
  const races=RACES.map(({name,district},i)=>'<div class="activity-row"><div><strong>'+name+'</strong><span>'+
    DISTRICTS[district].name+(sim.career.races.includes(i)?' · CLEARED':'')+'</span></div>'+button('Race','race-'+i)+'</div>').join('');
  return '<section class="panel hub-sidebar"><h2>Street Races</h2>'+races+
    '<h2>Contraband</h2><div class="activity-row"><div><strong>Dead Drop Circuit</strong><span>'+sim.career.drops.length+' / '+DROPS.length+
    ' RECOVERED</span></div>'+button('Start','drop',false,sim.career.drops.length===DROPS.length)+'</div>'+
    '<h2>Stunts &amp; Relics</h2><div class="activity-row"><div><strong>Stunt Ramps</strong><span>'+sim.career.stunts.length+' / '+RAMPS.length+' LANDED</span></div>'+
    button('Pin next','pin-ramp',false,sim.career.stunts.length===RAMPS.length)+'</div>'+
    '<div class="activity-row"><div><strong>Reef Relics</strong><span>'+sim.career.relics.length+' / '+RELICS.length+' FOUND</span></div>'+
    button('Pin next','pin-relic',false,sim.career.relics.length===RELICS.length)+'</div></section>';
}

export function createSafehouseMenu(sim,releasePreview){
  const overlay=document.getElementById('overlay');
  let renderedMode='',tab='pause',selected=0,chart=null,atlasModel=null,activeSlot=null,startPin=null,pendingSave=null;
  seedDossiers();
  sim.saveCheckpoint=()=>{if(activeSlot!==null)writeSlot(slots[activeSlot],snapshot(sim));};
  sim.openHub=page=>setMode('hub',page);

  function mapPanel(compact=false){
    return '<section class="chart '+(compact?'preview-chart':'')+'"><header><h2>District Atlas</h2><span>CLICK MAP TO PIN GPS</span></header>'+
      '<canvas id="city-map" aria-label="Map of all six Solaris Keys districts"></canvas>'+
      '<footer><b>H</b> Safehouse <b>R</b> Respray <b>A</b> Armory <b>G</b> Boathouse</footer></section>';
  }

  function startScreen(data){
    const latest=data.filter(Boolean).sort((a,b)=>(b.savedAt??0)-(a.savedAt??0))[0];
    const career=latest?.career??sim.career,control=latest?.control??sim.stats.control;
    const m=latest?{...sim.missions,index:latest.index,stage:latest.stage??0,waypoint:startPin??latest.waypoint,alternate:null}:sim.missions;
    const goal=CAMPAIGN[m.index]?.stages[m.stage]?.slice(2,4);
    atlasModel={...sim,stats:{...sim.stats,control},missions:m,focus:()=>latest?{x:latest.position[0],z:latest.position[2]}:sim.focus()};
    if(tab!=='atlas')selected=Math.min(m.index,CAMPAIGN.length-1);
    if(goal)atlasModel.gpsTarget={x:goal[0],z:goal[1]};
    const menu=[['Continue','continue'],['New Game','new'],['Load Game','title-load'],['Operations Atlas','title-atlas'],['Settings','title-settings']];
    return '<div class="start-layout"><section class="start-main"><header class="wordmark"><p>COASTAL CRIME SANDBOX</p><h1>SOLARIS <em>KEYS</em></h1>'+
      '<div>ORIGINAL OPEN-WORLD CRIME <i></i> 6 DISTRICTS <i></i> 8 OPERATIONS <i></i> KEYBOARD &amp; MOUSE</div></header>'+
      '<nav class="start-nav" aria-label="Main menu">'+menu.map(([label,action],i)=>button(label,action,i===0,i===0&&!latest)).join('')+'</nav>'+
      (tab==='settings'?settings():careerCard(career,control))+'</section>'+
      '<aside class="start-aside">'+(tab==='atlas'?storyPanel(career,m,true):mapPanel(true))+
      '<section id="title-saves" class="start-saves'+(tab==='save'?' highlighted':'')+'"><header><h2>Local Save Slots</h2><span>ON THIS DEVICE</span></header>'+
      '<div class="slot-grid">'+saveCards(data,false)+'</div></section></aside></div>';
  }

  function settings(){
    const radio=sim.audio.radio;
    return '<section class="panel settings-card"><h2>Settings</h2><label>Master volume <input id="master-volume" type="range" min="0" max="100" value="'+Math.round(radio.volume*100)+'"></label>'+
      '<label><input id="master-mute" type="checkbox" '+(radio.muted?'checked':'')+'> Mute audio</label>'+controlSheet()+'</section>';
  }

  function storyPanel(career,m,preview=false){
    const op=CAMPAIGN[selected]??CAMPAIGN[Math.min(m.index,CAMPAIGN.length-1)];
    const count=career.medals.filter(Boolean).length;
    const rows=CAMPAIGN.map((mission,i)=>'<button type="button" class="mission-item'+(CAMPAIGN[selected]===mission?' active':'')+'" data-action="select-'+i+'"><b>'+
      String(i+1).padStart(2,'0')+'</b><strong>'+mission.name+'</strong><span>'+((m.index===i?'ACTIVE':career.medals[i])??'QUEUED')+'</span></button>').join('');
    const detail=op.stages[0][4];
    return '<section class="panel hub-sidebar story-card"><div class="eyebrow"><h2>Eight Operations</h2><b>'+count+' / '+CAMPAIGN.length+' COMPLETE</b></div>'+
      '<div class="mission-list">'+rows+'</div><div class="mission-detail"><b>'+op.crew+' · '+DISTRICTS[op.district].name+' · $'+op.reward.toLocaleString('en-US')+
      '</b>'+detail+'</div>'+(!preview&&selected!==m.index&&career.medals[selected]?button('Replay Operation','replay'): '')+'</section>';
  }

  function hubContent(data){
    const m=sim.missions;
    if(tab==='atlas'){atlasModel=sim;return '<div class="atlas-layout">'+mapPanel()+activityList(sim)+'</div>';}
    if(tab==='story')return storyPanel(sim.career,m);
    if(tab==='career')return careerCard(sim.career,sim.stats.control,true);
    if(tab==='save')return '<div class="save-tab"><div class="slot-grid">'+saveCards(data,true)+'</div>'+
      (pendingSave===null?'':'<div class="confirm-save"><strong>Replace saved progress in Slot '+(pendingSave+1)+'?</strong>'+
      button('Replace save','confirm-save',true)+button('Cancel','cancel-save')+'</div>')+'</div>';
    if(tab==='crew')return '<div class="crew-grid">'+Object.entries(CREW).map(([name,member])=>'<article class="panel crew-profile">'+portrait(name)+'<div><h2>'+name+'</h2><p>'+
      member.job+' · '+(sim.career.crew.includes(name)?'RECRUITED':'CONTACT')+'</p><b>['+member.key+'] '+member.ability+'</b></div></article>').join('')+
      '<p class="hub-note">On foot, Z calls Mira to take cover and engage nearby hostiles.</p></div>';
    if(tab==='garage'){
      const v=sim.player.vehicle;
      return '<section class="panel garage-card"><h2>'+ (v?.spec.name??'On foot')+'</h2><p>'+(v?'Hull '+Math.round(v.hull)+'% · '+(v.parts.water?'Marine':v.parts.mainRotor?'Aviation':'Road'):'Board a vehicle to view its condition.')+
        '</p><p>Paloma Respray · Barrio Palma · $250</p><p>Keys Supply · Coral Strand · $180</p><p>Miramar Launch · Public dock</p>'+
        button('Pin Respray Shop','pin-garage')+' '+button('Pin Boathouse','pin-boat')+'</section>';
    }
    return '<div class="pause-layout"><section class="panel pause-card"><h2>Operation paused</h2><p>'+ (currentObjective(sim)?.label??'Explore the Keys at your own pace.')+'</p>'+
      button('Resume','play',true)+button('Main Menu','title')+'</section>'+settings()+'</div>';
  }

  function refreshChart(){
    if(chart)renderCityChart(chart,atlasModel,selected);
  }

  function render(){
    if(sim.mode===renderedMode)return;
    renderedMode=sim.mode;chart=null;atlasModel=null;
    overlay.hidden=sim.mode==='play';
    overlay.className=sim.mode+'-mode';
    if(overlay.hidden)return;
    const data=slots.map(readSlot);
    if(sim.mode==='start')overlay.innerHTML=startScreen(data);
    else if(sim.mode==='down')overlay.innerHTML='<div class="hub"><section class="panel pause-card"><h1>Operation Down</h1><p>Return to Palma to continue the current operation.</p>'+
      button('Return to Palma','play',true)+button('Load Save','tab-save')+'</section></div>';
    else overlay.innerHTML='<div class="hub"><header class="hub-header panel"><div><span class="brand">SOLARIS KEYS</span><h1>'+tab.toUpperCase()+'</h1></div>'+
      button('Resume Game','play',true)+'</header><nav aria-label="Safehouse tabs" class="hub-tabs">'+tabs.map(name=>
        '<button type="button" data-action="tab-'+name.toLowerCase()+'" aria-pressed="'+(tab===name.toLowerCase())+'">'+name+'</button>').join('')+
      '</nav><div class="hub-body">'+hubContent(data)+'</div></div>';
    chart=overlay.querySelector('#city-map');
    if(chart){
      refreshChart();
      chart.addEventListener('click',event=>{
        const r=chart.getBoundingClientRect(),p=chart.worldAt(event.clientX-r.left,event.clientY-r.top);
        const pin=isGround(p.x,p.z)||canSail(p.x,p.z)?p:null;
        if(sim.mode==='start')startPin=pin;
        atlasModel.missions.waypoint=pin;
        if(sim.mode!=='start')sim.notice(pin?'WAYPOINT PINNED':'WAYPOINT CLEARED');
        refreshChart();
      });
    }
  }

  function setMode(mode,page='pause'){
    sim.mode=mode;tab=page;pendingSave=null;
    if(mode==='play'){releasePreview();overlay.hidden=true;document.activeElement?.blur();}
    if(mode==='hub')selected=Math.min(sim.missions.index,CAMPAIGN.length-1);
    renderedMode='';render();
    if(mode!=='play')overlay.querySelector('.primary:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true});
  }

  function load(i){
    if(!restore(sim,readSlot(slots[i])))return;
    activeSlot=i;
    if(sim.mode==='start'&&startPin)sim.missions.waypoint=startPin;
    startPin=null;sim.notice('SLOT '+(i+1)+' LOADED');setMode('play');
  }

  function write(i){
    const ok=writeSlot(slots[i],snapshot(sim));
    pendingSave=null;
    const error=document.getElementById('error');
    if(ok){activeSlot=i;sim.notice('SAVED TO SLOT '+(i+1));}
    else{error.textContent='LocalStorage unavailable. Save could not be written.';error.hidden=false;setTimeout(()=>error.hidden=true,2800);}
  }

  overlay.addEventListener('input',event=>{
    if(event.target.id==='master-volume')sim.audio.radio.volume=Number(event.target.value)/100;
    if(event.target.id==='master-mute')sim.audio.radio.muted=event.target.checked;
  });
  overlay.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const items=[...overlay.querySelectorAll('button:not(:disabled),input')];
    const edge=event.shiftKey?items[0]:items.at(-1);
    if(document.activeElement===edge){
      event.preventDefault();
      (event.shiftKey?items.at(-1):items[0])?.focus();
    }
  });
  overlay.addEventListener('click',event=>{
    const action=event.target.closest('button')?.dataset.action;
    if(!action)return;
    sim.audio.unlock();
    if(action==='continue'){
      const i=slots.map((slot,i)=>[i,readSlot(slot)]).filter(([,st])=>st).sort((a,b)=>(b[1].savedAt??0)-(a[1].savedAt??0))[0]?.[0];
      if(i!==undefined)load(i);
      return;
    }
    if(action==='new'){
      activeSlot=null;
      restore(sim,{version:2,money:450,rp:0,control:DISTRICTS.map(()=>0),career:emptyCareer(),position:[HOME.x-1,0,HOME.z+5],index:0});
      if(startPin)sim.missions.waypoint=startPin;
      startPin=null;sim.speak('Vega','Welcome back, Mateo. I’m outside the safehouse. Walk over and hit E.');setMode('play');return;
    }
    if(action==='play'){if(sim.mode==='down')sim.respawn();setMode('play');return;}
    if(action==='title'){sim.frameTitle();setMode('start');return;}
    if(action.startsWith('title-'))tab=action==='title-load'?'save':action.slice(6);
    if(action.startsWith('tab-')){
      if(sim.mode==='down'){setMode('hub',action.slice(4));return;}
      tab=action.slice(4);pendingSave=null;
    }
    if(action.startsWith('select-'))selected=Number(action.slice(7));
    if(action.startsWith('load-')){load(Number(action.slice(5)));return;}
    if(action.startsWith('save-')){
      const i=Number(action.slice(5));
      if(readSlot(slots[i]))pendingSave=i;
      else write(i);
    }
    if(action==='confirm-save'&&pendingSave!==null)write(pendingSave);
    if(action==='cancel-save')pendingSave=null;
    if(action==='drop'||action.startsWith('race-')){
      startActivity(sim,action==='drop'?'drop':'race',Number(action.slice(5)));setMode('play');return;
    }
    if(action.startsWith('pin-')){
      const point=action==='pin-ramp'?RAMPS.find((_,i)=>!sim.career.stunts.includes(i)):
        action==='pin-relic'?RELICS.find((_,i)=>!sim.career.relics.includes(i)):action==='pin-boat'?[BOATHOUSE.x,BOATHOUSE.z]:[-205,196];
      if(point)sim.missions.waypoint={x:point[0],z:point[1]};
      setMode('hub','atlas');return;
    }
    if(action==='replay'&&sim.career.medals[selected]){
      for(const guard of sim.syndicate)sim.scene.remove(guard.group);
      sim.syndicate.length=0;
      Object.assign(sim.missions,{index:selected,stage:0,damage:0,elapsed:0,alternate:null});
      setMode('play');return;
    }
    renderedMode='';render();
    const nextFocus=pendingSave!==null?'confirm-save':action==='title-load'?'load-0':action;
    overlay.querySelector('[data-action="'+nextFocus+'"]')?.focus({preventScroll:true});
  });
  window.addEventListener('resize',refreshChart);
  return {render,setMode,toggleAtlas:()=>setMode(sim.mode==='hub'&&tab==='atlas'?'play':'hub','atlas')};
}
