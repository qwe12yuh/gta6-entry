import * as THREE from 'three';
import { VEHICLES, angleDelta, clamp, headingTo, isGround, tideLine } from './config.js';
import { policeLivery, shadowTexture } from './textures.js';

const cube = new THREE.BoxGeometry(1,1,1);
const tire = new THREE.CylinderGeometry(1,1,1,20);
const rounded = new THREE.SphereGeometry(1,16,10);
const bead = new THREE.IcosahedronGeometry(1,1);
const flat = new THREE.PlaneGeometry(1,1);
const material = (color, roughness=.47, metalness=.08)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const luminous = color => new THREE.MeshBasicMaterial({color,toneMapped:false});
const rubber = material(0x131821,.96);
const black = material(0x182432,.61);
const trim = material(0x282d33,.48,.35);
const alloy = material(0xa1a9af,.34,.58);
const pale = material(0xede4d9,.33,.26);
const glass = material(0x172d3c,.17,.58);
const lamp = luminous(0xfff2cc);
const brake = luminous(0xff3936);
const chrome = material(0xf1d5b4,.23,.59);
const azure = luminous(0x396bff);
const cherry = luminous(0xff2546);
const nitroCore = luminous(0xe3fbff);
const nitroHalo = new THREE.MeshBasicMaterial({color:0x428dff,toneMapped:false,transparent:true,opacity:.83,depthWrite:false,blending:THREE.AdditiveBlending});
const exhaust = new THREE.ConeGeometry(1,1,12,2,true).rotateX(Math.PI/2);
const colors=new Map();
const glowingTextures=new Map();

export function panel(group,m,x,y,z,w,h,d,rx=0,ry=0,rz=0) {
  const mesh=new THREE.Mesh(cube,m);
  mesh.position.set(x,y,z);
  mesh.scale.set(w,h,d);
  mesh.rotation.set(rx,ry,rz);
  group.add(mesh);
  return mesh;
}

function modelPart(group, geo,m,x,y,z,w,h,d) {
  const mesh=new THREE.Mesh(geo,m);
  mesh.position.set(x,y,z);
  mesh.scale.set(w,h,d);
  group.add(mesh);
  return mesh;
}

function compactPanels(group){
  const buckets=new Map();
  for(const part of group.children){
    if(part.geometry!==cube||Array.isArray(part.material))continue;
    if(!buckets.has(part.material))buckets.set(part.material,[]);
    buckets.get(part.material).push(part);
  }
  for(const [material,parts] of buckets){
    if(parts.length<3)continue;
    const instanced=new THREE.InstancedMesh(cube,material,parts.length);
    parts.forEach((part,index)=>{
      part.updateMatrix();
      instanced.setMatrixAt(index,part.matrix);
    });
    instanced.computeBoundingSphere();
    group.remove(...parts);group.add(instanced);
  }
}

function paint(color) {
  if(!colors.has(color))colors.set(color,new THREE.MeshPhysicalMaterial({
    color,roughness:.31,metalness:.28,clearcoat:1,clearcoatRoughness:.19,side:THREE.DoubleSide,
  }));
  return colors.get(color);
}

function glowMap(hex) {
  if(!glowingTextures.has(hex)){
    const c=document.createElement('canvas');c.width=c.height=64;
    const ctx=c.getContext('2d');
    const grad=ctx.createRadialGradient(32,32,0,32,32,32);
    grad.addColorStop(0,'#fffbd8ff'); grad.addColorStop(.16,hex+'bd');
    grad.addColorStop(.44,hex+'37');grad.addColorStop(1,hex+'00');
    ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
    glowingTextures.set(hex,new THREE.CanvasTexture(c));
  }
  return glowingTextures.get(hex);
}

export function lightBloom(parent,color,x,y,z,size) {
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
    map:glowMap(color), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    toneMapped:false, opacity:.82,
  }));
  sprite.position.set(x,y,z);
  sprite.scale.setScalar(size);
  parent.add(sprite);
  return sprite;
}

