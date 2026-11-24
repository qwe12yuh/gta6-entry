import * as THREE from 'three';
import { WEAPONS, clamp, seededRandom } from './config.js';
import { raiseWanted } from './police.js';
import { charVehicle, groundGlow, lightBloom } from './vehicles.js';

const sparksGeometry=new THREE.IcosahedronGeometry(.075,0);
const flareGeometry=new THREE.IcosahedronGeometry(.33,1);
const shardMaterial=new THREE.MeshBasicMaterial({color:0xffb854,toneMapped:false});
const blastMaterial=new THREE.MeshBasicMaterial({color:0xffad54,toneMapped:false,transparent:true,opacity:.8,depthWrite:false});
const end=new THREE.Vector3();
const forward=new THREE.Vector3();
const sample=new THREE.Vector3();
const bodyOffset=new THREE.Vector3();
const skidGeometry=new THREE.PlaneGeometry(.19,2.55);
const skidMaterial=new THREE.MeshBasicMaterial({color:0x1c171c,transparent:true,opacity:.42,depthWrite:false});
const tracerMaterials=[
  new THREE.LineBasicMaterial({color:0xffbb76,toneMapped:false}),
  new THREE.LineBasicMaterial({color:0xb2ebff,toneMapped:false}),
];

function trace(scene,origin,target,enemy){
  const geometry=new THREE.BufferGeometry().setFromPoints([origin,target]);
  const line=new THREE.Line(geometry,tracerMaterials[Number(enemy)]);
  scene.add(line);
  return line;
}

function smokeTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d'),random=seededRandom(751);
  for(let i=0;i<18;i++){
    const a=random()*6.28,r=random()*21,x=48+Math.cos(a)*r,y=48+Math.sin(a)*r,spread=16+random()*12;
    const soft=ctx.createRadialGradient(x,y,1,x,y,spread);
    soft.addColorStop(0,'#e1d9d745');soft.addColorStop(.49,'#948b8b3d');soft.addColorStop(1,'#403b4300');
    ctx.fillStyle=soft;ctx.fillRect(0,0,96,96);
  }
  return new THREE.CanvasTexture(canvas);
}

