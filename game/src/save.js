import { CAMPAIGN, DISTRICTS, HOME, VEHICLES, WEAPONS, clamp, districtAt, isGround } from './config.js';
import { openVehicle } from './engine.js';
import { currentObjective, startActivity } from './missions.js';
import { renderCityChart } from './hud.js';
import { clearWanted, raiseWanted } from './police.js';
import { resprayVehicle } from './vehicles.js';

const PREFIX='solaris-keys.v1.';
const slots=['autosave','slot-1','slot-2'];
const names=['Checkpoint','Manual 01','Manual 02'];

function readSlot(slot) {
  try {
    const data=JSON.parse(localStorage.getItem(PREFIX+slot));
    if(data?.version!==1||!Number.isFinite(data.money)||!Array.isArray(data.position)||data.position.length!==3||!data.position.every(Number.isFinite))return null;
    return data;
  } catch {
    return null;
  }
}

function storeSlot(sim,slot){
  const p=sim.focus(), own=sim.player.vehicle,m=sim.missions;
  const state={
    version:1, savedAt:Date.now(), money:sim.stats.money, rp:sim.stats.rp, control:sim.stats.control.slice(),
    index:m.index, stage:m.stage, completed:m.completed, clock:sim.clock,
    position:p.toArray(), yaw:own?.yaw??sim.player.yaw, health:sim.player.health, armor:sim.player.armor,
    vehicle:own?.type??null, hull:own?.hull??100, nitro:own?.nitro??100, paint:own?.paint??0, station:sim.audio.radio.station,
    weapon:sim.combat.weapon, ammo:sim.combat.ammo.slice(), reserve:sim.combat.reserve.slice(),
  };
  try{localStorage.setItem(PREFIX+slot,JSON.stringify(state));return true;}
  catch{return false;}
}

function restoreSlot(sim,slot){
  const st=readSlot(slot);
  if(!st)return false;
  const p=sim.player,m=sim.missions;
  if(p.vehicle){p.vehicle.speed=0;p.vehicle.boost=false;}
  p.vehicle=null;
  clearWanted(sim);
  const [x,y,z]=st.position;
  const yaw=Number.isFinite(st.yaw)?st.yaw:0;
  const ground=isGround(x,z)&&sim.world.canMove(x,z,0,.5);
  p.person.group.position.set(ground?x:HOME.x,0,ground?z:HOME.z+3);
  p.person.group.visible=true;
  p.yaw=yaw;p.pitch=0;p.orbit=0;
  if(st.vehicle&&Object.hasOwn(VEHICLES,st.vehicle)&&sim.world.canMove(x,z,clamp(y,0,230),.75)){
    const reusable=sim.vehicles.find(v=>v.type===st.vehicle&&Math.hypot(v.pos.x-x,v.pos.z-z,v.pos.y-y)<4);
    if(reusable){
      reusable.pos.set(x,clamp(y,0,230),z);reusable.yaw=yaw;sim.takeVehicle(reusable);
    }else openVehicle(sim,st.vehicle,x,z,yaw,clamp(y,0,230));
    p.vehicle.hull=clamp(st.hull||100,1,100);
    p.vehicle.nitro=clamp(st.nitro??100,0,100);
    p.vehicle.speed=0;p.vehicle.vertical=0;p.vehicle.boost=false;
    if(Number.isSafeInteger(st.paint)&&st.paint>0)resprayVehicle(p.vehicle,st.paint);
  }
  p.health=clamp(st.health||100,1,100);p.armor=clamp(st.armor??50,0,100);
  sim.stats.money=Math.max(0,Math.floor(st.money));sim.stats.rp=Math.max(0,Math.floor(st.rp||0));
  if(st.control?.length===6)sim.stats.control=st.control.map(n=>clamp(Number(n)||0,0,100));
  m.index=clamp(Math.floor(st.index||0),0,CAMPAIGN.length);
  m.stage=clamp(Math.floor(st.stage||0),0,(CAMPAIGN[m.index]?.stages.length??1)-1);
  m.completed=clamp(Math.floor(st.completed||0),0,CAMPAIGN.length);
  m.alternate=null;m.waypoint=null;
  if(CAMPAIGN[m.index]?.stages[m.stage][0]==='evade')raiseWanted(sim,m.index===5?5:3);
  sim.clock=clamp(st.clock||16.6,0,23.99);
  sim.audio.radio.station=clamp(Math.floor(st.station??1),0,3);
  sim.combat.ammo=WEAPONS.map((w,i)=>clamp(Math.floor(st.ammo?.[i]??w.capacity),0,w.capacity));
  sim.combat.reserve=WEAPONS.map((_,i)=>Math.max(0,Math.floor(st.reserve?.[i]||0)));
  sim.combat.select(clamp(Math.floor(st.weapon??2),0,6));
  sim.cameraCut=true;sim.mode='play';sim.hitUntil=0;
  return true;
}