export function groundGlow(parent,color,x,z,width,length,opacity=.5) {
  const mesh=new THREE.Mesh(flat,new THREE.MeshBasicMaterial({
    map:glowMap(color),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    toneMapped:false,opacity,
  }));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.076,z);mesh.scale.set(width,length,1);
  parent.add(mesh);
  return mesh;
}

const charred=material(0x211a1a,.98);
export function charVehicle(v){
  v.body.traverse(part=>{
    if(part.isMesh)part.material=charred;
    if(part.isSprite)part.visible=false;
  });
  for(const reflection of v.parts.reflections??[])reflection.visible=false;
  v.boost=false;v.speed=0;v.drift=false;
}

function shapeCoachwork(group,m,rings) {
  const positions=[], idx=[];
  const stride=8;
  for(const [z,w,b,t] of rings){
    positions.push(-w*.77,b,z,w*.77,b,z,w,b+.10,z,w,t-.1,z,w*.79,t,z,-w*.79,t,z,-w,t-.1,z,-w,b+.10,z);
  }
  for(let i=1;i<rings.length;i++)for(let e=0;e<stride;e++){
    const a=(i-1)*stride+e,b=(i-1)*stride+(e+1)%stride,c=a+stride,d=b+stride;
    idx.push(a,c,b,b,c,d);
  }
  for(let i=1;i<stride-1;i++){
    idx.push(0,i,i+1);
    const a=(rings.length-1)*stride;
    idx.push(a,a+i+1,a+i);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,m);
  mesh.castShadow=true;
  group.add(mesh);
  return mesh;
}

function cabinet(group,m,wide,roofHeight,front,back,extension) {
  const doubleGlass=glass.clone();
  doubleGlass.side=THREE.DoubleSide;
  shapeCoachwork(group,doubleGlass,[
    [front,wide*.93,.89,.96],
    [front+extension,wide*.67,.90,roofHeight],
    [back-extension*.75,wide*.68,.89,roofHeight-.01],
    [back,wide*.94,.88,.96],
  ]);
  panel(group,m,0,roofHeight+.007,(front+back)/2,wide*1.29,.065,Math.max(.38,back-front-extension*1.63));
  for(const side of [-1,1]){
    panel(group,black,side*wide*.70,(roofHeight+.9)/2,(front+back)/2,.06,roofHeight-.85,.07,0,0,-side*.16);
    panel(group,m,side*wide*.89,.79,front+.19,.20,.10,.26,0,side*.22);
    panel(group,glass,side*wide*1.11,.88,front+.23,.26,.13,.23,0,side*.15);
    panel(group,alloy,side*wide*.93,.70,.18,.029,.05,.26);
  }
}

function makeWheel(group,x,z,r,w,side) {
  const pivot=new THREE.Group();
  pivot.position.set(x,r+.035,z);
  group.add(pivot);
  const rolling=new THREE.Group();
  pivot.add(rolling);
  const yaw=side>0?Math.PI/2:-Math.PI/2;
  const tread=modelPart(rolling,tire,rubber,0,0,0,r,w,r);
  tread.rotation.z=yaw;
  const rim=modelPart(rolling,tire,alloy,side*(w*.49),0,0,r*.68,.041,r*.68);
  rim.rotation.z=yaw;
  const inset=modelPart(rolling,tire,black,side*(w*.58),0,0,r*.53,.035,r*.53);
  inset.rotation.z=yaw;
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    panel(rolling,chrome,side*w*.66,Math.cos(a)*r*.24,Math.sin(a)*r*.24,.041,r*.57,.062,a);
  }
  compactPanels(rolling);
  modelPart(rolling,bead,alloy,side*w*.69,0,0,.034,r*.16,r*.16);
  return {pivot,rolling};
}

