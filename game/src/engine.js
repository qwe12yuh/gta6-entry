import * as THREE from 'three';
import { CREW, HOME, angleDelta, clamp, headingTo } from './config.js';
import { buildSolarisKeys } from './city.js';
import { createAudio } from './audio.js';
import { createCombat } from './combat.js';
import { createMissionDirector, emptyCareer, registerStunt, updateMissionDirector } from './missions.js';
import { animateWalker, createWalker, populateCity, stageTrafficCar, updateCityLife, updateMira } from './pedestrians.js';
import { clearWanted, createDispatch, raiseWanted, updateDispatch, updateHostiles } from './police.js';
import { animateVehicle, driveVehicle, groundGlow, removeVehicle, spawnVehicle } from './vehicles.js';

const skyVertex=
'varying vec3 vRay;\n\
void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const atmosphereFragment=
'varying vec3 vRay;\n\
uniform vec3 uSun; uniform float uDusk; uniform float uNight; uniform float uTime;\n\
float random2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n\
float grain(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);return mix(mix(random2(i),random2(i+vec2(1.,0.)),f.x),mix(random2(i+vec2(0.,1.)),random2(i+vec2(1.)),f.x),f.y);}\n\
void main(){\n\
  vec3 p=normalize(vRay); float y=max(0.0,p.y); float sun=max(0.0,dot(p,uSun));\n\
  vec3 horizon=mix(vec3(.89,.70,.52),vec3(.91,.39,.43),uDusk);\n\
  vec3 height=mix(vec3(.23,.55,.75),vec3(.18,.22,.55),uDusk);\n\
  horizon=mix(horizon,vec3(.16,.22,.37),uNight); height=mix(height,vec3(.035,.064,.16),uNight);\n\
  vec3 c=mix(horizon,height,pow(smoothstep(.015,.74,y),.49));\n\
  c+=vec3(.23,.15,.056)*pow(sun,13.0)*(1.0-uNight*.97);\n\
  c+=vec3(.35,.24,.092)*pow(sun,120.0)*(1.0-uNight);\n\
  c=mix(c,vec3(1.0,.92,.70),smoothstep(.99935,.9996,sun)*(1.0-uNight));\n\
  vec2 q=p.xz/(.19+y);q+=vec2(uTime*.0009,-.4);\n\
  float n=grain(q*vec2(2.6,10.0))*.59+grain(q*vec2(7.,27.))*.24+grain(q*vec2(21.,70.))*.12;\n\
  float clouds=smoothstep(.60,.79,n)*smoothstep(.025,.18,y)*smoothstep(.83,.28,y);\n\
  c=mix(c,mix(vec3(1.0,.81,.67),vec3(.36,.34,.52),uDusk*.46+uNight*.44),clouds*.71);\n\
  float stars=step(.9984,random2(floor(p.xz/(.2+y)*1100.0)))*smoothstep(.11,.58,y);\n\
  c+=vec3(stars*uNight*.58);\n\
  gl_FragColor=vec4(c,1.0);\n\
}';

