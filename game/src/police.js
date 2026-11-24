import { AVENUES, STREETS, angleDelta, clamp, headingTo } from './config.js';
import { animateWalker, createWalker } from './pedestrians.js';
import { facingPoint, removeVehicle, spawnVehicle, steerVehicle } from './vehicles.js';

const DEPLOYMENT=['INTERCEPT','RAMMING','PIT MANEUVER','FLANKING','ROADBLOCK','SWAT'];
const UNIT_NAMES=['MANTA–04','MANTA–12','REEF–08','REEF–17','GATE–02','SENTINEL'];
const MIN_STARS=[1,2,3,3,4,5];

export function createDispatch(){
  return {stars:0,units:[],air:null,officers:[],lastSeen:0,nextSpawn:0,quiet:0,jammed:0,siren:false};
}

export function raiseWanted(sim,amount){
  const p=sim.police;
  p.stars=clamp(Math.max(p.stars,amount),0,5);
  p.lastSeen=sim.time;
  p.quiet=0;
}

export function clearWanted(sim){
  const p=sim.police;
  p.stars=0; p.quiet=0;
  for(const unit of p.units)removeVehicle(sim.scene,unit.car);
  if(p.air)removeVehicle(sim.scene,p.air);
  for(const person of p.officers)sim.scene.remove(person.group);
  p.units.length=0;p.officers.length=0;p.air=null;
}

export function deployCruiser(sim,id,x,z,yaw,speed=0){
  const car=spawnVehicle(sim.scene,id===5?'swat':'police',x,z,yaw);
  car.police=true;car.speed=speed;car.frame=id;
  const unit={id,name:UNIT_NAMES[id],role:DEPLOYMENT[id],car,repath:0};
  sim.police.units.push(unit);
  return unit;
}

export function deployAirUnit(sim,x,z,yaw,y=26){
  const car=spawnVehicle(sim.scene,'falcon',x,z,yaw,y);
  car.police=true;
  sim.police.air=car;
  return car;
}

export function placeOfficer(sim,x,z,index){
  const p=createWalker(sim.scene,'officer',index);
  p.group.position.set(x,0,z);
  p.cooldown=.5+index*.34;
  sim.police.officers.push(p);
  return p;
}

function nearest(n,array){return array.reduce((a,b)=>Math.abs(a-n)<Math.abs(b-n)?a:b);}

function spawnPatrol(sim,id){
  const focus=sim.focus();
  const heading=sim.player.vehicle?.yaw??sim.player.yaw;
  const offset=(id%2?1:-1)*(53+id*6);
  const z=nearest(focus.z-Math.cos(heading)*offset,STREETS);
  const x=focus.x>149?(focus.x>377?420:232):nearest(focus.x+Math.sin(heading)*offset,AVENUES);
  const actualZ=x>150?(focus.z>-121?-68:-244):z;
  return deployCruiser(sim,id,x+4.8,actualZ,headingTo(focus.x-x,focus.z-actualZ),12);
}

function routePursuit(sim,unit,x,z){
  const from=unit.car.pos;
  const dx=x-from.x,dz=z-from.z;
  const steps=Math.min(15,Math.ceil(Math.hypot(dx,dz)/8));
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    if(sim.world.canMove(from.x+dx*t,from.z+dz*t,0,.95))continue;
    const avenue=nearest(from.x,AVENUES);
    const street=nearest(from.z,STREETS);
    const distX=Math.abs(avenue-from.x),distZ=Math.abs(street-from.z);
    const destinationStreet=nearest(z,STREETS),destinationAvenue=nearest(x,AVENUES);
    if(from.x>144||x>144)return {x,z:z>-121?-68:-244};
    if(distX<12 && (distZ>11||destinationAvenue===avenue))return {x:avenue+Math.sign(dz||1)*3,z:destinationStreet};
    if(distZ<12)return {x:destinationAvenue,z:street+Math.sign(dx||1)*3};
    return distX<distZ?{x:avenue,z:from.z}:{x:from.x,z:street};
  }
  return {x,z};
}

function updatePursuitUnit(sim,unit,dt){
  const car=unit.car;
  if(car.hull<=0)return;
  const focus=sim.focus(), own=sim.player.vehicle;
  const moving=own&&own.pos.y<4;
  const yaw=moving?own.yaw:sim.player.yaw;
  const dx=Math.sin(yaw),dz=-Math.cos(yaw);
  const side=unit.id%2===0?1:-1;
  const dist=Math.hypot(car.pos.x-focus.x,car.pos.z-focus.z);
  const lead=unit.id===4?37:unit.id===0?12:unit.id===3?4:0;
  const wing=unit.id===2?2.7:unit.id===3?7:unit.id===5?-6:0;
  const plan=routePursuit(sim,unit,focus.x+dx*lead+dz*wing*side,focus.z+dz*lead-dx*wing*side);
  const cruise=unit.id===4&&dist<16?6:moving?Math.max(21,Math.abs(own.speed)+8):Math.min(26,Math.max(3,dist*.69));
  steerVehicle(car,plan.x,plan.z,cruise,dt,sim.world);
  if(dist<2.6&&moving){
    const hit=unit.id===1?11:unit.id===2?7.6:4;
    own.hull=Math.max(0,own.hull-dt*hit);
    own.speed*=Math.max(.92,1-dt*.41);
    if(unit.id===2)own.yaw+=side*dt*.28;
  }
  if(!moving&&dist<13&&sim.police.officers.length<Math.min(6,sim.police.stars+1)&&!unit.dropped){
    const p=facingPoint(car,2.5);
    if(sim.world.canMove(p.x,p.z,0,.3)){
      placeOfficer(sim,p.x,p.z,unit.id);unit.dropped=true;
    }
  }
}

