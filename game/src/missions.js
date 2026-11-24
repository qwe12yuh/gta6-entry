import * as THREE from 'three';
import { ARMORY, BOATHOUSE, CAMPAIGN, COVER, CREW, DISTRICTS, GARAGE, HOME, clamp } from './config.js';
import { createWalker } from './pedestrians.js';
import { clearWanted, raiseWanted } from './police.js';
import { resprayVehicle } from './vehicles.js';

export const RACES=[
  {name:'Oceanlight Sprint',district:0,limit:82,points:[[58,202],[63,108],[58,20],[58,-68],[-38,-68],[-38,20],[58,20]]},
  {name:'Vela Switchback',district:1,limit:88,points:[[-128,20],[-128,-68],[-128,-156],[-216,-156],[-216,-244],[-128,-244],[-128,-332]]},
  {name:'Palma Circuit',district:2,limit:95,points:[[-216,196],[-302,196],[-302,284],[-216,284],[-128,284],[-128,196],[-216,196]]},
  {name:'Calypso Crossing',district:5,limit:112,points:[[-38,-244],[58,-244],[178,-244],[280,-244],[384,-244],[460,-244],[511,-244]]},
];
export const DROPS=[[435,-244],[234,-68],[-216,196],[-298,112],[70,286],[-130,-247]];
export const RAMPS=[
  [64,160,0],[64,42,0],[52,-207,Math.PI],[-43,142,0],[-133,250,0],
  [-221,62,0],[-297,-204,Math.PI],[-69,-249,Math.PI/2],[169,-249,Math.PI/2],[317,-63,Math.PI/2],
];
export const RELICS=[
  [106,152],[122,230],[124,315],[112,52],[118,-106],[115,-199],[107,-314],[92,-365],
  [159,-82],[206,-58],[285,-82],[325,-56],[181,-251],[318,-237],[388,-258],[521,-276],
  [-203,201],[-294,287],[-118,-72],[-43,-329],
];

const weights=[24,15,8,12,10,12,12,7];
const limits=[CAMPAIGN.length,RACES.length,RAMPS.length,RELICS.length,DROPS.length,DISTRICTS.length,Object.keys(CREW).length,CAMPAIGN.length];
export const emptyCareer=()=>({medals:Array(CAMPAIGN.length).fill(null),races:[],stunts:[],relics:[],drops:[],crew:[]});

export function careerSummary(career,control){
  const counts=[career.medals.filter(Boolean).length,career.races.length,career.stunts.length,career.relics.length,
    career.drops.length,control.filter(n=>n>=38).length,career.crew.length,career.medals.filter(m=>m==='Gold').length];
  return {counts,limits,percent:counts.reduce((sum,n,i)=>sum+n/limits[i]*weights[i],0).toFixed(1)};
}

export function registerStunt(sim,id){
  if(sim.career.stunts.includes(id))return;
  sim.career.stunts.push(id);sim.stats.rp+=85;
  sim.audio.effect('pickup');sim.notice('STUNT LANDING  /  '+sim.career.stunts.length+' OF '+RAMPS.length);
}

export function createMissionDirector(sim){
  const marker=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.7,.10,6,44),new THREE.MeshBasicMaterial({color:0xffd67f,toneMapped:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.13;
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(.58),new THREE.MeshBasicMaterial({color:0xffd96c,toneMapped:false}));
  const gate=new THREE.Group();
  for(const [radius,color,thickness] of [[12,0x7fffe9,.26],[12.75,0x45c7db,.08],[11.51,0xffd98b,.08]]){
    gate.add(new THREE.Mesh(new THREE.TorusGeometry(radius,thickness,8,72),new THREE.MeshBasicMaterial({color,toneMapped:false})));
  }
  const parcel=new THREE.Mesh(new THREE.BoxGeometry(1,.54,.77),new THREE.MeshStandardMaterial({color:0xa87946,roughness:.9}));
  parcel.position.y=.30;
  const relay=new THREE.Mesh(new THREE.BoxGeometry(.62,1.28,.52),new THREE.MeshStandardMaterial({color:0x9a629a,emissive:0xab64dd,emissiveIntensity:.47}));
  relay.position.y=.66;
  marker.add(ring,core,parcel,relay,gate);sim.scene.add(marker);
  const mineral=new THREE.IcosahedronGeometry(.37,0);
  const pearl=new THREE.MeshStandardMaterial({color:0x59d8bb,emissive:0x56f5bf,emissiveIntensity:.7,flatShading:true});
  const relics=RELICS.map(([x,z])=>{
    const mesh=new THREE.Mesh(mineral,pearl);mesh.position.set(x,.75,z);sim.scene.add(mesh);return mesh;
  });
  return {index:0,stage:0,hits:0,elapsed:0,damage:0,alternate:null,waypoint:null,marker,ring,core,gate,parcel,relay,relics};
}