const seaVertex=
'uniform float uTime; varying vec3 vAt;\n\
void main(){vec4 p=modelMatrix*vec4(position,1.0); vAt=p.xyz; gl_Position=projectionMatrix*viewMatrix*p;}';
const seaFragment=
'varying vec3 vAt; uniform vec3 uSun; uniform float uDusk; uniform float uNight; uniform float uTime;\n\
void main(){\n\
  vec3 eye=normalize(cameraPosition-vAt); vec2 p=vAt.xz;\n\
  float t=uTime;\n\
  float a=sin(p.x*.29+p.y*.119-t*1.6), b=sin(p.y*.67-p.x*.22+t*1.41);\n\
  float c=sin(p.x*1.17+p.y*.92-t*2.86), d=sin(p.y*2.7-p.x*.48+t*1.38);\n\
  float distanceToEye=distance(cameraPosition,vAt);\n\
  float detail=1.0-smoothstep(145.0,550.0,distanceToEye);\n\
  float ripples=1.0-smoothstep(300.0,810.0,distanceToEye);\n\
  vec3 n=normalize(vec3((a*.084+b*.049)*ripples+c*.035*detail,1.0,b*.076*ripples+d*.047*detail));\n\
  float fres=pow(1.0-max(.0,dot(n,eye)),3.2);\n\
  float shine=pow(max(.0,dot(reflect(-uSun,n),eye)),56.0);\n\
  float shore=144.0+8.0*sin(p.y*.016)+3.8*sin(p.y*.037);\n\
  float coast=(1.0-smoothstep(0.0,91.0,p.x-shore))*smoothstep(-13.0,2.0,p.x-shore)*(1.0-smoothstep(373.0,409.0,abs(p.y)));\n\
  vec3 deep=mix(vec3(.075,.35,.45),vec3(.13,.26,.37),uDusk);\n\
  vec3 shelf=mix(vec3(.09,.67,.64),vec3(.13,.55,.55),uDusk);\n\
  vec3 sky=mix(vec3(.48,.63,.70),vec3(.47,.33,.45),uDusk);\n\
  vec3 ocean=mix(mix(deep,shelf,coast),sky,fres*.58);\n\
  float path=pow(max(0.0,dot(normalize(vAt.xz-cameraPosition.xz),normalize(uSun.xz))),23.0);\n\
  ocean+=vec3(.71,.47,.22)*(shine+path*max(0.0,a*b)*.26*detail)*(1.0-uNight);\n\
  ocean+=vec3(.040,.074,.071)*(a*.34+b*.31+c*.19+d*.16)*detail;\n\
  float foam=sin((p.x-shore)*1.19+sin(p.y*.14)*.9-t*2.0)*sin(p.y*.38+t*.3);\n\
  ocean+=vec3(.60,.72,.63)*smoothstep(.52,1.0,foam)*coast*exp(-abs(p.x-shore-3.0)*.104)*.51;\n\
  vec3 haze=mix(vec3(.72,.65,.55),vec3(.62,.43,.45),uDusk);\n\
  ocean=mix(ocean,haze,smoothstep(390.0,3600.0,distanceToEye)*.94);\n\
  ocean*=mix(1.0,.43,uNight);\n\
  gl_FragColor=vec4(ocean,1.0);\n\
}';

function createCoastalLighting(scene){
  const uniforms={uSun:{value:new THREE.Vector3()},uDusk:{value:0},uNight:{value:0},uTime:{value:0}};
  const skyMat=new THREE.ShaderMaterial({uniforms,vertexShader:skyVertex,fragmentShader:atmosphereFragment,side:THREE.BackSide,depthWrite:false,toneMapped:false});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(3100,36,16),skyMat);
  sky.renderOrder=-20;scene.add(sky);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(8300,8300),new THREE.ShaderMaterial({
    uniforms,vertexShader:seaVertex,fragmentShader:seaFragment,toneMapped:false,
  }));
  sea.rotation.x=-Math.PI/2;sea.position.y=-.73;scene.add(sea);
  const sun=new THREE.DirectionalLight(0xffd4a0,2.5);
  sun.castShadow=true;
  sun.shadow.camera.left=-39;sun.shadow.camera.right=39;
  sun.shadow.camera.top=31;sun.shadow.camera.bottom=-35;
  sun.shadow.camera.near=1;sun.shadow.camera.far=195;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.bias=-.00067;sun.shadow.normalBias=.014;sun.shadow.radius=2.2;
  scene.add(sun,sun.target);
  const hemi=new THREE.HemisphereLight(0xd2e8ff,0xbd8973,2.0);
  scene.add(hemi);
  return {sky,uniforms,sun,hemi};
}