function buildRoadVehicle(group,type,spec) {
  const m=paint(spec.color);
  const low=spec.style==='apex';
  const high=spec.style==='suv';
  const police=type==='police'||type==='swat';
  const w=low?1.06:high?1.13:.98;
  const L=low?2.33:high?2.45:2.30;
  const top=low?.78:high?1.18:.97;
  const wheels=[];
  if(spec.style==='moto'){
    wheels.push(makeWheel(group,0,-.94,.34,.16,1),makeWheel(group,0,1.02,.38,.21,1));
    shapeCoachwork(group,m,[[-.92,.26,.55,.97],[-.31,.35,.48,1.22],[.18,.30,.45,.98],[.91,.23,.51,.85]]);
    panel(group,black,0,.98,.47,.37,.13,.65);
    panel(group,alloy,0,1.15,-.68,.79,.06,.09);
    panel(group,lamp,0,1,-.99,.33,.19,.08);
    panel(group,brake,0,.94,.94,.28,.09,.05);
    return {wheels,radius:1.0};
  }
  const rings=low?[
    [-L,w*.75,.26,.53],[-L+.37,w*.98,.24,.71],[-1.19,w,.23,.80],[-.44,w*.95,.27,.85],
    [.48,w*.94,.27,.86],[1.30,w*1.04,.24,.92],[L-.25,w*1.025,.25,.86],[L,w*.90,.30,.66],
  ]:[
    [-L,w*.93,.27,top-.29],[-L+.28,w,.24,top-.12],[-1.10,w,.23,top],[-.45,w,.25,top],
    [.88,w,.27,top],[L-.34,w,.25,top-.03],[L,w*.92,.28,top-.18],
  ];
  const coachwork=shapeCoachwork(group,police?paint(0x2b3d54):m,rings);
  cabinet(group,m,w,low?1.26:high?1.88:1.49,low?-1.36:-1.09,high?1.95:1.43,low?.85:high?.45:.60);
  for(const side of [-1,1]) {
    for(const z of [-1.45,1.48]) wheels.push(makeWheel(group,side*w*.87,z,low?.37:high?.43:.36,.30,side));
    panel(group,black,side*w*.93,.31,.04,.24,.16,1.98);
    panel(group,low?chrome:trim,side*w*1.025,.38,.08,.034,.063,1.68);
    if(low){
      panel(group,trim,side*w*.97,.64,.90,.06,.31,.83,0,-side*.09,-side*.15);
      panel(group,m,side*w*.65,.56,-L+.12,.45,.08,.71,-.17,side*.1);
      panel(group,brake,side*w*.56,.718,L-.008,.56,.075,.077,0,-side*.15,-side*.09);
      panel(group,brake,side*w*.75,.665,L-.013,.22,.059,.073,0,-side*.15,-side*.09);
    } else {
      panel(group,brake,side*w*.78,top-.23,L-.02,.30,.16,.086);
      panel(group,pale,side*w*.77,top-.34,L-.031,.23,.045,.089);
    }
    panel(group,lamp,side*w*.71,top-.21,-L+.065,low?.49:.34,low?.085:.14,.135,0,side*.18,side*.09);
    if(police)panel(group,policeDoor(type),side*(w+.015),top-.28,.12,.036,high?.52:.46,1.92);
  }
  panel(group,trim,0,.43,-L-.013,w*1.08,.23,.115);
  panel(group,black,0,.39,L+.015,w*1.42,.19,.1);
  panel(group,m,0,.26,-L-.04,w*1.72,.06,.18);
  panel(group,alloy,0,.51,L+.06,.37,.13,.027);
  panel(group,black,0,.515,L+.077,.29,.055,.018);
  if(low){
    for(const side of [-1,1]){
      panel(group,black,side*.63,1.02,1.94,.09,.28,.21,.08);
      panel(group,chrome,side*.56,.43,L+.071,.35,.12,.16);
      panel(group,black,side*.56,.432,L+.153,.28,.071,.02);
    }
    panel(group,black,0,1.16,1.96,1.94,.078,.38,-.09);
    panel(group,m,0,1.217,1.95,1.96,.046,.26,-.09);
    panel(group,brake,0,.737,L+.005,1.11,.028,.029);
    panel(group,chrome,0,.675,L+.016,.16,.11,.036,0,0,Math.PI/4);
    for(const edge of [-1,1])for(let i=0;i<3;i++)panel(group,trim,edge*(.52+i*.10),.534,L+.027,.032,.12,.099,.35,0,edge*.08);
  }
  if(type==='taxi'){
    panel(group,black,0,1.53,.02,.61,.10,.27);
    panel(group,lamp,0,1.62,.02,.55,.14,.24);
  }
  const lights=[],reflections=[];
  if (police){
    const y=high?1.99:1.57;
    panel(group,black,0,y,.19,1.53,.13,.34);
    panel(group,cherry,-.45,y+.083,.19,.61,.13,.29);
    panel(group,azure,.45,y+.083,.19,.61,.13,.29);
    panel(group,pale,0,y+.085,.19,.29,.12,.28);
    lights.push(lightBloom(group,'#ff1b51',-.47,y+.1,.24,2.7),lightBloom(group,'#366dff',.47,y+.1,.24,2.8));
    reflections.push(groundGlow(group,'#ff1b51',-2.1,1,5.4,14,.47),groundGlow(group,'#366dff',2.1,1.5,5.6,15,.59));
    lightBloom(group,'#fff1cb',-.69,top-.21,-L-.04,1.25);
    lightBloom(group,'#fff1cb',.69,top-.21,-L-.04,1.25);
    for(const side of [-1,1]){
      panel(group,black,side*.74,.46,-L-.17,.13,.48,.25);
      panel(group,alloy,side*.35,y+.19,1.22,.027,.62,.024,.32);
    }
    panel(group,trim,0,.64,-L-.24,1.64,.12,.12);
  }
  const boosters=[];
  if(low){
    for(const x of [-.54,.54]){
      const flame=new THREE.Group();
      flame.position.set(x,.45,L+.20);
      const shell=modelPart(flame,exhaust,nitroHalo,0,0,.94,.26,.21,1.88);
      modelPart(flame,exhaust,nitroCore,0,0,.45,.115,.09,.90);
      lightBloom(flame,'#2d75ff',0,0,.13,2.3);
      flame.visible=false;
      group.add(flame);boosters.push({flame,shell});
    }
  }
  return {wheels,lights,boosters,coachwork,reflections,radius:1.45};
}