export function currentObjective(sim){
  const m=sim.missions,a=m.alternate;
  if(a){
    const race=a.kind==='race'?RACES[a.id]:null;
    const points=race?.points??DROPS;
    const [x,z]=points[a.step];
    return {title:race?.name??'Dead Drop Circuit',stage:a.step,total:points.length,action:race?'race':'collect',
      label:race?(a.step?'Reach the next checkpoint':'Drive to the starting gate'):'Recover the contraband cache',x,z};
  }
  const mission=CAMPAIGN[m.index];
  if(!mission)return m.waypoint?{...m.waypoint,title:'Custom Waypoint',stage:0,total:1,label:'Follow your map pin'}:null;
  const [action,label,x,z]=mission.stages[m.stage];
  return {title:mission.name,stage:m.stage,total:mission.stages.length,action,label,x,z,crew:mission.crew};
}

export function startActivity(sim,kind,id=0){
  if(kind==='drop'){
    const step=DROPS.findIndex((_,i)=>!sim.career.drops.includes(i));
    if(step<0){sim.notice('ALL SIX DROPS RECOVERED');return;}
    sim.missions.alternate={kind,step,id};
    sim.speak('Rico','Six caches are scattered across the Keys. Follow the pin and collect each cache.');
    return;
  }
  const race=RACES[id];
  if(!race)return;
  sim.missions.alternate={kind:'race',id,step:0,time:race.limit};
  sim.speak('Mira','The clock starts at the first gate. Bring a road car and follow the checkpoints.');
}

function stepCampaign(sim){
  const m=sim.missions;
  const mission=CAMPAIGN[m.index];
  const [action,,,,line]=mission.stages[m.stage];
  sim.speak(mission.crew,line);
  if(action==='meet'&&!sim.career.crew.includes(mission.crew))sim.career.crew.push(mission.crew);
  if(action==='disable')raiseWanted(sim,3);
  if([4,7].includes(m.index)&&m.stage===1)raiseWanted(sim,5);
  if(m.index===4&&action==='escape'){clearWanted(sim);sim.notice('CORDON BROKEN');}
  m.stage++;
  if(m.stage<mission.stages.length)return;
  const medal=m.damage<=33&&m.elapsed<=mission.stages.length*50?'Gold':m.damage<=75?'Silver':'Bronze';
  const prior=sim.career.medals[m.index];
  const ranking=['Bronze','Silver','Gold'];
  if(ranking.indexOf(medal)>ranking.indexOf(prior))sim.career.medals[m.index]=medal;
  if(!prior){
    sim.stats.money+=mission.reward;
    sim.stats.rp+=200+mission.district*49;
    sim.stats.control[mission.district]=clamp(sim.stats.control[mission.district]+38,0,100);
  }
  sim.notice(medal.toUpperCase()+'  /  OPERATION COMPLETE'+(prior?'':'  /  +$'+mission.reward.toLocaleString('en-US')));
  sim.audio.effect('pickup');
  const next=sim.career.medals.findIndex((rating,i)=>i>m.index&&!rating);
  const unfinished=sim.career.medals.indexOf(null);
  m.index=next>=0?next:unfinished>=0?unfinished:CAMPAIGN.length;
  m.stage=0;m.elapsed=0;m.damage=0;
  sim.saveCheckpoint?.();
  if(m.index===CAMPAIGN.length)sim.speak('Vega','All eight operations are clear. The harbor is ours again.');
}

