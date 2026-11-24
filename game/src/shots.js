import { headingTo } from './config.js';
import { openVehicle } from './engine.js';
import { animateWalker, placePedestrian, stageTrafficCar } from './pedestrians.js';
import { deployAirUnit, deployCruiser, placeOfficer, raiseWanted } from './police.js';

function operation(sim,index,stage,cash,rp,control){
  sim.missions.index=index;sim.missions.stage=stage;sim.missions.completed=index;
  sim.stats.money=cash;sim.stats.rp=rp;sim.stats.control=control;
}

function chase(sim){
  sim.clock=17.05;
  operation(sim,3,2,12460,1040,[68,48,32,39,19,12]);
  const v=openVehicle(sim,'apex',59.7,113,-.16);
  v.speed=146/3.6;v.hull=84;v.nitro=71;v.boost=true;
  sim.player.armor=66;sim.player.health=91;
  raiseWanted(sim,5);
  for(const [id,x,z,a] of [[0,52.2,99.6,.07],[1,64.7,111.7,-.23],[2,55.8,111.1,.24],[3,67.3,98.6,-.19],[4,61,86.5,-.96]]){
    deployCruiser(sim,id,x,z,a,37-id*1.8);
  }
  deployAirUnit(sim,82.1,70,-.68,13.6);
  stageTrafficCar(sim,'taxi',47.4,87,Math.PI+.03);
  stageTrafficCar(sim,'suv',65.6,75,.02);
  stageTrafficCar(sim,'coupe',52.1,64,Math.PI);
  for(let i=0;i<12;i++){
    const p=placePedestrian(sim,i%2?75.8:42.9,90-i*3.6,i%2?-.35:2.4,i+1);
    p.pace=4.8;
  }
  sim.combat.select(5);sim.combat.ammo[5]=24;
  sim.director.preview={eye:[59.0,3.06,123.1],target:[66.2,-.75,91.2],fov:57};
  sim.speak('Mira','Falcon has eyes on the Strand. Stay on the boulevard, then cut left for Arco.');
  sim.director.animate=s=>{
    s.messages.commsUntil=s.time+2;
  };
}

function onfoot(sim){
  sim.clock=19.20;
  operation(sim,2,1,6640,730,[41,55,32,28,12,6]);
  const person=sim.player.person;
  person.group.position.set(-126.2,0,-134.5);
  sim.player.yaw=person.yaw=-.055;
  sim.director.preview={eye:[-124.4,2.18,-130.10],target:[-127.5,.68,-158.2],fov:58};
  sim.player.health=84;sim.player.armor=47;
  raiseWanted(sim,3);
  deployCruiser(sim,0,-132.9,-147.0,2.64,0);
  deployCruiser(sim,1,-120.8,-154.8,-2.18,0);
  deployCruiser(sim,3,-128.8,-177.8,Math.PI,0);
  const target=[[-126.6,-147.2],[-121.9,-151.2],[-132.5,-158.8],[-118.7,-177]];
  target.forEach(([x,z],i)=>{
    const p=placeOfficer(sim,x,z,i+2);
    p.yaw=headingTo(-126.2-x,-134.5-z);
  });
  stageTrafficCar(sim,'apex',-122.5,-137.4,.27);
  stageTrafficCar(sim,'taxi',-136.4,-160.1,1.55);
  for(let i=0;i<10;i++){
    const p=placePedestrian(sim,i%2?-115.1:-140.7,-141-i*4.4,i%2?0:Math.PI,i+2);
    p.pace=6;
  }
  sim.combat.select(5);sim.combat.ammo[5]=19;
  sim.speak('Mira','The relay is on your right. Get to it before their second wave hits the block.');
  let last=-10;
  sim.director.animate=s=>{
    s.messages.commsUntil=s.time+2;s.aimUntil=s.time+1;
    if(s.time-last>.32){
      s.combat.shot(s.player.yaw,.008,true);
      s.combat.enemyStrike(s.police.officers[1].group.position,s.focus(),true);
      last=s.time;
    }
    for(const p of s.police.officers)animateWalker(p,s.time,true,2);
  };
}

function aerial(sim){
  sim.clock=17.95;
  operation(sim,4,2,17580,1530,[72,57,45,43,34,45]);
  const v=openVehicle(sim,'heli',343,128,-1.12,127);
  v.speed=39.5;v.hull=96;v.body.rotation.z=-.14;v.body.rotation.x=-.11;
  sim.audio.radio.station=3;
  sim.speak('Vega','There’s Miramar. Keep the Kestrel steady until the beacon syncs the manifest.');
  sim.director.preview={eye:[356,136,147],target:[148,-17,-265],fov:61,wide:true};
  sim.director.animate=s=>{s.messages.commsUntil=s.time+2;};
}

function map(sim){
  operation(sim,3,2,12460,1040,[68,48,32,39,19,12]);
  sim.clock=17.38;
  sim.mode='map';
  sim.player.person.group.position.set(58,0,108);
  sim.director.preview={eye:[81,44,-14],target:[-73,-30,-220],fov:66,wide:true};
}

const showcases={chase,onfoot,aerial,map};
export function stageShowcase(sim,name){
  if(!Object.hasOwn(showcases,name))return false;
  sim.director={shot:name};
  sim.mode='play';
  showcases[name](sim);
  return true;
}

export function frameTitle(sim){
  sim.director={preview:{eye:[198,49,103],target:[-85,26,-209],fov:65,wide:true}};
}
