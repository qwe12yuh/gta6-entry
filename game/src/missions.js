import * as THREE from 'three';
import { ARMORY, CAMPAIGN, GARAGE, clamp } from './config.js';
import { clearWanted, raiseWanted } from './police.js';
import { resprayVehicle } from './vehicles.js';

const RACE=[
  [58,202], [65,108], [58,20], [-38,20], [-128,20], [-128,108], [-38,108], [-38,196],
];
const DROPS=[
  [435,-244], [234,-68], [-216,196],
];

export function createMissionDirector(sim){
  const marker=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.7,.10,6,44),new THREE.MeshBasicMaterial({color:0xffd67f,toneMapped:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.13;
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(.58),new THREE.MeshBasicMaterial({color:0xffd96c,toneMapped:false}));
  core.position.y=2.54;core.scale.set(1,1.45,1);
  const column=new THREE.Mesh(new THREE.CylinderGeometry(.06,1.23,5.6,24,1,true),new THREE.MeshBasicMaterial({
    color:0xffca57,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false,
  }));
  column.position.y=2.85;
  marker.add(ring,core,column);sim.scene.add(marker);
  const pin=new THREE.Mesh(new THREE.OctahedronGeometry(.63),new THREE.MeshBasicMaterial({color:0x8bfaf1,toneMapped:false}));
  pin.visible=false;sim.scene.add(pin);
  const parcel=new THREE.Mesh(new THREE.BoxGeometry(1.0,.54,.77),new THREE.MeshStandardMaterial({color:0xa87946,roughness:.9}));
  parcel.position.y=.30;
  const relay=new THREE.Mesh(new THREE.BoxGeometry(.62,1.28,.52),new THREE.MeshStandardMaterial({color:0x9a629a,emissive:0xab64dd,emissiveIntensity:.47,metalness:.5,roughness:.45}));
  relay.position.y=.66;
  marker.add(parcel,relay);
  return {index:0,stage:0,completed:0,hits:0,alternate:null,marker,core,waypoint:null,pin,parcel,relay};
}

export function currentObjective(sim){
  const m=sim.missions;
  if(m.alternate){
    const a=m.alternate;
    const points=a.kind==='race'?RACE:DROPS;
    const target=points[a.step];
    if(!target)return null;
    return {title:a.kind==='race'?'Oceanlight Sprint':'Dead Drop Circuit',stage:a.step,total:points.length,action:'visit',label:a.kind==='race'?'Reach the next checkpoint':'Collect the marked drop',x:target[0],z:target[1]};
  }
  const mission=CAMPAIGN[m.index];
  if(!mission)return m.waypoint?{...m.waypoint,title:'Custom Waypoint',stage:0,total:1,label:'Follow your map pin'}:null;
  const [action,label,x,z]=mission.stages[m.stage];
  return {title:mission.name,stage:m.stage,total:mission.stages.length,action,label,x,z,crew:mission.crew};
}

export function startActivity(sim,kind){
  sim.missions.alternate={kind,step:0,time:kind==='race'?100:180};
  sim.speak(kind==='race'?'Vega':'Tariq',kind==='race'?'Eight checkpoints. Bring a car. Keep your foot down.':'Three harbor drops. Use the map and collect each package.');
}

function stepCampaign(sim){
  const m=sim.missions;
  const mission=CAMPAIGN[m.index];
  const stage=mission.stages[m.stage];
  sim.speak(mission.crew,stage[4]);
  if(stage[0]==='disable')raiseWanted(sim,3);
  if((m.index===3&&m.stage===1)||(m.index===5&&m.stage===1))raiseWanted(sim,5);
  if(m.index===3&&stage[0]==='escape'){clearWanted(sim);sim.notice('CORDON BROKEN');}
  m.stage++;
  if(m.stage>=mission.stages.length){
    m.completed=Math.max(m.completed,m.index+1);
    sim.stats.money+=mission.reward;
    sim.stats.rp+=200+mission.district*49;
    sim.stats.control[mission.district]=clamp(sim.stats.control[mission.district]+38,0,100);
    sim.notice('OPERATION COMPLETE  /  +$'+mission.reward.toLocaleString('en-US'));
    sim.audio.effect('pickup');
    m.index++;m.stage=0;
    sim.saveCheckpoint?.();
    if(m.index===CAMPAIGN.length)sim.speak('Tariq','All six operations are clean. The harbor is ours again.');
  }
}