function nearbyCover(sim){
  if(sim.player.vehicle)return null;
  const p=sim.focus();
  return COVER.find(([x,z])=>Math.hypot(x-p.x,z-p.z)<2.6)??null;
}

function nearbyService(sim){
  const p=sim.focus(),v=sim.player.vehicle;
  const d=site=>Math.hypot(p.x-site.x,p.z-site.z,p.y);
  if(d(GARAGE)<12&&v&&!v.parts.mainRotor&&!v.parts.water)return 'garage';
  if(d(ARMORY)<9&&!v)return 'armory';
  if(d(HOME)<6&&!v)return 'safehouse';
  if(d(BOATHOUSE)<8&&!v)return 'boathouse';
  return null;
}

const servicePrompts={garage:'PALOMA RESPRAY  /  $250',armory:'RESTOCK & ARMOR  /  $180',safehouse:'OPEN SAFEHOUSE',boathouse:'BOARD MIRAMAR SWIFT'};
const objectives={meet:'MEET CONTACT',collect:'COLLECT PACKAGE',disable:'DISABLE RELAY'};

export function interactionPrompt(sim){
  const target=currentObjective(sim),p=sim.focus(),v=sim.player.vehicle;
  if(target&&Math.hypot(p.x-target.x,p.z-target.z,p.y)<10&&objectives[target.action])return '[ E ]  '+objectives[target.action];
  const site=nearbyService(sim);
  if(site)return '[ E ]  '+servicePrompts[site];
  if(v)return v.parts.water?'[ F ]  DOCK & EXIT':v.pos.y>3.2?'LAND TO EXIT':'[ F ]  EXIT VEHICLE';
  if(nearbyCover(sim))return sim.player.cover?'[ E ]  LEAVE COVER':'[ E ]  USE COVER';
  const car=sim.nearestVehicle();
  if(car)return '[ F ]  '+(car.stealable?'STEAL':'ENTER')+' '+car.spec.name.toUpperCase();
  return '[ M ]  OPEN ATLAS';
}

function updateSweep(sim,dt){
  const p=sim.focus();
  if(Math.hypot(p.x+128,p.z+156)>72)return false;
  sim.summonMira(false);
  if(!sim.syndicate.length){
    const positions=[[-133,-149],[-124,-155],[-130,-165],[-120,-172]];
    positions.forEach(([x,z],i)=>{
      const guard=createWalker(sim.scene,'syndicate',i+2);
      guard.group.position.set(x,0,z);guard.cooldown=.6+i*.7;
      sim.syndicate.push(guard);
    });
  }
  sim.updateHostiles(sim.syndicate,dt);
  return sim.syndicate.every(guard=>guard.down);
}

function finishActivity(sim,a){
  const data=a.kind==='race'?RACES[a.id]:null, id=data?a.id:a.step;
  const list=data?sim.career.races:sim.career.drops;
  if(!list.includes(id)){
    list.push(id);
    sim.stats.money+=data?1650:350;sim.stats.rp+=data?260:55;
    const d=data?.district??[5,3,2,2,0,1][id];
    sim.stats.control[d]=clamp(sim.stats.control[d]+(data?20:9),0,100);
  }
  if(!data){
    const next=DROPS.findIndex((_,i)=>!list.includes(i));
    if(next>=0){a.step=next;sim.notice('CACHE RECOVERED  /  '+list.length+' OF '+DROPS.length);return;}
  }
  sim.notice(data?'RACE COMPLETE  /  '+(data.limit-a.time).toFixed(1)+' S':'CONTRABAND CIRCUIT COMPLETE');
  sim.missions.alternate=null;
}