export function createCombat(sim){
  const effects=[];
  const wrecks=[],skids=[],random=seededRandom(22581),smokeMap=smokeTexture();
  const flash=lightBloom(sim.scene,'#ff9f34',0,0,0,2.0);
  flash.visible=false;
  const mux=new THREE.Group();
  for(let i=0;i<6;i++){
    const spark=new THREE.Mesh(new THREE.ConeGeometry(.026+i%2*.033,.37+i%2*.19,5),shardMaterial);
    spark.rotation.z=i*Math.PI/3;
    spark.position.set(Math.sin(i*Math.PI/3)*.13,Math.cos(i*Math.PI/3)*.13,0);
    mux.add(spark);
  }
  mux.visible=false;
  sim.scene.add(mux);
  let flashTime=0, cooldown=0, reload=0;
  const pickups=[];
  const combat={effects,ammo:WEAPONS.map(w=>w.capacity),reserve:[0,0,68,125,32,150,6],unlocked:[true,true,true,true,true,true,true],weapon:2,alarm:0,pickups,reload:0};

  function addPickup(x,z,kind){
    const color=kind==='health'?0x79edbd:kind==='armor'?0x83beff:0xffd38b;
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.58,roughness:.3});
    const mesh=new THREE.Mesh(kind==='ammo'?new THREE.BoxGeometry(.65,.36,.40):new THREE.OctahedronGeometry(.42),mat);
    mesh.position.set(x,.70,z);sim.scene.add(mesh);
    pickups.push({mesh,kind,wait:0});
  }

  function impact(at,amount=4){
    for(let i=0;i<amount;i++){
      const mesh=new THREE.Mesh(sparksGeometry,shardMaterial);
      mesh.position.copy(at);sim.scene.add(mesh);
      effects.push({mesh,life:.18+(i%4)*.07,velocity:new THREE.Vector3(Math.cos(i*2.4)*5,1.2+i%4,Math.sin(i*2.4)*5)});
    }
  }

  function trailSmoke(at,life=1.4,size=1.3){
    const mesh=new THREE.Sprite(new THREE.SpriteMaterial({
      map:smokeMap,color:0x55505b,transparent:true,opacity:.76,depthWrite:false,toneMapped:false,rotation:random()*6.28,
    }));
    mesh.position.copy(at);sim.scene.add(mesh);
    mesh.scale.setScalar(size);
    effects.push({mesh,life,maxLife:life,size,smoke:true,material:true,drift:random()*.9+.3});
  }

  function explosion(at){
    const distance=sim.focus().distanceTo(at);
    if(distance<10)sim.hurt(Math.max(0,(10-distance)*3.6));
    for(let i=0;i<4;i++){
      const mesh=new THREE.Mesh(flareGeometry,blastMaterial.clone());
      mesh.material.color.setHex([0xffe1a1,0xffaf44,0xff632b,0xff9025][i]);
      mesh.position.copy(at).add(new THREE.Vector3((random()-.5)*2,random()*.9,(random()-.5)*2));
      sim.scene.add(mesh);effects.push({mesh,life:.49,burst:true,material:true});
    }
    trailSmoke(at,3,3);
    impact(at,16);
    sim.audio.effect('blast');
    raiseWanted(sim,Math.min(5,Math.max(3,sim.police.stars+1)));
    for(const unit of sim.police.units)if(unit.car.pos.distanceTo(at)<13)unit.car.hull=clamp(unit.car.hull-100,0,100);
    for(const car of sim.vehicles)if(car.pos.distanceTo(at)<8)car.hull=clamp(car.hull-76,0,100);
    for(const p of [...sim.police.officers,...sim.syndicate])if(p.group.position.distanceTo(at)<6)p.down=15;
  }

  function wreckVehicle(car){
    if(car.wrecked)return;
    car.wrecked=true;car.hull=0;
    charVehicle(car);
    const at=car.pos.clone();at.y+=.85;
    explosion(at);
    const fire=new THREE.Group();fire.position.copy(car.pos);sim.scene.add(fire);
    const flames=[];
    for(let i=0;i<8;i++){
      const x=(random()-.5)*1.7,z=(random()-.5)*3.5;
      const color=i%3===0?'#ffdc7c':i%3===1?'#ff8a25':'#ff4a18';
      const glow=lightBloom(fire,color,x,1,z,2.4);
      const tongue=new THREE.Mesh(flareGeometry,new THREE.MeshBasicMaterial({color,toneMapped:false,transparent:true,depthWrite:false,opacity:.35}));
      tongue.position.set(x,.88,z);fire.add(tongue);
      flames.push({glow,tongue,phase:random()*6.28});
    }
    const fireReflection=groundGlow(fire,'#ff6a26',0,0,8.0,11.7,.68);
    const spawn={fire,flames,fireReflection,car,age:0,next:0};
    wrecks.push(spawn);
  }

  function skid(car){
    for(const side of [-1,1]){
      const mesh=skids.length>=104?skids.shift():new THREE.Mesh(skidGeometry,skidMaterial);
      mesh.rotation.set(-Math.PI/2,0,car.yaw);
      mesh.position.set(car.pos.x+Math.cos(car.yaw)*side*.76-Math.sin(car.yaw)*1.14,.072,
        car.pos.z+Math.sin(car.yaw)*side*.76+Math.cos(car.yaw)*1.14);
      sim.scene.add(mesh);skids.push(mesh);
    }
  }

  function allyStrike(person,target){
    const at=person.group.position,goal=target.group.position;
    const from=at.clone().add(new THREE.Vector3(Math.cos(person.yaw)*.24,1.28,Math.sin(person.yaw)*.24));
    from.add(new THREE.Vector3(Math.sin(person.yaw)*.79,0,-Math.cos(person.yaw)*.79));
    const to=goal.clone();to.y+=1.20;
    muzzle(from,to,false);
    target.health-=26;
    if(target.health<=0)target.down=15;
  }

  function muzzle(origin,target,enemy){
    const glow=lightBloom(sim.scene,enemy?'#ffa14c':'#ffbb56',origin.x,origin.y,origin.z,1.73);
    effects.push({mesh:glow,life:.12,material:true});
    effects.push({mesh:trace(sim.scene,origin,target,enemy),life:.19,geometry:true});
  }

  function takeDamage(target,weapon){
    if(target.car){
      target.car.hull=clamp(target.car.hull-weapon.power*.42,0,100);
      if(target.car.hull===0)wreckVehicle(target.car);
    }else{
      target.person.health-=weapon.power;
      if(target.person.health<=0){target.person.down=15;sim.stats.rp+=target.police?22:0;}
    }
  }

  function findHit(origin,dir,range){
    let nearest=range;
    let hit=null;
    for(let d=2.3;d<nearest;d+=2){
      sample.copy(origin).addScaledVector(dir,d);
      if(!sim.world.canMove(sample.x,sample.z,sample.y,.05)){nearest=d;break;}
    }
    function check(pos,rad,target){
      bodyOffset.copy(pos);
      bodyOffset.y+=target.car?.8:1.16;
      const t=sample.subVectors(bodyOffset,origin).dot(dir);
      if(t<0||t>=nearest)return;
      sample.copy(origin).addScaledVector(dir,t);
      if(sample.distanceTo(bodyOffset)>rad)return;
      nearest=t;hit=target;
    }
    for(const unit of sim.police.units)if(unit.car.hull>0)check(unit.car.pos,1.95,{car:unit.car,police:true});
    for(const car of sim.vehicles)if(car!==sim.player.vehicle&&car.hull>0)check(car.pos,1.62,{car});
    for(const p of [...sim.police.officers,...sim.syndicate])if(!p.down)check(p.group.position,.66,{person:p,police:p.kind==='officer'});
    for(const p of sim.pedestrians)if(!p.down)check(p.group.position,.60,{person:p});
    return {hit,distance:nearest};
  }

  function shot(yaw,pitch=0,showcase=false){
    const i=combat.weapon,w=WEAPONS[i];
    if(!showcase&&(cooldown>0||reload>0))return;
    const firearm=i>=2;
    if(firearm&&combat.ammo[i]===0){combat.load();return;}
    const own=sim.player.vehicle;
    const p=sim.focus();
    forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    const side=own?.95:.25;
    const origin=new THREE.Vector3(p.x+Math.cos(yaw)*side,p.y+(own?1.16:1.40),p.z+Math.sin(yaw)*side);
    origin.addScaledVector(forward,own?1.05:.73);
    const {hit,distance}=findHit(origin,forward,w.range);
    end.copy(origin).addScaledVector(forward,distance);
    cooldown=w.delay;
    if(firearm){
      if(!showcase)combat.ammo[i]--;
      flash.position.copy(origin);flash.scale.setScalar(i===6?3.9:1.48);
      mux.position.copy(origin);mux.rotation.y=-yaw;flashTime=showcase?.36:.09;
      const line=trace(sim.scene,origin,end,false);
      effects.push({mesh:line,life:showcase?.56:.108,geometry:true});
      if(i===4){
        for(const shift of [-.13,.13]){
          const scatter=end.clone().add(new THREE.Vector3(shift*distance,.08*distance,0));
          effects.push({mesh:trace(sim.scene,origin,scatter,false),life:.113,geometry:true});
        }
      }
      sim.audio.effect(i===6?'blast':'shot',i);
      combat.alarm=3.3;
      if(!showcase)raiseWanted(sim,Math.max(1,sim.police.stars));
    }else sim.audio.effect('punch');
    if(showcase)return;
    if(hit){
      takeDamage(hit,w);impact(end);sim.hitMarkerUntil=sim.time+.19;
      if(hit.person)hit.person.markedUntil=sim.time+4;
      const wanted=hit.police?Math.min(5,2+Math.floor(sim.missions.hits/3)):1;
      raiseWanted(sim,Math.max(wanted,sim.police.stars));
    }
    else if(distance<w.range-1&&firearm)impact(end,3);
    if(i===6)explosion(end);
    if(hit?.police)sim.missions.hits++;
  }

  Object.assign(combat,{
    shot,impact,explosion,addPickup,trailSmoke,wreckVehicle,skid,allyStrike,
    reset(){
      cooldown=reload=flashTime=combat.reload=combat.alarm=0;
      for(const {mesh,material,geometry} of effects){
        sim.scene.remove(mesh);
        if(material)mesh.material.dispose();
        if(geometry)mesh.geometry.dispose();
      }
      for(const {fire} of wrecks){fire.traverse(item=>item.material?.dispose());sim.scene.remove(fire);}
      sim.scene.remove(...skids);
      effects.length=wrecks.length=skids.length=0;
      for(const pickup of pickups)pickup.wait=0;
    },
    load(){
      const i=combat.weapon;
      if(!reload&&combat.reserve[i]>0&&combat.ammo[i]<WEAPONS[i].capacity){
        reload=.54;combat.reload=.54;sim.audio.effect('reload');
      }
    },
    select(index){
      if(!combat.unlocked[index])return;
      combat.weapon=index;reload=0;combat.reload=0;
    },
    enemyStrike(from,to,showcase=false){
      const origin=from.clone().add(new THREE.Vector3(.1,1.29,0));
      const target=to.clone().add(new THREE.Vector3(showcase?2.1:.1,showcase?1.72:.93,0));
      muzzle(origin,target,true);
      if(showcase)return;
      impact(target,3);
      sim.hurt((4+sim.police.stars*1.4)*(sim.player.cover?.38:1));
      sim.audio.effect('shot',1);
    },
    update(dt,time){
      cooldown=Math.max(0,cooldown-dt);
      combat.alarm=Math.max(0,combat.alarm-dt);
      if(reload>0){
        reload=Math.max(0,reload-dt);combat.reload=reload;
        if(!reload){
          const i=combat.weapon;
          const count=Math.min(combat.reserve[i],WEAPONS[i].capacity-combat.ammo[i]);
          combat.ammo[i]+=count;combat.reserve[i]-=count;
        }
      }
      flashTime=Math.max(0,flashTime-dt);
      flash.visible=mux.visible=flashTime>0;
      for(let i=wrecks.length-1;i>=0;i--){
        const w=wrecks[i];w.age+=dt;
        if(w.age>43){
          w.fire.traverse(item=>item.material?.dispose());sim.scene.remove(w.fire);wrecks.splice(i,1);
          continue;
        }
        for(const {glow,tongue,phase} of w.flames){
          const pulse=Math.sin(time*16+phase),rise=Math.sin(time*9+phase);
          glow.position.y=1.31+rise*.63;glow.scale.set(1.55+pulse*.4,2.9+rise*.84,1);
          tongue.position.y=1.08+rise*.48;tongue.scale.set(.82+pulse*.3,2.0+rise*.74,.86);
        }
        w.fireReflection.material.opacity=.54+Math.sin(time*8)*.14;
        if(w.age>=w.next&&w.fire.position.distanceTo(sim.focus())<360){
          const p=w.fire.position.clone();p.x+=(random()-.5)*1.9;p.z+=(random()-.5)*2.4;p.y+=1.7;
          trailSmoke(p,5.2,2.5);
          if(random()<.6)impact(p,3);
          w.next=w.age+.22;
        }
      }
      for(let i=effects.length-1;i>=0;i--){
        const effect=effects[i];effect.life-=dt;
        if(effect.life<=0){
          sim.scene.remove(effect.mesh);
          if(effect.geometry)effect.mesh.geometry.dispose();
          if(effect.material)effect.mesh.material.dispose();
          effects.splice(i,1);continue;
        }
        if(effect.velocity){
          effect.mesh.position.addScaledVector(effect.velocity,dt);
          effect.velocity.y-=dt*14;
        }
        if(effect.burst){effect.mesh.scale.setScalar(1+(1-effect.life/.49)*14);effect.mesh.material.opacity=effect.life;}
        if(effect.smoke){
          const done=1-effect.life/effect.maxLife;
          effect.mesh.scale.setScalar(effect.size*(1+done*2.8));
          effect.mesh.position.y+=dt*(2.4+done*1.1);effect.mesh.position.x+=dt*effect.drift;
          effect.mesh.position.z+=dt*1.3;
          effect.mesh.material.opacity=(1-done)**.65*.85;
        }
      }
      for(const p of pickups){
        p.wait=Math.max(0,p.wait-dt);p.mesh.visible=!p.wait;
        if(p.wait)continue;
        const pos=p.mesh.position;pos.y=.72+Math.sin(time*2.8+pos.x)*.27;
        p.mesh.rotation.y=time*1.8;
        if(sim.director||sim.mode!=='play'||sim.focus().distanceTo(pos)>2.4)continue;
        if(p.kind==='health')sim.player.health=clamp(sim.player.health+35,0,100);
        if(p.kind==='armor')sim.player.armor=clamp(sim.player.armor+50,0,100);
        if(p.kind==='ammo')for(let i=2;i<WEAPONS.length;i++)combat.reserve[i]+=WEAPONS[i].capacity;
        p.wait=36;sim.audio.effect('pickup');sim.notice(p.kind.toUpperCase()+' RECOVERED');
      }
    },
  });
  for(const [x,z,kind] of [[-42,197,'health'],[-118,25,'ammo'],[229,-66,'health'],[462,-211,'ammo']])addPickup(x,z,kind);
  return combat;
}