function paintedReflection(renderer,scene){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,0,128);
  grad.addColorStop(0,'#598bb4');grad.addColorStop(.31,'#a2cfdf');grad.addColorStop(.46,'#f8d5aa');
  grad.addColorStop(.50,'#eeab83');grad.addColorStop(.53,'#547682');grad.addColorStop(1,'#222638');
  ctx.fillStyle=grad;ctx.fillRect(0,0,256,128);
  const light=ctx.createRadialGradient(174,47,1,174,47,28);
  light.addColorStop(0,'#fff6d8');light.addColorStop(1,'#ffba6f00');
  ctx.fillStyle=light;ctx.fillRect(0,0,256,128);
  const texture=new THREE.CanvasTexture(c);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromEquirectangular(texture).texture;
  scene.environmentIntensity=.68;
  texture.dispose();pmrem.dispose();
}

const dayFog=new THREE.Color(0xc5a894);
const duskFog=new THREE.Color(0xb686a4);
const nightFog=new THREE.Color(0x323b64);
const sunOffset=new THREE.Vector3();
const camPos=new THREE.Vector3(),camLook=new THREE.Vector3();

function createSearchlight(scene){
  const lamp=new THREE.SpotLight(0xffebbf,0,150,.19,.26,1.35);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1,1,32,1,true),new THREE.ShaderMaterial({
    vertexShader:`varying vec3 vNormal;varying vec3 vPos;varying float vAlong;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vPos=p.xyz;
      vNormal=normalize(normalMatrix*normal);vAlong=position.y+.5;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 vNormal;varying vec3 vPos;varying float vAlong;
      void main(){float rim=1.0-abs(dot(normalize(vNormal),normalize(-vPos)));
      float glow=(.12+pow(rim,2.)*.34)*smoothstep(.01,.12,vAlong);
      gl_FragColor=vec4(1.,.95,.75,glow);}`,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,toneMapped:false,
  }));
  const axis=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  scene.add(lamp,lamp.target,cone);
  const footprint=groundGlow(scene,'#ffdea2',0,0,1,1,.48);
  return sim=>{
    const heli=sim.police.air;
    const p=sim.focus();
    cone.visible=Boolean(heli&&p.y<8);
    footprint.visible=cone.visible;
    lamp.intensity=0;
    if(!cone.visible)return;
    const angle=heli.yaw;
    lamp.position.set(heli.pos.x+Math.sin(angle)*1.9,heli.pos.y+.68,heli.pos.z-Math.cos(angle)*1.9);
    const sweep=sim.police.spotlight?0:9;
    lamp.target.position.set(p.x+sweep*Math.sin(sim.time*2),Math.max(0,p.y-3),p.z+Math.cos(sim.time*2)*sweep);
    axis.subVectors(lamp.position,lamp.target.position);
    const len=axis.length(),r=Math.tan(lamp.angle)*len;
    if(len<.05)return;
    cone.position.copy(lamp.target.position).lerp(lamp.position,.5);
    cone.quaternion.setFromUnitVectors(up,axis.normalize());cone.scale.set(r,len,r);
    footprint.position.set(lamp.target.position.x,.095,lamp.target.position.z);
    footprint.scale.set(r*1.72,r*2.55,1);
    lamp.intensity=sim.police.spotlight?410:155;
  };
}