export function updateMissionDirector(sim,dt,interact){
  const m=sim.missions,a=m.alternate,target=currentObjective(sim),p=sim.focus(),own=sim.player.vehicle;
  m.marker.visible=Boolean(target);
  const elevated=target?.action==='flyby';
  const water=target?.action==='sail';
  m.gate.visible=elevated;
  m.ring.visible=!elevated;
  m.core.visible=!elevated&&!water;
  m.parcel.visible=target?.action==='collect';
  m.relay.visible=target?.action==='disable';
  if(target){
    m.marker.position.set(target.x,elevated?103:water?-.2:0,target.z);
    m.gate.rotation.y=-.25;
    m.core.rotation.y=sim.time*1.7;
    m.core.position.y=2.5+Math.sin(sim.time*3)*.33;
  }
  m.relics.forEach((mesh,i)=>{
    const d=Math.hypot(p.x-mesh.position.x,p.z-mesh.position.z);
    mesh.visible=d<64&&!sim.career.relics.includes(i);
    if(!mesh.visible)return;
    mesh.position.y=.75+Math.sin(sim.time*2.8+i)*.22;
    mesh.rotation.set(.32,sim.time*1.6+i,.21);
    if(dt>0&&d<2.1&&p.y<2.5){
      mesh.visible=false;sim.career.relics.push(i);sim.stats.rp+=45;
      sim.audio.effect('pickup');sim.notice('REEF RELIC  /  '+sim.career.relics.length+' OF '+RELICS.length);
    }
  });
  if(dt<=0)return;
  if(m.waypoint&&Math.hypot(p.x-m.waypoint.x,p.z-m.waypoint.z)<6&&p.y<8){
    m.waypoint=null;sim.notice('WAYPOINT REACHED');
  }
  if(target){
    const distance=Math.hypot(p.x-target.x,p.z-target.z),alt=p.y,action=target.action;
    if(a){
      if(a.kind==='race'){
        if(a.step>0)a.time-=dt;
        if(a.time<=0){m.alternate=null;sim.notice('RACE EXPIRED  /  RETRY FROM ATLAS');return;}
        if(distance<14&&alt<5&&own&&!own.parts.mainRotor&&!own.parts.water){
          a.step++;sim.audio.effect('pickup');
          if(a.step===RACES[a.id].points.length)finishActivity(sim,a);
          return;
        }
      }else if(distance<10&&alt<6&&interact){sim.audio.effect('pickup');finishActivity(sim,a);return;}
    }else if(m.index<CAMPAIGN.length){
      if(m.stage>0)m.elapsed+=dt;
      const near=distance<10&&alt<6;
      const achieved=
        action==='drive'?own?.type==='apex':
        action==='fly'?own?.type==='heli'&&alt>13:
        action==='flyby'?distance<14&&Math.abs(alt-103)<14&&own?.type==='heli':
        action==='sail'?distance<18&&own?.type==='boat':
        action==='sweep'?updateSweep(sim,dt):
        action==='escape'?distance<26&&Boolean(own)&&alt<12:
        action==='evade'?sim.police.stars===0:
        action==='visit'?distance<16&&alt<10&&(m.index!==0||own?.type==='apex'):
        near&&interact;
      if(achieved){stepCampaign(sim);return;}
    }
  }
  if(!interact)return;
  const site=nearbyService(sim);
  if(site==='safehouse'){sim.openHub?.('save');return;}
  if(site==='boathouse'){sim.boardBoat();return;}
  if(site==='garage'){
    if(sim.stats.money<250){sim.notice('NEED $250 FOR RESPRAY');return;}
    sim.stats.money-=250;own.hull=100;own.nitro=100;
    resprayVehicle(own);clearWanted(sim);
    sim.notice('PALOMA RESPRAY  /  HEAT CLEARED');sim.audio.effect('pickup');
    return;
  }
  if(site==='armory'){
    if(sim.stats.money<180){sim.notice('NEED $180 FOR SUPPLIES');return;}
    sim.stats.money-=180;
    for(let i=2;i<sim.combat.reserve.length;i++)sim.combat.reserve[i]+=30;
    sim.player.armor=100;sim.notice('ARMOR & AMMUNITION RESTOCKED');sim.audio.effect('pickup');
    return;
  }
  if(nearbyCover(sim)){
    sim.player.cover=!sim.player.cover;
    sim.notice(sim.player.cover?'IN COVER  /  DAMAGE REDUCED':'LEFT COVER');
  }
}