const decals=new Map();
function policeDoor(type){
  if(!decals.has(type)){
    const texture=policeLivery(type==='swat'?'SENTINEL':'SKPD','#e7b459');
    decals.set(type, [
      trim,trim,trim,trim,trim,trim,
    ].map((part,i)=>i<2?new THREE.MeshStandardMaterial({map:texture,roughness:.56}):part));
  }
  return decals.get(type);
}

function buildHelicopter(group,spec,type){
  const m=paint(spec.color);
  const body=modelPart(group,rounded,m,0,1.04,-.39,1.09,.96,2.29);
  body.castShadow=true;
  modelPart(group,rounded,glass,0,1.22,-1.43,1.065,.72,1.48);
  shapeCoachwork(group,m,[[.79,.75,.62,1.60],[2.51,.41,.83,1.61],[5.5,.12,1.07,1.43]]);
  panel(group,m,0,1.68,5.25,.23,1.26,.60,.36);
  panel(group,m,0,1.16,4.37,2.3,.10,.54);
  panel(group,m,0,1.88,-1.02,.11,.14,1.37,-.21);
  for(const side of [-1,1]){
    panel(group,glass,side*.975,1.33,.03,.11,.57,1.33,0,side*.11);
    panel(group,chrome,side*1.03,.91,.52,.055,.07,.23);
    panel(group,m,side*.99,1.73,.19,.13,.15,1.50);
    panel(group,trim,side*1.03,.84,.27,.052,.21,1.68);
    panel(group,pale,side*.86,1.28,2.03,.075,.085,1.5,0,side*.13);
    panel(group,pale,side*.26,1.22,4.27,.045,.10,.83,0,side*.11);
    panel(group,alloy,side*.84,.21,.25,.10,.73,.11,0,0,side*.29);
    panel(group,alloy,side*.84,.22,-1.38,.10,.65,.11,0,0,side*.29);
    panel(group,trim,side*1.06,.057,-.43,.12,.11,3.61);
    panel(group,trim,side*1.06,.13,-2.20,.12,.10,.27,.57);
  }
  const mainRotor=new THREE.Group();
  mainRotor.position.set(0,2.39,-.25);
  panel(group,alloy,0,2.12,-.25,.15,.61,.15);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    panel(mainRotor,black,Math.sin(a)*2.15,0,Math.cos(a)*2.15,.17,.046,4.35,0,a);
    panel(mainRotor,pale,Math.sin(a)*4.06,.015,Math.cos(a)*4.06,.19,.055,.34,0,a);
  }
  const blur=new THREE.Mesh(new THREE.RingGeometry(.7,4.31,48),new THREE.MeshBasicMaterial({
    color:0x9eaab9,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false,
  }));
  blur.rotation.x=-Math.PI/2;
  mainRotor.add(blur);
  group.add(mainRotor);
  const tailRotor=new THREE.Group();
  tailRotor.position.set(.18,1.6,5.40);
  panel(tailRotor,black,0,0,0,.05,1.74,.14);
  panel(tailRotor,black,0,0,0,.05,1.8,.14,Math.PI/2);
  group.add(tailRotor);
  lightBloom(group,'#ff3e32',-.93,1.1,.18,1);
  lightBloom(group,'#72fbbb',.93,1.1,.18,1);
  const light=lightBloom(group,'#ffeca6',0,.69,-2.58,1.63);
  if(type==='falcon')light.scale.setScalar(3.7);
  return {wheels:[],mainRotor,tailRotor,radius:2.15};
}