export function createEngine(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.14;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xcab39c);
  scene.fog=new THREE.FogExp2(0xcab39c,.00148);
  const camera=new THREE.PerspectiveCamera(64,1,.12,4500);
  const lighting=createCoastalLighting(scene);
  paintedReflection(renderer,scene);
  const world=buildSolarisKeys(scene);
  const searchlight=createSearchlight(scene);

  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize',resize);

  function draw(sim,dt){
    const focus=sim.focus(), own=sim.player.vehicle;
    let fov=64;
    if(sim.director?.preview){
      const preview=sim.director.preview;
      camPos.set(...preview.eye);camLook.set(...preview.target);fov=preview.fov??59;
      if(preview.drift){
        camPos.x+=Math.sin(sim.time*.18)*3.8;camPos.z+=Math.sin(sim.time*.12)*7.1;
        camLook.x+=Math.sin(sim.time*.17)*4.7;
      }
    }else{
      const yaw=(own?.yaw??sim.player.yaw)+sim.player.orbit;
      const dirX=Math.sin(yaw),dirZ=-Math.cos(yaw);
      const sideX=Math.cos(yaw),sideZ=Math.sin(yaw);
      const flying=Boolean(own?.parts.mainRotor);
      const fast=Math.min(1,Math.abs(own?.speed??0)/48);
      const profile=own?(flying?[13.0,5.5,2.8]:own.parts.water?[8.4,3.3,1.2]:[6+fast*1.8,2.67+fast*.42,.76]):[3.3,1.99,.91];
      const view=sim.player.camera;
      if(view===1){profile[0]*=.66;profile[1]*=.77;profile[2]*=-1.3;}
      if(view===2){profile[0]=own?-1.45:.06;profile[1]=own?1.35:1.70;profile[2]=0;}
      if(view===3){profile[0]*=1.54;profile[1]+=flying?4.4:4.8;profile[2]*=2;}
      const lift=sim.player.pitch*(view===2?0:.8);
      camPos.set(focus.x-dirX*profile[0]+sideX*profile[2],focus.y+profile[1]-lift,focus.z-dirZ*profile[0]+sideZ*profile[2]);
      if(!flying&&view!==2&&!world.canMove(camPos.x,camPos.z,camPos.y,.16)){
        camPos.set(focus.x-dirX*profile[0]*.47+sideX*.35,focus.y+profile[1]+.3,focus.z-dirZ*profile[0]*.47+sideZ*.35);
      }
      const lookAhead=own?(flying?26:15):24;
      camLook.set(focus.x+dirX*lookAhead,focus.y+(own?1.20:1.63)+sim.player.pitch*lookAhead,focus.z+dirZ*lookAhead);
      fov=own?59+fast*8:63;
      if(view===2)fov=73;
    }
    if(sim.director||sim.cameraCut)camera.position.copy(camPos);
    else camera.position.lerp(camPos,1-Math.exp(-dt*9.3));
    sim.cameraCut=false;
    camera.lookAt(camLook);
    if(Math.abs(camera.fov-fov)>.02){camera.fov=fov;camera.updateProjectionMatrix();}
    lighting.sky.position.copy(camera.position);
    const hour=sim.clock;
    const evening=clamp((hour-17.0)/3.1,0,1);
    const night=clamp((hour-19.0)/3,0,1)+clamp((5.9-hour)/3,0,1);
    const high=clamp(Math.sin((hour-5.2)*Math.PI/14),.04,.91);
    const pos=lighting.uniforms.uSun.value.set(.49,high*.47+.024,-.89).normalize();
    lighting.uniforms.uTime.value=sim.time;
    lighting.uniforms.uDusk.value=evening;
    lighting.uniforms.uNight.value=night;
    lighting.hemi.intensity=1.86-night*1.06-evening*.22;
    lighting.sun.intensity=2.39-night*2.12-evening*.83;
    lighting.sun.color.setRGB(1,.83-evening*.21,.66-evening*.19);
    lighting.hemi.color.setRGB(.67-evening*.04,.81-evening*.15,1);
    scene.fog.color.copy(dayFog).lerp(duskFog,evening).lerp(nightFog,night);
    scene.fog.density=sim.director?.preview?.wide ? .00102 : .00136;
    const frameFocus=sim.director?.preview?.wide?sim.player.person.group.position:focus;
    lighting.sun.target.position.set(frameFocus.x,0,frameFocus.z);
    lighting.sun.position.copy(lighting.sun.target.position).add(sunOffset.copy(pos).multiplyScalar(129));
    searchlight(sim);
    renderer.render(scene,camera);
  }

  return {renderer,scene,world,camera,draw};
}

