import { headingTo } from './config.js';
import { openVehicle } from './engine.js';
import { placePedestrian, stageTrafficCar, updateMira } from './pedestrians.js';
import { deployAirUnit, deployCruiser, placeOfficer, raiseWanted } from './police.js';

function operation(sim,index,stage,cash,rp,control){
  sim.missions.index=index;sim.missions.stage=stage;
  sim.stats.money=cash;sim.stats.rp=rp;sim.stats.control=control;
}

function chase(sim){
  sim.clock=17.08;
  operation(sim,4,2,18450,1900,[76,66,52,49,23,17]);
  const v=openVehicle(sim,'apex',59.1,114.4,-.10);
  v.speed=155/3.6;v.hull=84;v.nitro=71;v.boost=true;
  sim.player.armor=66;sim.player.health=91;
  const wreck=deployCruiser(sim,4,51.0,106.8,.73).car;
  sim.combat.wreckVehicle(wreck);
  sim.player.health=91;sim.player.armor=66;
  raiseWanted(sim,5);
  for(const [id,x,z,a] of [[0,63.1,96.9,-.33],[1,64.8,109.8,-.23],[2,53.7,110.1,.24],[3,68.3,100.9,-.39]]){
    deployCruiser(sim,id,x,z,a,37-id*1.8);
  }
  deployCruiser(sim,4,56.7,85.6,-1.27,4);
  deployAirUnit(sim,70.4,90.8,-.74,10.6);
  sim.police.spotlight=true;
  stageTrafficCar(sim,'taxi',47.4,86,Math.PI+.03);
  stageTrafficCar(sim,'suv',65.6,72,.02);
  stageTrafficCar(sim,'coupe',52.1,62,Math.PI);
  for(let i=0;i<13;i++){
    const p=placePedestrian(sim,i%2?75.8:42.9,93-i*3.9,i%2?-.35:2.4,i+1);
    p.pace=4.8;
  }
  for(let i=0;i<6;i++){
    v.pos.z=121.1-i*1.36;sim.combat.skid(v);
  }
  v.pos.z=114.4;
  sim.cooldowns[2]=19;
  sim.combat.select(5);sim.combat.ammo[5]=24;
  sim.director.preview={eye:[59.3,3.24,124.9],target:[65.9,-2.0,89.4],fov:59};
  sim.director.captureAt=1.84;
  sim.speak('Mira','Falcon has eyes on the Strand. Stay on Oceanlight, then cut left for Arco.');
}

function onfoot(sim){
  sim.clock=19.20;
  operation(sim,2,1,6640,730,[41,55,32,28,12,6]);
  const person=sim.player.person;
  person.group.position.set(-126.2,0,-134.5);
  sim.player.yaw=person.yaw=-.055;
  sim.director.preview={eye:[-124.6,2.34,-128.8],target:[-126.4,1.17,-157.9],fov:61};
  sim.director.captureAt=1.92;
  const wreck=deployCruiser(sim,0,-136.3,-145.4,2.54).car;
  sim.combat.wreckVehicle(wreck);
  sim.player.health=84;sim.player.armor=47;sim.hitUntil=0;
  raiseWanted(sim,3);
  deployCruiser(sim,1,-120.9,-155.9,-2.18,0);
  deployCruiser(sim,3,-128.8,-177.8,Math.PI,0);
  const positions=[[-126.2,-148.7],[-120.7,-154.1],[-134.9,-158.8],[-129.9,-166.8]];
  positions.forEach(([x,z],i)=>{
    const p=placeOfficer(sim,x,z,i+2);
    p.yaw=headingTo(-126.2-x,-134.5-z);p.cooldown=1.80+i*.016;
    p.markedUntil=6;
  });
  const down=placeOfficer(sim,-130.5,-141.1,9);
  down.down=15;down.health=0;down.yaw=.75;
  const mira=sim.summonMira(false);
  mira.group.position.set(-129.5,0,-136.9);mira.cooldown=1.82;
  stageTrafficCar(sim,'apex',-121.2,-136.8,.23);
  stageTrafficCar(sim,'taxi',-136.4,-162.1,1.55);
  for(let i=0;i<5;i++){
    const p=placePedestrian(sim,i%2?-115.1:-140.7,-161-i*5.4,i%2?0:Math.PI,i+2);
    p.pace=5.2;
  }
  sim.combat.select(5);sim.combat.ammo[5]=20;
  sim.cooldowns[0]=14;
  sim.speak('Mira','I’ll cover the market lane. Get to the violet relay before their second wave hits.');
  let fired=false;
  sim.director.animate=(s,dt)=>{
    s.aimUntil=s.time+1;
    s.updateHostiles(s.police.officers,dt);
    updateMira(s,dt);
    if(!fired&&s.time>1.85){s.combat.shot(s.player.yaw,.008);fired=true;}
  };
}

function aerial(sim){
  sim.clock=17.88;
  operation(sim,5,2,27460,2390,[72,57,45,43,34,45]);
  const v=openVehicle(sim,'heli',343,128,-1.12,125);
  v.speed=39.5;v.hull=96;v.body.rotation.z=-.14;v.body.rotation.x=-.11;
  sim.audio.radio.station=3;
  deployAirUnit(sim,357,37,-1.09,128);
  raiseWanted(sim,4);
  sim.speak('Vega','Miramar beacon ahead. Hold at one hundred meters until the manifest syncs.');
  sim.director.preview={eye:[357,134,151],target:[195,-6,-262],fov:61,wide:true};
  sim.director.captureAt=1.14;
}

const showcases={chase,onfoot,aerial,start:frameTitle};
export function stageShowcase(sim,name){
  if(!Object.hasOwn(showcases,name))return false;
  sim.director={shot:name};
  sim.mode=name==='start'?'start':'play';
  showcases[name](sim);
  return true;
}

export function frameTitle(sim){
  sim.clock=18.28;
  sim.director??={};
  if(sim.director.shot)sim.director.captureAt=2.34;
  sim.director.preview={eye:[184,30,100],target:[-44,14,-215],fov:66,wide:true,drift:true};
}