function buildSpeedboat(group,spec){
  const hull=paint(spec.color);
  const coachwork=shapeCoachwork(group,hull,[[-3.1,.08,.05,.52],[-1.8,.87,-.39,.64],[1.9,1.1,-.37,.61],[2.7,.94,-.25,.58]]);
  modelPart(group,rounded,glass,0,.67,-.5,.79,.44,.69);
  panel(group,pale,0,.59,1.15,1.49,.21,1.7);
  panel(group,alloy,0,.47,2.6,1.6,.42,.29);
  for(const side of [-1,1])panel(group,azure,side*.81,.55,.66,.10,.085,3.4);
  lightBloom(group,'#78f6e0',.82,.63,-1.37,1.05);
  lightBloom(group,'#ff554e',-.82,.63,-1.37,1.05);
  return {wheels:[],radius:1.6,water:true,coachwork};
}

const wakeGeometry=new THREE.PlaneGeometry(13,34).rotateX(-Math.PI/2);
const wakeShaders={
  vertexShader:`varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vUv; uniform float phase;uniform float opacity;
    void main(){
      float along=1.0-vUv.y;
      float across=abs(vUv.x-.5);
      float trail=exp(-abs(across-(.045+along*.39))*28.);
      float prop=exp(-across*across/(.007+along*.022))*.58;
      float chop=pow(.5+.5*sin(along*132.-phase*13.+across*28.),2.);
      float broken=.56+.44*sin(along*77.+across*106.+sin(across*56.-phase*.8));
      gl_FragColor=vec4(.85,1.,.96,(trail*.78+prop*chop)*broken*(1.-along)*opacity);
    }`,
};