const actions={
  forward:['KeyW','ArrowUp'], back:['KeyS','ArrowDown'], left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'],
  boost:['ShiftLeft','ShiftRight'], brake:['Space'], descend:['ControlLeft','ControlRight'],
};

export function connectControls(canvas,onAction,onLook){
  const keys=new Set();
  const result={firing:false,tap:false,aim:false};
  const gameKeys=new Set([...Object.values(actions).flat(),'KeyF','KeyE','KeyR','KeyM','KeyV','KeyT','KeyZ','KeyX','KeyC','KeyQ','Escape']);
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey&&['KeyR','KeyW','KeyT'].includes(e.code))return;
    if(gameKeys.has(e.code)&&e.target.tagName!=='BUTTON')e.preventDefault();
    keys.add(e.code);
    if(!e.repeat)onAction(e.code);
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();result.firing=false;result.tap=false;result.aim=false;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('mousedown',e=>{
    if(e.button===0){result.firing=true;result.tap=true;}
    if(e.button===2)result.aim=true;
    onAction('Pointer');
  });
  window.addEventListener('mouseup',e=>{
    if(e.button===0)result.firing=false;
    if(e.button===2)result.aim=false;
  });
  canvas.addEventListener('mousemove',e=>{
    if(document.pointerLockElement===canvas||e.buttons>0)onLook(e.movementX,e.movementY);
  });
  for(const [name,list] of Object.entries(actions))Object.defineProperty(result,name,{get:()=>list.some(key=>keys.has(key))});
  return result;
}