const controls=[
  ['WASD','Walk / steer / throttle'],['MOUSE','Drag to look'],
  ['F','Enter or exit a vehicle'],['E','Interact / objective'],
  ['SHIFT','Sprint / vehicle nitro'],['SPACE','Handbrake / helicopter lift'],
  ['CTRL','Helicopter descent'],['LMB','Attack / drive-by fire'],
  ['1–7','Weapons'],['R','Reload'],
  ['M','Map / saves / activities'],['V','Cycle four cameras'],
  ['T','Change daylight'],['Q','Tune synth radio'],
];
function controlSheet(){
  return '<section class="panel control-sheet"><h2>FIELD CONTROLS</h2><div class="control-grid">'+
    controls.map(([key,label])=>'<div><kbd>'+key+'</kbd>'+label+'</div>').join('')+'</div></section>';
}
function button(label,action,primary=false,disabled=false){
  return '<button type="button" class="action-button'+(primary?' primary':'')+'" data-action="'+action+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
}

export function createSafehouseMenu(sim,releasePreview){
  const overlay=document.getElementById('overlay');
  let renderedMode='', selected=null, chart=null;
  const screenError=document.getElementById('error');
  sim.saveCheckpoint=()=>storeSlot(sim,'autosave');

  function renderTitle(){
    chart=null;
    const mode=sim.mode,start=mode==='start',down=mode==='down';
    const canLoad=slots.some(slot=>readSlot(slot));
    const label=start?'SOLARIS<br><em>KEYS</em>':down?'OPERATION<br><em>DOWN</em>':'GAME<br><em>PAUSED</em>';
    const description=start?'Mateo Silva has three allies and one night to take back the harbor. Take the wheel, cross the bay, and clear the city’s six operations.':
      down?'Return to the Palma safehouse. Your current operation stays active.':'Open the city chart to set a waypoint, checkpoint or switch to a side activity.';
    const primary=button(start?'Enter Solaris Keys':down?'Return to Palma':'Resume','play',true);
    const secondary=start?button('Continue save','continue',false,!canLoad):button('Map & safehouse','map');
    overlay.innerHTML='<div class="title-card"><div class="eyebrow"><i class="title-emblem"></i> MATEO SILVA  /  SOLARIS COAST</div>'+
      '<h1>'+label+'</h1><p>'+description+'</p><div class="menu-buttons">'+primary+secondary+'</div>'+controlSheet()+'</div>';
  }

  function renderHub(){
    const m=sim.missions;
    selected??=Math.min(m.index,CAMPAIGN.length-1);
    const marked=CAMPAIGN[selected];
    const rows=CAMPAIGN.map((mission,i)=>{
      const status=i<m.completed?'CLEARED':i===m.index?'IN PROGRESS':'QUEUED';
      return '<button type="button" class="mission-item'+(i===selected?' active':'')+'" data-action="select-'+i+'"><b>'+
        String(i+1).padStart(2,'0')+'</b><strong>'+mission.name+'</strong><span>'+status+'</span></button>';
    }).join('');
    const target=currentObjective(sim);
    const detail=selected===m.index&&target?target.label:DISTRICTS[marked.district].description;
    const footer=slots.map((slot,i)=>{
      const st=readSlot(slot);
      const subtitle=st?DISTRICTS[districtAt(st.position[0],st.position[2])].name+' / OP '+Math.min(6,(st.index||0)+1) :'Empty';
      return '<div class="save-slot"><div class="save-caption"><b>'+names[i]+'</b><span>'+subtitle+'</span></div><div class="save-actions">'+
        button(i===0?'Checkpoint':'Save','save-'+i)+button('Load','load-'+i,false,!st)+'</div></div>';
    }).join('');
    overlay.innerHTML='<div class="hub"><header class="hub-header panel"><div><span class="brand">SOLARIS KEYS</span>'+
      '<h1>City chart &amp; operations</h1></div>'+button('M  /  Back to city','play',true)+'</header>'+
      '<div class="hub-content"><section class="chart"><canvas id="city-map" aria-label="Interactive map of the six districts"></canvas>'+
      '<div class="map-caption"><b>◆</b> Objective &nbsp; <b>H</b> Safehouse &nbsp; <b>R</b> Respray &nbsp; <b>A</b> Armory &nbsp; · &nbsp; Click to pin</div></section>'+
      '<aside class="hub-sidebar"><div class="eyebrow"><span>STORY CAMPAIGN</span><span>'+m.completed+' / 6 COMPLETE</span></div><h2>Six Operations</h2>'+
      '<div class="mission-list">'+rows+'</div><div class="mission-detail"><b>'+marked.crew.toUpperCase()+'  /  $'+marked.reward.toLocaleString('en-US')+
      '</b>'+detail+'</div><div class="side-activities">'+button('Street race','race')+button('Contraband','drop')+'</div></aside></div>'+
      '<footer class="hub-footer"><div class="safehouse"><h2>Safehouse</h2><p>On-device save slots</p></div>'+footer+'</footer></div>';
    chart=document.getElementById('city-map');
    renderCityChart(chart,sim,selected);
    chart.addEventListener('click',event=>{
      const rect=chart.getBoundingClientRect();
      const p=chart.worldAt(event.clientX-rect.left,event.clientY-rect.top);
      if(isGround(p.x,p.z)){
        sim.missions.waypoint=p;
        sim.notice('WAYPOINT PINNED  /  '+DISTRICTS[districtAt(p.x,p.z)].name.toUpperCase());
      }else{
        sim.missions.waypoint=null;
        sim.notice('WAYPOINT CLEARED');
      }
      renderCityChart(chart,sim,selected);
    });
  }

  function setMode(mode){
    if(mode==='play')releasePreview();
    if(mode==='map')selected=null;
    if(mode!=='play'&&document.pointerLockElement)document.exitPointerLock();
    sim.mode=mode;
    render();
  }

  function render(){
    if(renderedMode===sim.mode)return;
    renderedMode=sim.mode;
    overlay.hidden=sim.mode==='play';
    overlay.classList.toggle('map-mode',sim.mode==='map');
    if(sim.mode==='map')renderHub();
    else if(sim.mode!=='play')renderTitle();
  }

  overlay.addEventListener('click',event=>{
    const action=event.target.closest('button')?.dataset.action;
    if(!action)return;
    sim.audio.unlock();
    if(action==='play'){
      if(sim.mode==='down')sim.respawn();
      if(sim.mode==='start')sim.speak('Vega','Welcome back, Mateo. I’m outside the safehouse. Walk over and hit E.');
      setMode('play');
    }else if(action==='map')setMode('map');
    else if(action==='continue'){
      const latest=slots.map(slot=>({slot,data:readSlot(slot)})).filter(item=>item.data)
        .sort((a,b)=>(b.data.savedAt??0)-(a.data.savedAt??0))[0];
      if(latest&&restoreSlot(sim,latest.slot))setMode('play');
    }else if(action.startsWith('select-')){
      selected=Number(action.slice(7));renderHub();
    }else if(action.startsWith('save-')){
      if(storeSlot(sim,slots[Number(action.slice(5))]))renderHub();
      else { screenError.textContent='Browser storage is unavailable. No save was written.';screenError.hidden=false;setTimeout(()=>screenError.hidden=true,2200); }
    }else if(action.startsWith('load-')){
      if(restoreSlot(sim,slots[Number(action.slice(5))])){sim.notice('SAVE RESTORED');setMode('play');}
    }else if(action==='race'||action==='drop'){
      startActivity(sim,action);setMode('play');
    }
  });
  window.addEventListener('resize',()=>{if(chart&&sim.mode==='map')renderCityChart(chart,sim,selected);});
  return {render,setMode};
}
