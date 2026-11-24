import * as THREE from 'three';
import { AVENUES, STREETS, angleDelta, avenueHasGreen, headingTo, seededRandom } from './config.js';
import { panel, spawnVehicle, steerVehicle } from './vehicles.js';

const sphere=new THREE.SphereGeometry(1,10,8);
const capsule=new THREE.CapsuleGeometry(.5,1,3,7);
const mats=new Map();
const jacketColors=[0xe8b460,0x344e77,0xdd755f,0xb6ae7d,0xaee0ca,0xdca9a8,0xf0e1bd,0x698aab];
const skinColors=[0x975b3e,0x714935,0xd89a7a,0xc38257,0xa97453];

function material(color){
  if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));
  return mats.get(color);
}

function piece(group,geometry,color,x,y,z,sx,sy,sz){
  const part=new THREE.Mesh(geometry,material(color));
  part.position.set(x,y,z);part.scale.set(sx,sy,sz);group.add(part);
  return part;
}

export function createWalker(scene,kind,index=0){
  const group=new THREE.Group();
  const skin=skinColors[index%skinColors.length];
  const shirt=kind==='mateo'?0x85c4bf:kind==='officer'?0x25364d:jacketColors[index%jacketColors.length];
  const pants=kind==='mateo'?0x3e4b58:kind==='officer'?0x202c3b:index%2?0x5c6478:0x986d5d;
  piece(group,capsule,shirt,0,1.16,0,.47,.30,.29).castShadow=kind==='mateo';
  piece(group,capsule,pants,0,.89,.012,.41,.135,.25);
  piece(group,capsule,skin,0,1.43,-.016,.12,.079,.115);
  piece(group,sphere,skin,0,1.59,-.02,.124,.167,.112);
  piece(group,sphere,kind==='officer'?0x243247:0x27212a,0,1.665,.004,.126,.096,.115);
  piece(group,sphere,skin,0,1.569,-.129,.035,.036,.036);
  if(kind==='mateo'){
    panel(group,material(0xe1ded0),0,1.244,-.143,.13,.26,.024);
    panel(group,material(0x384c50),.117,1.22,.143,.045,.29,.028,0,0,.12);
    panel(group,material(0xf6c176),-.105,1.32,.128,.09,.058,.025);
  }
  if(kind==='officer'){
    panel(group,material(0x151f30),0,1.65,-.105,.22,.032,.135);
    panel(group,material(0xe4b56b),-.108,1.28,-.15,.06,.06,.022);
    panel(group,material(0x161e2a),0,.93,0,.425,.09,.279);
  }
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();
    arm.position.set(side*.254,1.32,0);
    piece(arm,capsule,shirt,0,-.105,0,.138,.123,.135);
    piece(arm,capsule,skin,0,-.282,-.017,.105,.102,.104);
    piece(arm,sphere,skin,0,-.389,-.024,.063,.076,.057);
    group.add(arm);arms.push(arm);
    const leg=new THREE.Group();
    leg.position.set(side*.122,.83,0);
    piece(leg,capsule,pants,0,-.191,.008,.191,.213,.20);
    piece(leg,capsule,pants,0,-.54,.020,.159,.186,.179);
    piece(leg,capsule,kind==='mateo'?0xdccebd:0x242b35,0,-.755,-.054,.155,.070,.292);
    group.add(leg);legs.push(leg);
  }
  const weapon=new THREE.Group();
  weapon.position.set(.245,1.277,-.31);
  panel(weapon,material(0x30313b),0,0,-.16,.09,.13,.58);
  panel(weapon,material(0x747079),0,.01,-.57,.056,.056,.38);
  panel(weapon,material(0x282a34),0,-.08,-.21,.079,.16,.13,-.17);
  panel(weapon,material(0x466268),0,0,.16,.077,.12,.28,.07);
  group.add(weapon);weapon.visible=false;
  if(kind==='mateo') group.scale.setScalar(1.11);
  scene.add(group);
  return {group,arms,legs,weapon,kind,yaw:0,pace:0,down:0,health:100,phase:index*.71};
}

export function animateWalker(person,time,aim=false,weaponIndex=5){
  const {group,arms,legs,weapon}=person;
  group.rotation.y=-person.yaw;
  if(person.down){
    group.rotation.z=-1.48;
    group.position.y=.12;
    return;
  }
  group.rotation.z=0;
  const swing=Math.sin(time*(person.pace>5?13:8)+person.phase)*Math.min(.89,person.pace*.15);
  group.position.y=Math.abs(swing)*.045;
  legs[0].rotation.x=swing;legs[1].rotation.x=-swing;
  arms[0].rotation.x=aim?-1.44:-swing*.51;
  arms[1].rotation.x=aim?-1.48:swing*.51;
  arms[0].rotation.z=aim?.46:-.06;
  arms[1].rotation.z=aim?-.07:.06;
  weapon.visible=aim&&weaponIndex>1;
  weapon.scale.setScalar(weaponIndex===2?.52:weaponIndex===6?1.3:1);
}

function trafficRoute(axis,index,side){
  if(axis==='port')return [{x:-206,z:-238},{x:488,z:-238},{x:488,z:-250},{x:-206,z:-250}];
  if(axis==='x'){
    const near=STREETS[index]+side*4.7;
    const far=STREETS[(index+2)%STREETS.length]+side*4.7;
    return [{x:-298,z:near},{x:53,z:near},{x:53,z:far},{x:-298,z:far}];
  }
  const near=AVENUES[index]+side*(index===4?5:4.7);
  const far=AVENUES[(index+3)%AVENUES.length]+side*4.7;
  return [{x:near,z:-327},{x:near,z:365},{x:far,z:365},{x:far,z:-327}];
}