export function createSimulation(engine){
  const sim={
    ...engine,time:0,clock:16.6,fastClock:false,mode:'start',director:null,cameraCut:true,
    audio:createAudio(),police:createDispatch(),vehicles:[],pedestrians:[],syndicate:[],career:emptyCareer(),
    stats:{money:450,rp:0,control:[0,0,0,0,0,0]},messages:{notice:'',until:0,crew:'Vega',line:'',commsUntil:0},
    cooldowns:[0,0,0],hitUntil:0,hitMarkerUntil:0,impactAt:0,aimUntil:0,
  };
  const person=createWalker(sim.scene,'mateo',0);
  person.group.position.set(HOME.x-1,0,HOME.z+5);
  const player={person,vehicle:null,yaw:0,orbit:0,pitch:0,camera:0,health:100,armor:50};
  sim.player=player;
  sim.focus=()=>player.vehicle?.pos??person.group.position;
  sim.notice=(text)=>{sim.messages.notice=text;sim.messages.until=sim.time+3.8;};
  sim.speak=(crew,line)=>{sim.messages.crew=crew;sim.messages.line=line;sim.messages.commsUntil=sim.time+8.3;};
  sim.hurt=amount=>{
    if(sim.missions.stage>0)sim.missions.damage+=amount;
    const shield=Math.min(player.armor,amount*.73);
    player.armor-=shield;player.health=Math.max(0,player.health-(amount-shield));
    sim.hitUntil=sim.time+.34;
    if(!player.health)sim.mode='down';
  };
  sim.missions=createMissionDirector(sim);
  sim.combat=createCombat(sim);
  sim.updateHostiles=(actors,dt)=>updateHostiles(sim,actors,dt);
  populateCity(sim);

  sim.resetActors=()=>{
    player.vehicle=null;player.cover=false;
    clearWanted(sim);
    Object.assign(sim.police,createDispatch());
    for(const car of sim.vehicles)removeVehicle(sim.scene,car);
    for(const p of [...sim.pedestrians,...sim.syndicate])sim.scene.remove(p.group);
    sim.pedestrians.length=sim.syndicate.length=sim.vehicles.length=0;
    if(sim.mira)sim.scene.remove(sim.mira.group);
    sim.mira=null;
    sim.combat.reset();
    populateCity(sim);
  };

  sim.summonMira=(call=true)=>{
    if(player.vehicle)return;
    if(!sim.mira){
      sim.mira=createWalker(sim.scene,'mira',4);
      sim.mira.group.position.copy(sim.focus());
      sim.mira.group.position.x-=1.7;
      sim.mira.cooldown=.14;sim.mira.radioAt=sim.time+3;
    }
    sim.mira.group.visible=true;
    if(call)sim.speak('Mira','I’m on foot with you. I’ll take the nearest cover.');
    return sim.mira;
  };

  sim.boardBoat=()=>{
    let v=sim.vehicles.find(car=>car.type==='boat'&&!car.wrecked&&Math.hypot(car.pos.x-330,car.pos.z+46)<17);
    v??=stageTrafficCar(sim,'boat',330,-46,Math.PI);
    sim.takeVehicle(v);
  };

  sim.nearestVehicle=()=>{
    const p=person.group.position;
    let nearest=null,best=5.6;
    for(const car of sim.vehicles){
      if(car.hull<=0||car.pos.y>2.5)continue;
      const d=Math.hypot(p.x-car.pos.x,p.z-car.pos.z);
      if(d<best){best=d;nearest=car;}
    }
    return nearest;
  };

  sim.takeVehicle=(car,restore=false)=>{
    if(!car)return;
    const stolen=car.stealable&&!restore;
    car.traffic=null;car.stealable=false;player.vehicle=car;player.pitch=0;player.orbit=0;
    player.cover=false;
    if(sim.mira)sim.mira.group.visible=false;
    player.yaw=car.yaw;
    person.group.visible=false; sim.cameraCut=true;
    if(stolen)raiseWanted(sim,1);
    sim.audio.effect('reload');
  };

  sim.leaveVehicle=()=>{
    const v=player.vehicle;
    if(!v){sim.takeVehicle(sim.nearestVehicle());return;}
    if(v.pos.y>3.2){sim.notice('LAND BEFORE EXITING');return;}
    let exit=null;
    for(const r of v.parts.water?[2.2,4.5,7.5,10]:[2.2,3.5]){
      for(const a of [0,Math.PI,Math.PI/2,-Math.PI/2]){
        const x=v.pos.x+Math.cos(v.yaw+a)*r,z=v.pos.z+Math.sin(v.yaw+a)*r;
        if(sim.world.canMove(x,z,0,.4)){exit=[x,0,z];break;}
      }
      if(exit)break;
    }
    if(!exit){sim.notice('DOCK AT THE PIER BEFORE EXITING');return;}
    person.group.position.set(...exit);
    player.yaw=v.yaw;player.orbit=0;player.pitch=0;
    player.vehicle=null;person.group.visible=true;v.speed=0;v.boost=false;sim.cameraCut=true;
  };

  sim.respawn=()=>{
    clearWanted(sim);
    if(player.vehicle){player.vehicle.speed=0;player.vehicle.boost=false;}
    player.vehicle=null;player.health=100;player.armor=40;player.pitch=0;player.orbit=0;player.yaw=0;player.cover=false;
    person.group.visible=true;person.group.position.set(HOME.x,0,HOME.z+3);
    sim.stats.money=Math.max(0,sim.stats.money-200);
    sim.mode='play';sim.cameraCut=true;
  };

  sim.useCrew=index=>{
    if(sim.cooldowns[index]>0){sim.notice('CREW ABILITY RECHARGING');return;}
    if(index===1&&!player.vehicle){sim.notice('GET INTO A VEHICLE FIRST');return;}
    sim.cooldowns[index]=Object.values(CREW)[index].cooldown;
    if(index===0){
      if(!player.vehicle){sim.summonMira();return;}
      if(sim.police.stars<=2)clearWanted(sim);
      else{sim.police.stars--;sim.police.jammed=4;}
      sim.speak('Mira','New plates are live. Stay out of their headlights.');
    }
    if(index===1){
      player.vehicle.hull=Math.min(100,player.vehicle.hull+54);player.vehicle.nitro=Math.min(100,player.vehicle.nitro+27);
      sim.speak('Rico','Bypassed the damage sensor. Keep it off the walls.');
    }
    if(index===2){sim.police.jammed=11;sim.speak('Vega','Their radio net just went quiet. You have eleven seconds.');}
  };

  return sim;
}