function nearbyService(sim){
  const p=sim.focus();
  const d=(site)=>Math.hypot(p.x-site.x,p.z-site.z,p.y);
  if(d(GARAGE)<12&&sim.player.vehicle&&!sim.player.vehicle.parts.mainRotor)return 'garage';
  if(d(ARMORY)<9&&!sim.player.vehicle)return 'armory';
  return null;
}

export function interactionPrompt(sim){
  const target=currentObjective(sim),p=sim.focus();
  const site=nearbyService(sim);
  if(site==='garage')return '[ E ]  PALOMA RESPRAY  /  $250';
  if(site==='armory')return '[ E ]  RESTOCK & ARMOR  /  $180';
  if(target&&Math.hypot(p.x-target.x,p.z-target.z,p.y)<10&&['meet','collect','disable'].includes(target.action)){
    return '[ E ]  '+({meet:'MEET CONTACT',collect:'COLLECT PACKAGE',disable:'DISABLE RELAY'})[target.action];
  }
  if(sim.player.vehicle)return sim.player.vehicle.pos.y>3.2?'LAND TO EXIT':'[ F ]  EXIT VEHICLE';
  const car=sim.nearestVehicle?.();
  return car?'[ F ]  ENTER  '+car.spec.name.toUpperCase():'[ M ]  OPEN CITY MAP';
}

export function updateMissionDirector(sim,dt,interact){
  const m=sim.missions;
  const target=currentObjective(sim),p=sim.focus(),own=sim.player.vehicle;
  m.pin.visible=Boolean(m.waypoint);
  if(m.waypoint){
    m.pin.position.set(m.waypoint.x,2.2+Math.sin(sim.time*3)*.24,m.waypoint.z);
    m.pin.rotation.y=sim.time*1.7;
    if(Math.hypot(p.x-m.waypoint.x,p.z-m.waypoint.z)<5&&p.y<6){m.waypoint=null;m.pin.visible=false;sim.notice('WAYPOINT REACHED');}
  }
  m.marker.visible=Boolean(target);
  m.parcel.visible=target?.action==='collect'||m.alternate?.kind==='drop';
  m.relay.visible=target?.action==='disable';
  if(target){
    const {x,z,action}=target;
    m.marker.position.set(x,action==='flyby'?30:0,z);
    m.core.rotation.y=sim.time*1.7;
    m.core.position.y=2.5+Math.sin(sim.time*3)*.33;
    const distance=Math.hypot(p.x-x,p.z-z);
    const alt=p.y;
    if(m.alternate){
      const a=m.alternate;
      a.time-=dt;
      if(a.time<=0){m.alternate=null;sim.notice('ACTIVITY EXPIRED');return;}
      if(distance<13&&alt<5&&(a.kind==='race'?own:interact)){
        a.step++;sim.audio.effect('pickup');
        const total=a.kind==='race'?RACE.length:DROPS.length;
        if(a.step===total){
          const cash=a.kind==='race'?1650:2100;
          sim.stats.money+=cash;sim.stats.rp+=260;
          const dist=a.kind==='race'?0:3;
          sim.stats.control[dist]=clamp(sim.stats.control[dist]+20,0,100);
          sim.notice('ACTIVITY COMPLETE  /  +$'+cash.toLocaleString('en-US'));m.alternate=null;
        }
        return;
      }
    }else if(m.index<CAMPAIGN.length){
      const near=distance<10&&alt<6;
      const achieved=
        action==='drive'?own?.type==='apex':
        action==='fly'?own?.type==='heli'&&alt>13:
        action==='flyby'?distance<38&&alt>18&&own?.type==='heli':
        action==='escape'?distance<26&&Boolean(own)&&alt<12:
        action==='evade'?sim.police.stars===0:
        action==='visit'?distance<16&&alt<10&&(m.index!==0||own?.type==='apex'):
        near&&interact;
      if(achieved){stepCampaign(sim);return;}
    }
  }
  if(!interact)return;
  const site=nearbyService(sim);
  if(site==='garage'){
    if(sim.stats.money<250){sim.notice('NEED $250 FOR RESPRAY');return;}
    sim.stats.money-=250;
    own.hull=100;own.nitro=100;
    resprayVehicle(own);
    clearWanted(sim);
    sim.notice('PALOMA RESPRAY  /  HEAT CLEARED');
    sim.audio.effect('pickup');
  }
  if(site==='armory'){
    if(sim.stats.money<180){sim.notice('NEED $180 FOR SUPPLIES');return;}
    sim.stats.money-=180;
    for(let i=2;i<sim.combat.reserve.length;i++)sim.combat.reserve[i]+=30;
    sim.player.armor=100;
    sim.notice('ARMOR & AMMUNITION RESTOCKED');
    sim.audio.effect('pickup');
  }
}