export function stageTrafficCar(sim,type,x,z,yaw,route=null){
  const car=spawnVehicle(sim.scene,type,x,z,yaw);
  car.traffic=route;
  car.target=0;car.cruise=12+(sim.vehicles.length%5)*1.5;
  sim.vehicles.push(car);
  return car;
}

export function populateCity(sim){
  const random=seededRandom(57390);
  for(let i=0;i<33;i++){
    const axis=i<3?'port':i%3===0?'x':'z';
    const index=axis==='x'?i%STREETS.length:i%AVENUES.length;
    const route=trafficRoute(axis,index,i%2===0?-1:1);
    const leg=i%4, start=route[leg], end=route[(leg+1)%4];
    const t=.12+random()*.73;
    const traffic=stageTrafficCar(sim,['coupe','taxi','suv','moto'][i%4],start.x+(end.x-start.x)*t,start.z+(end.z-start.z)*t,headingTo(end.x-start.x,end.z-start.z),route);
    traffic.target=(leg+1)%4;
    traffic.speed=traffic.cruise*.65;
  }
  const parking=[
    ['apex',65.6,124,0],['coupe',-44.3,187,0],['moto',-44,205,Math.PI],['suv',-208,189,0],
    ['taxi',-134,-142,Math.PI],['coupe',-116,-148,0],['coupe',65,-77,Math.PI],['moto',71,25,Math.PI],['heli',470,-211,Math.PI*.52],
  ];
  for(const [type,x,z,yaw] of parking)stageTrafficCar(sim,type,x,z,yaw);
  for(let i=0;i<52;i++){
    const person=createWalker(sim.scene,'pedestrian',i+2);
    const coast=i<27;
    const x=coast?(i%3===0?74:i%3===1?85:98):AVENUES[i%AVENUES.length]+(i%2?11.8:-11.8);
    const z=coast?-262+i*21.4:-312+random()*659;
    person.group.position.set(x,0,z);
    person.home=person.group.position.clone();
    person.yaw=i%2?0:Math.PI;
    sim.pedestrians.push(person);
  }
}

export function placePedestrian(sim,x,z,yaw,index){
  const person=createWalker(sim.scene,'pedestrian',index);
  person.group.position.set(x,0,z);person.home=person.group.position.clone();person.yaw=yaw;
  sim.pedestrians.push(person);
  return person;
}

function redLightAhead(car,time){
  const dx=Math.sin(car.yaw),dz=-Math.cos(car.yaw);
  const northSouth=Math.abs(dz)>Math.abs(dx);
  const {x,z}=car.pos;
  const road=(northSouth?AVENUES:STREETS).find(a=>Math.abs(a-(northSouth?x:z))<8);
  if(road===undefined)return false;
  return (northSouth?STREETS:AVENUES).some(cross=>{
    const gap=(cross-(northSouth?z:x))*Math.sign(northSouth?dz:dx);
    return gap>10&&gap<19&&avenueHasGreen(northSouth?road:cross,northSouth?cross:road,time)!==northSouth;
  });
}

export function updateCityLife(sim,dt) {
  const focus=sim.focus();
  for(const v of sim.vehicles){
    if(v===sim.player.vehicle||v.police||!v.traffic||v.hull<=0)continue;
    const p=v.traffic[v.target];
    if(Math.hypot(p.x-v.pos.x,p.z-v.pos.z)<7)v.target=(v.target+1)%v.traffic.length;
    const lead=sim.vehicles.some(other=>{
      if(other===v||other.pos.y>2)return false;
      const dx=other.pos.x-v.pos.x,dz=other.pos.z-v.pos.z;
      return Math.hypot(dx,dz)<8&&Math.abs(angleDelta(headingTo(dx,dz),v.yaw))<.29;
    });
    steerVehicle(v,p.x,p.z,redLightAhead(v,sim.time)?0:lead?3.5:v.cruise,dt,sim.world);
  }
  for(const p of sim.pedestrians){
    const at=p.group.position;
    const dist=Math.hypot(focus.x-at.x,focus.z-at.z);
    if(dist>230){p.group.visible=false;continue;}
    p.group.visible=true;
    if(p.down){
      p.down=Math.max(0,p.down-dt);
      if(!p.down){p.health=100;at.copy(p.home);}
      continue;
    }
    const panic=dist<45&&(sim.combat.alarm>0||(sim.police.stars>=2&&dist<24));
    const tooFar=Math.abs(at.z-p.home.z)>25;
    if(panic) {
      const delta=angleDelta(headingTo(at.x-focus.x,at.z-focus.z),p.yaw);
      p.yaw+=Math.max(-3*dt,Math.min(3*dt,delta));
    } else if(tooFar)p.yaw=at.z>p.home.z?0:Math.PI;
    p.pace=panic?6.2:1.6;
    const x=at.x+Math.sin(p.yaw)*p.pace*dt,z=at.z-Math.cos(p.yaw)*p.pace*dt;
    if(sim.world.canMove(x,z,0,.2)){at.x=x;at.z=z;}
    else p.yaw+=Math.PI*.83;
  }
}