function moveMateo(sim,dt,input){
  const p=sim.player, at=p.person.group.position;
  const front=Number(input.forward)-Number(input.back), strafe=Number(input.right)-Number(input.left);
  if(front||strafe)p.cover=false;
  const length=Math.max(1,Math.hypot(front,strafe));
  const pace=input.boost?9.4:input.aim?3.0:5.65;
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  const dx=(front*s+strafe*c)*pace*dt/length,dz=(-front*c+strafe*s)*pace*dt/length;
  if(sim.world.canMove(at.x+dx,at.z,0,.32))at.x+=dx;
  if(sim.world.canMove(at.x,at.z+dz,0,.32))at.z+=dz;
  if(input.firing||input.aim)p.person.yaw=p.yaw;
  else if(front||strafe)p.person.yaw+=angleDelta(headingTo(dx,dz),p.person.yaw)*Math.min(1,dt*14);
  p.person.pace=front||strafe?pace:0;
}

function collideWithTraffic(sim,vehicle,dt){
  if(vehicle.pos.y>3||vehicle.parts.water)return;
  for(const other of sim.vehicles){
    if(other===vehicle||other.pos.y>3||other.parts.water)continue;
    const dx=vehicle.pos.x-other.pos.x,dz=vehicle.pos.z-other.pos.z,dist=Math.hypot(dx,dz);
    const radius=(vehicle.parts.radius+other.parts.radius)*.96;
    if(dist>=radius||dist<.001)continue;
    const nx=vehicle.pos.x+dx/dist*(radius-dist)*.43,nz=vehicle.pos.z+dz/dist*(radius-dist)*.43;
    if(sim.world.canMove(nx,nz,0,.6)){vehicle.pos.x=nx;vehicle.pos.z=nz;}
    const impact=Math.abs(vehicle.speed-other.speed)*dt*1.2;
    vehicle.hull=clamp(vehicle.hull-impact,0,100);
    other.hull=clamp(other.hull-impact*.62,0,100);
    vehicle.speed*=.89;other.speed*=.84;
    if(impact>.55&&sim.time>sim.impactAt+.25){
      sim.impactAt=sim.time;sim.audio.effect('hit');
      sim.combat.impact(vehicle.pos.clone().lerp(other.pos,.5).add(new THREE.Vector3(0,.65,0)),5);
      if(impact>1.15)raiseWanted(sim,Math.max(1,sim.police.stars));
    }
  }
}