let shadowMaterial;
export function spawnVehicle(scene,type,x,z,yaw=0,y=0) {
  const spec=VEHICLES[type];
  const root=new THREE.Group();
  root.position.set(x,y,z);
  root.rotation.y=-yaw;
  const body=new THREE.Group();
  root.add(body);
  const parts=spec.style==='heli'?buildHelicopter(body,spec,type):spec.style==='boat'?buildSpeedboat(body,spec):buildRoadVehicle(body,type,spec);
  if(parts.water){
    parts.wake=new THREE.Mesh(wakeGeometry,new THREE.ShaderMaterial({
      ...wakeShaders,uniforms:{phase:{value:0},opacity:{value:0}},transparent:true,depthWrite:false,toneMapped:false,
    }));
    parts.wake.position.set(0,-.66,18.9);root.add(parts.wake);
  }
  compactPanels(body);
  scene.add(root);
  shadowMaterial??=new THREE.MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const shade=new THREE.Mesh(flat,shadowMaterial);
  shade.rotation.x=-Math.PI/2;
  shade.scale.set(parts.radius*3,5.7,1);
  scene.add(shade);
  return {type,spec,root,body,pos:root.position,shade,yaw,parts,speed:0,vertical:0,hull:100,nitro:100,boost:false,drift:false,frame:0};
}

export function resprayVehicle(vehicle,index=(vehicle.paint??0)+1){
  const body=vehicle.parts.coachwork;
  if(!body)return;
  const tones=[0xf84323,0x50bdaf,0xe1a751,0x596bb1];
  vehicle.paint=index;
  body.material=paint(tones[index%tones.length]);
}

export function removeVehicle(scene,v){
  scene.remove(v.root,v.shade);
}

export function facingPoint(v,d) {
  return {x:v.pos.x+Math.sin(v.yaw)*d,z:v.pos.z-Math.cos(v.yaw)*d};
}

export function canSail(x,z) {
  return x>tideLine(z)+1&&x<715&&Math.abs(z)<480&&!isGround(x,z)
    && !(x>376&&x<490&&Math.abs(z+131)<12);
}

function moveGround(v,dt,world,speed=v.speed) {
  const dx=Math.sin(v.yaw)*speed*dt;
  const dz=-Math.cos(v.yaw)*speed*dt;
  const x=v.pos.x,z=v.pos.z;
  if(world.canMove(x+dx,z+dz,v.pos.y,v.parts.radius*.69)){
    v.pos.x+=dx; v.pos.z+=dz;
    return false;
  }
  if(world.canMove(x+dx,z,0,v.parts.radius*.68))v.pos.x+=dx;
  if(world.canMove(x,z+dz,0,v.parts.radius*.68))v.pos.z+=dz;
  const impact=Math.abs(v.speed);
  v.speed*=-.24;
  v.hull=clamp(v.hull-impact*.19,0,100);
  return impact>4;
}