function flyOverPursuit(sim,dt){
  const heli=sim.police.air, focus=sim.focus();
  const a=sim.time*.45;
  const x=focus.x+Math.cos(a)*34,z=focus.z+Math.sin(a)*34;
  heli.pos.x+=(x-heli.pos.x)*Math.min(.85,dt*.8);
  heli.pos.z+=(z-heli.pos.z)*Math.min(.85,dt*.8);
  heli.pos.y+=(Math.max(27,focus.y+12)-heli.pos.y)*dt;
  const heading=headingTo(focus.x-heli.pos.x,focus.z-heli.pos.z);
  heli.yaw+=angleDelta(heading,heli.yaw)*dt*2;
  heli.body.rotation.z=.13*Math.sin(a);
}

function updateOfficers(sim,dt){
  const focus=sim.focus();
  for(const p of sim.police.officers){
    if(p.down){animateWalker(p,sim.time);continue;}
    const at=p.group.position;
    const d=Math.hypot(focus.x-at.x,focus.z-at.z);
    p.yaw=headingTo(focus.x-at.x,focus.z-at.z);
    p.pace=d>13?4.3:0;
    const x=at.x+Math.sin(p.yaw)*p.pace*dt,z=at.z-Math.cos(p.yaw)*p.pace*dt;
    if(sim.world.canMove(x,z,0,.3)){at.x=x;at.z=z;}
    if(d<43&&focus.y<4&&p.cooldown<=0&&!sim.police.jammed){
      const clear=[.18,.38,.60,.81].every(t=>sim.world.canMove(at.x+(focus.x-at.x)*t,at.z+(focus.z-at.z)*t,0,.05));
      if(clear){sim.combat.enemyStrike(at,focus);p.cooldown=1.8+Math.abs(Math.sin(sim.time+p.phase))*1.2;}
    }
    p.cooldown-=dt;
    animateWalker(p,sim.time,d<46,2);
  }
}

export function updateDispatch(sim,dt) {
  const p=sim.police;
  p.jammed=Math.max(0,p.jammed-dt);
  if(!p.stars)return;
  const focus=sim.focus();
  const d=(v)=>Math.hypot(v.pos.x-focus.x,v.pos.z-focus.z, (v.pos.y-focus.y)*.7);
  const eyes=p.units.some(unit=>unit.car.hull>0&&d(unit.car)<42)||p.air&&d(p.air)<44;
  p.quiet+=dt*(eyes&&!p.jammed?-.7:p.jammed?3:1);
  p.quiet=Math.max(0,p.quiet);
  if(p.quiet>10.5+p.stars*2.3){
    p.stars--;p.quiet=0;
    if(!p.stars){clearWanted(sim);return;}
  }
  if(sim.time>p.nextSpawn&&!p.jammed){
    p.nextSpawn=sim.time+1.9;
    for(let i=p.units.length-1;i>=0;i--){
      const unit=p.units[i];
      if(d(unit.car)>183||unit.car.hull<=0||p.stars<MIN_STARS[unit.id]){
        removeVehicle(sim.scene,unit.car);p.units.splice(i,1);
      }
    }
    const id=MIN_STARS.findIndex((min,i)=>p.stars>=min&&!p.units.some(u=>u.id===i));
    if(id>=0)spawnPatrol(sim,id);
  }
  if(p.stars>=4&&!p.air)deployAirUnit(sim,focus.x+24,focus.z-30,1);
  if(p.stars<4&&p.air){removeVehicle(sim.scene,p.air);p.air=null;}
  if(!p.jammed)for(const unit of p.units)updatePursuitUnit(sim,unit,dt);
  if(p.air)flyOverPursuit(sim,dt);
  updateOfficers(sim,dt);
}

export function dispatchRows(sim){
  const focus=sim.focus(), distance=v=>Math.round(Math.hypot(v.pos.x-focus.x,v.pos.z-focus.z,v.pos.y-focus.y));
  const list=sim.police.units.filter(u=>u.car.hull>0).map(u=>[u.name,u.role,distance(u.car)]);
  if(sim.police.air)list.push(['FALCON–1','AIR SUPPORT',distance(sim.police.air)]);
  return list;
}