export function advanceSimulation(sim,dt,input,interact){
  if(sim.mode==='hub'||sim.mode==='down'){
    input.tap=false;
    sim.audio.update(sim.player.vehicle,0,0,true);
    return;
  }
  sim.time+=dt;
  const live=sim.mode==='play';
  if(live&&!sim.director)sim.clock=(sim.clock+dt*(sim.fastClock?.53:.037))%24;
  if(live&&!sim.director){
    const p=sim.player;
    const v=p.vehicle;
    if(v){
      if(driveVehicle(v,input,dt,sim.world)&&sim.time>sim.impactAt+.20){
        sim.impactAt=sim.time;sim.audio.effect('hit');
        sim.combat.impact(v.pos.clone().add(new THREE.Vector3(0,.51,0)),5);
      }
      collideWithTraffic(sim,v,dt);
      if(!v.parts.water&&!v.parts.mainRotor){
        if(v.jump!=null&&v.pos.y===0){registerStunt(sim,v.jump);v.jump=null;v.vertical=0;}
        const ramp=v.jump==null&&v.speed>11?sim.world.rampAt(v):null;
        if(ramp!=null){v.jump=ramp;v.vertical=5.2+Math.min(3.8,v.speed*.095);v.pos.y=.76;}
        if((v.drift||v.boost&&v.speed>21)&&sim.time>(v.lastSkid??0)+.09&&v.pos.y<.1){
          v.lastSkid=sim.time;sim.combat.skid(v);
        }
      }
      if(v.hull<28&&Math.floor(sim.time*5)!==Math.floor((sim.time-dt)*5))sim.combat.trailSmoke(v.pos.clone().add(new THREE.Vector3(0,.64,0)));
      if(v.hull<=0){
        sim.combat.wreckVehicle(v);sim.leaveVehicle();
        sim.hurt(p.vehicle===v?140:38);
      }
    }else moveMateo(sim,dt,input);
    if(input.firing||input.tap){
      sim.aimUntil=sim.time+.32;
      sim.combat.shot(p.yaw+p.orbit,p.pitch);
    }
    p.orbit*=v?Math.exp(-dt*(input.aim?.13:1.46)):0;
    if(v)p.yaw=v.yaw;
    sim.cooldowns=sim.cooldowns.map(t=>Math.max(0,t-dt));
    updateCityLife(sim,dt);
    updateDispatch(sim,dt);
    updateMissionDirector(sim,dt,interact);
    if(!p.vehicle&&[2,3,4,7].includes(sim.missions.index)&&sim.missions.stage>0&&sim.police.stars>=3)sim.summonMira(false);
    updateMira(sim,dt);
    for(const car of sim.vehicles)if(car.hull<=0)sim.combat.wreckVehicle(car);
    for(const {car} of sim.police.units)if(car.hull<=0)sim.combat.wreckVehicle(car);
  }else if(sim.director){
    sim.director.animate?.(sim,dt);
    updateMissionDirector(sim,0,false);
  }
  input.tap=false;
  sim.world.animate(sim.time);
  sim.combat.update(dt,sim.time);
  const aim=sim.aimUntil>sim.time||Boolean(input.aim);
  if(!sim.player.vehicle){
    if(aim)sim.player.person.yaw=sim.player.yaw;
    sim.player.person.cover=sim.player.cover;
    animateWalker(sim.player.person,sim.time,aim,sim.combat.weapon);
  }
  for(const p of sim.pedestrians)if(p.group.visible)animateWalker(p,sim.time);
  const focus=sim.focus();
  const sight=sim.director?.preview?.wide||focus.y>18 ? 610 : 245;
  for(const v of sim.vehicles){
    v.root.visible=v.pos.distanceToSquared(focus)<sight*sight;
    if(v.root.visible)animateVehicle(v,dt,sim.time);
    else v.shade.visible=false;
  }
  for(const {car} of sim.police.units)animateVehicle(car,dt,sim.time);
  if(sim.police.air)animateVehicle(sim.police.air,dt,sim.time);
  const closest=sim.police.units.reduce((best,{car})=>Math.min(best,sim.focus().distanceTo(car.pos)),150);
  sim.audio.update(sim.player.vehicle,sim.police.stars,closest,sim.mode!=='play');
}

export function openVehicle(sim,type,x,z,yaw,y=0){
  const vehicle=spawnVehicle(sim.scene,type,x,z,yaw,y);
  sim.vehicles.push(vehicle);
  sim.takeVehicle(vehicle);
  return vehicle;
}

export function chooseTime(sim){
  const hours=[9.1,13,16.6,18.7,22.5];
  const next=hours.find(h=>h>sim.clock+.22)??hours[0];
  sim.clock=next;
  sim.notice('LOCAL TIME  /  '+clockLabel(next));
}

export function clockLabel(clock){
  const minutes=Math.floor(clock*60+1e-6);
  const h=Math.floor(minutes/60)%24,m=minutes%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