export function driveVehicle(v,input,dt,world) {
  const throttle=Number(input.forward)-Number(input.back);
  const turn=Number(input.right)-Number(input.left);
  v.boost=input.boost&&throttle>0&&v.nitro>3&&!v.parts.mainRotor&&!v.parts.water;
  v.drift=input.brake&&Math.abs(v.speed)>6&&Boolean(turn)&&!v.parts.water;
  v.nitro=clamp(v.nitro+dt*(v.boost?-25:7.5),0,100);
  const max=v.spec.max*(v.boost?1.28:1)*(.57+v.hull*.0043);
  const target=throttle>0?max:throttle<0?-13:0;
  const motor=input.brake&&!v.parts.mainRotor?(v.drift?5:31):throttle*v.speed<0?30:throttle?v.spec.accel*(v.boost?1.9:1):6.6;
  v.speed+=clamp((input.brake&&!v.parts.mainRotor?(v.drift?target*.53:0):target)-v.speed,-motor*dt,motor*dt);
  if(v.parts.mainRotor){
    const climb=Number(input.brake)-Number(input.descend);
    v.vertical+=(climb*18-v.vertical)*Math.min(1,dt*2.2);
    const altitude=clamp(v.pos.y+v.vertical*dt,0,230);
    v.yaw+=turn*dt*.91;
    const x=v.pos.x+Math.sin(v.yaw)*v.speed*dt;
    const z=v.pos.z-Math.cos(v.yaw)*v.speed*dt;
    if(world.canMove(x,z,altitude,1.7)){v.pos.set(x,altitude,z);}
    else if(world.canMove(v.pos.x,v.pos.z,altitude,1.7)){v.pos.y=altitude;v.speed*=.8;}
    v.body.rotation.z+=(-turn*.28-v.body.rotation.z)*dt*4;
    v.body.rotation.x+=(-v.speed*.004-v.body.rotation.x)*dt*3;
    return false;
  }
  const grip=v.spec.grip*(v.drift?1.4:1);
  v.yaw+=turn*grip*dt*Math.min(Math.abs(v.speed)/4,1.38)*(v.speed<0?-1:1);
  v.body.rotation.z+=(turn*Math.min(.10,Math.abs(v.speed)*.0026)-v.body.rotation.z)*dt*8;
  v.body.rotation.x+=(-throttle*.017-v.body.rotation.x)*dt*6;
  if(v.parts.water){
    const next=facingPoint(v,v.speed*dt);
    if(canSail(next.x,next.z)){v.pos.x=next.x;v.pos.z=next.z;return false;}
    const impact=Math.abs(v.speed);
    v.speed*=-.23;v.hull=clamp(v.hull-impact*.37,0,100);return impact>4;
  }
  if(v.jump!=null){
    v.vertical-=18*dt;v.pos.y=Math.max(0,v.pos.y+v.vertical*dt);
    v.body.rotation.x=-clamp(v.vertical*.042,-.22,.24);
  }
  for(const wheel of v.parts.wheels.slice(0,2))wheel.pivot.rotation.y=turn*-.26;
  return moveGround(v,dt,world);
}

export function steerVehicle(v,targetX,targetZ,cruise,dt,world) {
  const desired=headingTo(targetX-v.pos.x,targetZ-v.pos.z);
  const delta=angleDelta(desired,v.yaw);
  v.yaw+=clamp(delta,-1.63*dt,1.63*dt);
  const speed=cruise*Math.max(.16,1-Math.abs(delta)*.52);
  v.speed+=clamp(speed-v.speed,-24*dt,v.spec.accel*dt);
  if(moveGround(v,dt,world)){
    v.yaw+=Math.sign(delta||1)*.34;
    return true;
  }
  return false;
}

export function animateVehicle(v,dt,time) {
  v.root.rotation.y=-v.yaw;
  v.shade.position.set(v.pos.x,.09,v.pos.z);
  v.shade.rotation.z=v.yaw;
  v.shade.visible=v.pos.y<9&&!v.parts.water;
  if(v.parts.water){
    v.body.position.y=Math.sin(time*2.7+v.frame)*.11;
    const wake=v.parts.wake;
    wake.material.uniforms.phase.value=time;
    wake.material.uniforms.opacity.value=clamp(v.speed/18,0,1);
    wake.visible=v.speed>1;
  }
  for(const {rolling} of v.parts.wheels)rolling.rotation.x-=v.speed*dt/Math.max(.33,rolling.parent.position.y);
  if(v.parts.lights?.length&&!v.wrecked){
    const phase=Math.floor(time*7+v.frame)%4;
    for(let i=0;i<v.parts.lights.length;i++){
      const flash=(phase+i*2)%4;
      const signal=flash===0||flash===1?1:.27;
      v.parts.lights[i].material.opacity=signal;
      v.parts.reflections[i].material.opacity=signal*.61;
    }
  }
  for(const {flame,shell} of v.parts.boosters??[]){
    flame.visible=v.boost;
    flame.scale.z=.95+Math.sin(time*31+flame.position.x)*.21;
    shell.rotation.z=time*6;
  }
  if(v.parts.mainRotor&&!v.wrecked){
    v.parts.mainRotor.rotation.y=time*32;
    v.parts.tailRotor.rotation.x=time*47;
  }
}
