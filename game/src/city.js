import * as THREE from 'three';
import { AVENUES, COVER, STREETS, angleDelta, avenueHasGreen, isGround, seededRandom, tideLine } from './config.js';
import { RAMPS } from './missions.js';
import { buildSurfaceLibrary, signTexture, towerFacade } from './textures.js';
import { animateVehicle, groundGlow, spawnVehicle } from './vehicles.js';

const unitBox = new THREE.BoxGeometry(1,1,1);
const unitPost = new THREE.CylinderGeometry(.5,.5,1,8);
const unitSphere = new THREE.IcosahedronGeometry(.5,1);
const umbrellaTop = new THREE.ConeGeometry(1,.45,12);
const lineVector = new THREE.Vector3();
const vertical = new THREE.Vector3(0,1,0);

class CityGeometry {
  constructor(scene) {
    this.scene=scene;
    this.batches=new Map();
    this.object=new THREE.Object3D();
    this.colliders=[];
    this.trees=[];
  }
  put(geometry, material, x,y,z, w,h,d, yaw=0, rotation=null) {
    const key=geometry.id + '/' + material.id;
    if(!this.batches.has(key)) this.batches.set(key,{geometry,material,matrices:[]});
    this.object.position.set(x,y,z);
    this.object.scale.set(w,h,d);
    this.object.rotation.set(0,yaw,0);
    if(rotation) this.object.quaternion.copy(rotation);
    this.object.updateMatrix();
    this.batches.get(key).matrices.push(this.object.matrix.clone());
  }
  box(m,x,y,z,w,h,d,yaw=0){ this.put(unitBox,m,x,y,z,w,h,d,yaw); }
  line(m,a,b,r){
    lineVector.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const len=lineVector.length();
    const q=new THREE.Quaternion().setFromUnitVectors(vertical,lineVector.normalize());
    this.put(unitPost,m,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r*2,len,r*2,0,q);
  }
  orb(m,x,y,z,w,h,d){this.put(unitSphere,m,x,y,z,w,h,d);}
  obstacle(x,z,w,d,h){this.colliders.push({x,z,w,d,h});}
  finish(){
    for(const {geometry,material,matrices} of this.batches.values()){
      const instance=new THREE.InstancedMesh(geometry,material,matrices.length);
      matrices.forEach((matrix,i)=>instance.setMatrixAt(i,matrix));
      instance.computeBoundingSphere();
      instance.receiveShadow=true;
      instance.castShadow=geometry===unitBox && this.shadowCasters.has(material);
      this.scene.add(instance);
    }
  }
}

const standard = (color, extra={}) => new THREE.MeshStandardMaterial({ color, roughness:.83, ...extra });
const glow = (color, intensity=.9) => standard(color,{emissive:color,emissiveIntensity:intensity,roughness:.55});

function makeCityMaterials() {
  const t=buildSurfaceLibrary();
  return {
    asphalt:standard(0xafaaa9,{map:t.asphalt,roughness:.85}),
    paving:standard(0xe1d8cf,{map:t.paving}),
    sand:standard(0xffe7c4,{map:t.sand}),
    decks:standard(0xe8cdb5,{map:t.decks}),
    lane:standard(0xf1e7d2), gold:standard(0xffbb43),
    cement:standard(0xb2b6b5), cream:standard(0xf5e0ac),
    dark:standard(0x202b35), metal:standard(0x59616a,{metalness:.43}), soil:standard(0x63704f),
    green:standard(0x4f8056), white:standard(0xe7ddd3),
    glass:standard(0x385764,{metalness:.3,roughness:.3}),
    truss:standard(0xa7543f,{metalness:.25}), timber:standard(0x72574e),
    lamps:glow(0xffd48a,1), neon:glow(0xff6e75,1.7), aqua:glow(0x51fff1,1.3),
    violet:glow(0xc77efc,1.2), red:glow(0xff360c,1.1),
    signals:[[glow(0xff350d),glow(0x26ff90)],[glow(0xff350d),glow(0x26ff90)]],
    leaf:[0x244b35,0x4e7140,0x668843].map(c=>standard(c,{side:THREE.DoubleSide})),
    trunk:standard(0xa9856a),
    hotels:[0xc18676,0x95b5ad,0xbba2ab,0xc9a071,0xb5bba4,0xf0c5ae].map(c=>standard(c)),
    tower:[0xffffff,0xd0e2ef,0xe3e8ea,0xf0d3bd].map((c,i)=>standard(c,{map:towerFacade(388+i),roughness:.36,metalness:.26})),
    deco:[0xffefd5,0xffdfd2,0xe4edda].map((c,i)=>standard(c,{map:towerFacade(481+i,true,'deco'),roughness:.75})),
    containers:[0xc36647,0x427d8c,0x435e7c,0xb19863,0x97a7a6].map(c=>standard(c,{metalness:.27})),
  };
}

function paintAsphalt(g,m) {
  g.box(m.soil,-148,-.57,-5,470,.52,790);
  for(let z=-394;z<390;z+=12){
    const edge=tideLine(z);
    g.box(m.sand,(edge+81)/2,-.32,z,edge-81,.47,12.02);
    g.box(m.sand,edge-3,-.515,z,8.0,.32,12.02);
  }
  for(const x of AVENUES) {
    const wide=x===58?25:19;
    for(let z=-387;z<=381;z+=32)g.box(m.asphalt,x,-.055,z,wide,.11,32);
    for(const side of [-1,1]){
      g.box(m.paving,x+side*(wide/2+2.3),.12,-5,4.6,.24,788);
      g.box(m.cream,x+side*(wide/2-.18),.015,-4,.17,.028,784);
      g.box(m.gold,x+side*.22,.014,-3,.125,.029,784);
      if(x===58){
        for(let z=-390;z<386;z+=9) if(STREETS.every(n=>Math.abs(n-z)>15)) g.box(m.lane,x+side*6,.016,z,.16,.03,4.0);
      }
    }
  }
  for(const z of STREETS) {
    const east=z===-244?154:z===-68?144:z===-156?68:77;
    const left=-373;
    for(let x=left;x<east;x+=32){
      const width=Math.min(32,east-x);
      g.box(m.asphalt,x+width/2,-.042,z,width,.098,z===-244?24:18);
    }
    const edge=z===-244?12.1:9.1;
    for(let i=left+4;i<east-4;i+=10){
      if(AVENUES.every(a=>Math.abs(a-i)>18)) g.box(m.gold,i,.016,z,4,.029,.15);
    }
    for(const x of AVENUES){
      g.box(m.asphalt,x,.025,z, x===58?25:19,.055, edge*2+1);
      for(const side of [-1,1]){
        for(let j=-4;j<=4;j++) g.box(m.lane,x+j*(x===58?2.5:1.8),.062,z+side*(edge+1.6),.88,.025,2.3);
        for(let j=-3;j<=3;j++) g.box(m.lane,x+side*(x===58?14.7:11.7),.045,z+j*2.3,2.24,.025,.85);
      }
    }
  }
  for(let z=-370;z<380;z+=10) {
    g.box(m.paving,84,.09,z,8,.24,9.95);
    if(z%30===-10||z%30===20){
      g.box(m.timber,91,.49,z,1.2,.14,4);
      g.box(m.metal,91,.18,z-1.1,.8,.45,.15);
      g.box(m.metal,91,.18,z+1.1,.8,.45,.15);
    }
  }
}

function landscapeWaterfront(g,m,random){
  for(let z=-380;z<370;z+=11){
    if(Math.abs(z+244)<18||Math.abs(z+68)<23)continue;
    const x=101+5*Math.sin(z*.022)+random()*4;
    if(random()<.61){
      g.orb(m.sand,x,.04,z,7.3,.82,9.4);
      g.orb(m.soil,x-1,.25,z,4.9,.58,5.2);
      for(let i=0;i<4;i++)g.orb(m.green,x+random()*4-2,.5,z+random()*5-2.5,1.2,.73,1.3);
    }
    if(z%3===0){
      g.box(m.timber,91,.29,z,1.2,.24,.16);
      g.box(m.timber,91,.29,z+4,1.2,.24,.16);
      g.line(m.cream,[91,.50,z],[91,.50,z+4],.046);
    }
  }
  for(const [x,z] of [[111,146],[115,72],[117,9],[109,-111],[114,-191],[111,-288]]){
    g.box(m.decks,x,.14,z,5.8,.26,4.4);
    g.box(m.hotels[1],x,.99,z,5.4,1.46,4.05);
    g.box(m.aqua,x,.88,z-2.1,4.75,.56,.14);
    g.box(m.white,x,1.86,z,6.14,.24,4.69);
    g.box(m.gold,x,1.96,z,6.26,.10,4.78);
  }
  for(let i=0;i<24;i++){
    const z=-319+i*28.5,x=tideLine(z)-14-(i%3)*4;
    if(Math.abs(z+244)<22||Math.abs(z+68)<24)continue;
    const canopy=m.hotels[(i+1)%6];
    g.line(m.cream,[x,-.10,z],[x,1.96,z],.045);
    g.put(umbrellaTop,canopy,x,2.02,z,2.26,1.22,2.26,i*.47);
    g.put(umbrellaTop,m.cream,x,2.28,z,1.05,.65,1.05,i*.47);
    for(const side of [-1,1]){
      g.box(side===1?m.aqua:m.neon,x+side*1.87,-.045,z+1.4,1.45,.045,2.7,side*.4);
      g.box(m.cream,x+side*1.92,.055,z+.65,1.22,.16,.47,side*.4);
    }
  }
}

function installSign(g,label,sub,accent,x,y,z,w,h,yaw=0) {
  const face=new THREE.MeshBasicMaterial({map:signTexture(label,sub,accent),toneMapped:false});
  g.box(face,x,y,z,w,h,.13,yaw);
}

function buildDecoHotel(g,m,x,z,w,d,h,palette,sign) {
  const wall=m.hotels[palette];
  const level=Math.round(h/3.4);
  g.box(wall,x,h/2,z,w,h,d);
  g.obstacle(x,z,w,d,h);
  g.box(m.deco[palette%3],x,h*.49,z,w-.8,h*.89,d+.075);
  g.box(m.deco[palette%3],x,h*.49,z,w+.075,h*.89,d-.8);
  g.box(m.cream,x,.45,z,w+1,.8,d+1);
  g.box(wall,x,1.95,z,w+1.1,3.1,d+1.1);
  g.box(m.cream,x,h-.25,z,w+1.1,.65,d+1.1);
  g.box(wall,x,h+.75,z,w*.80,1.6,d*.73);
  g.box(m.cream,x,h+1.65,z,w*.81,.28,d*.74);
  g.box(wall,x,h+2.5,z,w*.48,1.45,d*.48);
  g.box(m.cream,x,h+3.29,z,w*.49,.2,d*.5);
  for(let i=1;i<level;i++){
    const y=i*h/level;
    g.box(m.cream,x,y,z,w+.46,.19,d+.46);
  }
  for(const edge of [-1,1]){
    g.box(wall,x+edge*(w/2-.75),h/2,z,1.25,h,d+.23);
    g.box(m.cream,x,h/2,z+edge*(d/2-.6),w+.28,h,1.2);
  }
  const awning=palette%2?m.hotels[0]:m.hotels[1];
  g.box(awning,x+w/2+1.35,3.85,z,3.0,.28,d*.83);
  g.box(m.cream,x+w/2+2.75,3.72,z,.20,.27,d*.83);
  for(const side of [-1,1]){
    const zz=z+side*d*.47;
    g.put(unitPost,wall,x+w/2-.28,h*.48,zz,2.35,h*.96,2.35);
    for(let n=1;n<level;n++)g.put(unitPost,m.cream,x+w/2-.28,n*h/level,zz,2.57,.20,2.57);
  }
  for(let n=1;n<5;n++) {
    const zz=z+(n-2.5)*d/5;
    g.box(m.glass,x+w/2+.57,1.85,zz,.09,2.5,d/6);
    g.box(m.lamps,x+w/2+2.48,3.55,zz,.13,.13,.46);
    g.box(m.metal,x+w/2+2.5,1.82,zz+d/13,.11,3.67,.11);
    if(n%2===0){
      g.put(unitPost,m.cream,x+w/2+3.8,.6,zz,1.55,.09,1.55);
      g.line(m.metal,[x+w/2+3.8,.19,zz],[x+w/2+3.8,2.48,zz],.04);
      g.put(umbrellaTop,awning,x+w/2+3.8,2.49,zz,1.8,1,1.8);
    }
  }
  if(sign){
    const [name,subtitle,accent]=sign;
    installSign(g,name,subtitle,accent,x+w/2+.3,Math.min(h+1,12.7),z,Math.min(21,d*.77),3,Math.PI/2);
    g.box(palette%2?m.aqua:m.neon,x+w/2+.3,4.25,z,.16,.14,d*.86);
    g.box(palette%2?m.aqua:m.neon,x,h+.12,z,w+1.25,.1,d+1.25);
  }
}

function buildGlassTower(g,m,x,z,w,d,h,style) {
  const glass=m.tower[style%4];
  const podium=8+(style%3)*3;
  g.box(m.cement,x,podium/2,z,w+5,podium,d+5);
  g.box(m.glass,x,3.7,z,w+5.12,4.2,d+5.12);
  g.box(m.dark,x,podium+.35,z,w+5.5,.85,d+5.5);
  g.box(glass,x,(podium+h)/2,z,w,h-podium,d);
  for(let y=6;y<podium-.8;y+=2.45){
    for(const side of [-1,1])for(let n=-2;n<=2;n++){
      g.box(n%3?m.glass:m.lamps,x+side*((w+5)*.5+.07),y,z+n*d/5.75,.10,1.38,2.5);
      g.box(n%2?m.glass:m.lamps,x+n*w/5.75,y,z+side*((d+5)*.5+.07),2.5,1.38,.10);
    }
  }
  g.obstacle(x,z,w+5,d+5,h);
  for(let y=podium+12;y<h-3;y+=13)g.box(m.metal,x,y,z,w+.32,.33,d+.32);
  for(const u of [-1,1])for(const v of [-1,1])g.box(m.metal,x+u*w*.49,(h+podium)/2,z+v*d*.49,.45,h-podium,.45);
  g.box(m.cream,x,h+.25,z,w+.55,.5,d+.55);
  g.box(m.metal,x,h+1.9,z,w*.68,3.3,d*.69);
  if(style%3===0) {
    g.box(m.cement,x+2,h+5,z,4.6,5,5.5);
    g.line(m.cream,[x+2,h+7,z],[x+2,h+14,z],.19);
    g.orb(m.red,x+2,h+14,z,.45,.45,.45);
  }
  if(style%3===1) g.box(m.aqua,x,h+.59,z,w+.47,.13,d+.47);
  for(let i=-2;i<=2;i++){
    const offset=i*d/5.8;
    g.box(m.dark,x+(w+5)*.5+.08,3.6,z+offset,.16,4.2,2.9);
    g.box(m.glass,x+(w+5)*.5+.18,2.72,z+offset,.12,2.7,2.65);
    g.box(m.lamps,x+(w+5)*.5+.24,4.15,z+offset,.19,.075,2.47);
    g.box(m.metal,x+i*w/5.8,3.9,z+(d+5)*.5+.18,.22,5.9,.22);
  }
}

function buildExchangePlaza(g,m){
  const shops=[
    [-110.3,-167.9,'VELA EXCHANGE','FINANCIAL DISTRICT','#94fff2',m.aqua],
    [-145.8,-166.8,'AFTERLIGHT','MUSIC  /  LATE BAR','#ff8bbb',m.neon],
    [-110.3,-186.3,'MARISOL ARMS','RESIDENCES  /  MARKET','#ffda99',m.lamps],
    [-144,-150.6,'BAZAAR NIGHT MARKET','VELA · OPEN LATE','#ffd38f',m.lamps],
  ];
  for(const [x,z,brand,tag,color,luminous] of shops){
    const side=x>-128?1:-1;
    g.box(m.dark,x+side*.7,2.4,z,2.5,4.8,11.0);
    g.box(m.glass,x-side*.59,1.82,z,.14,3.02,9.2);
    g.box(m.metal,x-side*.86,3.58,z,2.1,.22,11.5);
    g.box(luminous,x-side*1.9,3.56,z,.10,.12,11.5);
    g.box(luminous,x-side*.71,5.80,z,.08,.075,10.8);
    for(const edge of [-1,1])g.box(luminous,x-side*.72,1.90,z+edge*4.9,.13,3.6,.095);
    installSign(g,brand,tag,color,x-side*.64,4.75,z,10.6,2.42,Math.PI/2);
    const tint=new THREE.PointLight(color,47,25,2);
    tint.position.set(x-side*3,2.2,z);g.scene.add(tint);
    groundGlow(g.scene,color,x-side*6,z,17.3,17.0,.27);
    groundGlow(g.scene,color,x-side*12,z,16,7.5,.13);
  }
  for(const [x,z] of [[-113,-149],[-143,-146],[-113,-161],[-143,-167]]){
    g.box(m.cement,x,.27,z,2.13,.50,2.13);
    g.box(m.soil,x,.54,z,1.82,.09,1.82);
    palm(g,m,x,z,4.1,z*.12);
  }
  for(const z of [-143,-152,-167,-181,-195]){
    let prior=null;
    for(let i=0;i<=14;i++){
      const x=-145+i*2.4,y=6.7-2.3*Math.sin(i*Math.PI/14);
      const p=[x,y,z+(i%3)*.11];
      if(prior)g.line(m.dark,prior,p,.026);
      prior=p;
      if(i%2===1){
        g.line(m.metal,p,[x,y-.42,p[2]],.030);
        g.orb(m.neon,x,y-.39,p[2],.43,.56,.43);
        g.orb(m.lamps,x,y-.47,p[2]-.05,.31,.33,.30);
        g.box(m.metal,x,y-.66,p[2],.20,.06,.20);
      }
    }
  }
}

function buildBlocks(g,m,rng) {
  const hotels=[
    ['ARCO HOUSE','BAY HOTEL','#9deeea'],['CASA LUZ','BEACH CLUB','#81f9e0'],
    ['SOLARIS CLUB','OCEAN TERRACE','#ffe0a4'],['PALM ROYALE','ROOMS & COCKTAILS','#a1faee'],
    ['HOTEL MIRAMAR','THE STRAND','#ffc382'],['SOLARIS CLUB','OCEANLIGHT','#ff99bc'],
  ];
  for(let col=0;col<AVENUES.length;col++) for(let row=0;row<STREETS.length-1;row++){
    const x0=col===0?-375:AVENUES[col-1]+14, x1=AVENUES[col]-(col===4?16:13);
    const z0=STREETS[row]+14,z1=STREETS[row+1]-13;
    const x=(x0+x1)/2,z=(z0+z1)/2;
    g.box(m.paving,x,.10,z,x1-x0,.21,z1-z0);
    if(col===4){
      const sign=hotels[row%hotels.length];
      const h=18+rng()*7;
      buildDecoHotel(g,m,x1-16,z-13,25,26,h,row%6,sign);
      buildDecoHotel(g,m,x1-16,z+16,23,25,h*.78,(row+2)%6,row===4?hotels[3]:null);
      installSign(g,sign[0],sign[1],sign[2],x1-12,h+1.9,z-13,17,2.85,Math.PI/2);
      groundGlow(g.scene,sign[2],x1+14,z-13,25,31,.18);
      g.box(m.soil,x0+13,.24,z,10,.28,42);
      for(let n=-1;n<=1;n++) palm(g,m,x0+13,z+n*14,6+rng()*2,rng()*6);
    } else if(row<4&&col>0){
      const h=40+rng()*69+(col===2?18:0);
      buildGlassTower(g,m,x-8,z-10,27+rng()*8,31+rng()*8,h,row+col);
      if((row+col)%3===0)buildGlassTower(g,m,x+21,z+17,13,16,h*.68,row+col+4);
      else buildDecoHotel(g,m,x+16,z+15,16,24,11+rng()*7,(row+col)%6,null);
    } else {
      buildDecoHotel(g,m,x-9,z-10,23,26,8+rng()*11,(row+col)%6,null);
      buildDecoHotel(g,m,x+12,z+16,22,18,5+rng()*8,(row+col+2)%6,null);
      if((row+col)%2===0){
        for(let j=-1;j<=1;j++){
          const xx=x+j*6;
          const zz=z+25;
          g.box(m.hotels[(row+j+8)%6],xx,2.6,zz,4.9,.32,3.5);
          g.box(m.timber,xx,.88,zz,4.6,.86,1.9);
          for(const side of [-1,1])g.line(m.timber,[xx+side*2.25,.25,zz+1.4],[xx+side*2.25,2.65,zz+1.4],.07);
        }
      }
    }
  }
  installSign(g,'PALOMA','BODY SHOP  /  RESPRAY','#ffba73',-201,4.1,205,18,3);
  installSign(g,'KEYS SUPPLY','ARMORY  /  24H','#8cfae3',-111,4.1,29,16,2.5);
  installSign(g,'LA PALMA','SAFEHOUSE  /  CREW','#ffe4a3',-46,4,207,14,2.5);
  installSign(g,'MIRAMAR LAUNCH','BOATHOUSE  /  PUBLIC DOCK','#8cfae3',330,2.15,-51,12,2);
  for(const [name,x,z,height,color] of [['PALM ROYALE',45.1,64,8.4,'#a8fff0'],['HOTEL MIRAMAR',44.6,46,13.1,'#ffd28f']]){
    g.line(m.metal,[x-3.6,.18,z],[x-3.6,height+.53,z],.11);
    g.line(m.cream,[x-4.7,height-1.42,z],[x+4.8,height-1.42,z],.085);
    installSign(g,name,'OCEANLIGHT BOULEVARD',color,x,height,z,9.4,2.62);
  }
}

function furnishChallenges(g,m){
  for(const [x,z] of COVER){
    g.box(m.cement,x,.43,z,2.8,.86,.71);
    g.box(m.cement,x,.79,z,2.55,.28,.49);
    for(const off of [-1,1])g.box(m.gold,x+off*.94,.54,z+.366,.20,.33,.04,0,0,-.35);
    g.obstacle(x,z,2.8,.71,1);
  }
  const wedge=new THREE.BufferGeometry();
  wedge.setAttribute('position',new THREE.Float32BufferAttribute([
    -1.48,0,2.9, 1.48,0,2.9, -1.48,.93,-2.9, 1.48,.93,-2.9, -1.48,0,-2.9, 1.48,0,-2.9,
  ],3));
  wedge.setIndex([0,1,2,1,3,2,0,2,4,1,5,3,2,3,4,3,5,4]);wedge.computeVertexNormals();
  for(const [x,z,yaw] of RAMPS){
    g.put(wedge,m.metal,x,.08,z,1,1,1,-yaw);
    for(const side of [-1,1]){
      const off=side*1.40;
      g.line(m.gold,[x+Math.cos(yaw)*off-Math.sin(yaw)*2.9,.10,z+Math.sin(yaw)*off+Math.cos(yaw)*2.9],
        [x+Math.cos(yaw)*off+Math.sin(yaw)*2.9,1.05,z+Math.sin(yaw)*off-Math.cos(yaw)*2.9],.048);
    }
  }
}

function palmBlade() {
  const positions=[];
  const indices=[];
  for(let i=0;i<=30;i++) {
    const t=i/30;
    const width=Math.sin(Math.PI*t)**.8*(i%3===1?.031:.134);
    const y=.48*t-.82*t*t;
    positions.push(t,y-.07*t,-width,t,y+.014,0,t,y-.07*t,width);
    if(i){
      const a=i*3;
      indices.push(a-3,a,a-2,a-2,a,a+1,a-2,a+1,a-1,a-1,a+1,a+2);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const blade=palmBlade();

function palm(g,m,x,z,h,yaw,animate=false) {
  for(let i=0;i<6;i++){
    const p=i/6,q=(i+1)/6;
    g.line(m.trunk,[x+q*q*.84,h*q,z],[x+p*p*.84,h*p,z],.165-.075*p);
    if(i%2===0)g.orb(m.trunk,x+p*p*.84,h*p+.06,z,.43-.12*p,.12,.43-.12*p);
  }
  for(let i=0;i<10;i++){
    const a=yaw+i*Math.PI*2/10;
    const w=h*(.38+.11*Math.sin(i*4));
    const material=m.leaf[i%3];
    if(!animate){
      g.put(blade,material,x+.87,h,z,w,w,w,a);
      continue;
    }
    const mesh=new THREE.Mesh(blade,material);
    mesh.position.set(x+.87,h,z);
    mesh.scale.setScalar(w);
    mesh.rotation.y=a;
    g.scene.add(mesh);
    g.trees.push({mesh,phase:a+x*.2,angle:a});
  }
  g.orb(m.leaf[0],x+.89,h-.06,z,.69,.66,.65);
}

function furnishStreets(g,m,rng) {
  for(let z=-388;z<382;z+=13) {
    if(STREETS.some(a=>Math.abs(a-z)<14)) continue;
    palm(g,m,80.5,z,7.5+rng()*3.3,rng()*7,z>-45&&z<150&&z%2===0);
    if(z%3===0)palm(g,m,112,z-1,5+rng()*3,rng()*6);
    if(z%4===1)palm(g,m,42.4,z,6+rng()*3,rng()*6);
  }
  for(let z=-372;z<370;z+=25) {
    const shade=[m.cream,m.neon,m.aqua,m.gold][Math.abs(z)%4];
    for(const x of [101,123]){
      g.line(m.metal,[x,0,z],[x,2.4,z],.05);
      g.put(umbrellaTop,shade,x,2.41,z,2.15,1.25,2.15,0);
      g.box(m.white,x-1,.22,z+.73,1.35,.45,.5,-.23);
    }
  }
  for(const x of AVENUES) for(let z=-364;z<368;z+=34){
    if(STREETS.some(a=>Math.abs(a-z)<12))continue;
    for(const side of x===58?[-1,1]:[-1]){
      const xx=x+side*(x===58?14:11);
      g.line(m.dark,[xx,.2,z],[xx,6.0,z],.12);
      g.line(m.dark,[xx,5.9,z],[xx-side*2.1,6.55,z],.09);
      g.box(m.dark,xx-side*2.3,6.51,z,.82,.21,.47);
      g.box(m.lamps,xx-side*2.3,6.38,z,.67,.08,.37);
    }
  }
  for(const x of AVENUES)for(const z of STREETS) {
    const offset=x===58?15:12;
    g.line(m.metal,[x-offset,0,z-12],[x-offset,6.2,z-12],.14);
    g.line(m.metal,[x-offset,6.15,z-12],[x-1,6.15,z-12],.11);
    g.box(m.dark,x-2,5.59,z-12,.62,1.13,.34);
    const lenses=m.signals[Number(avenueHasGreen(x,z,0))];
    g.orb(lenses[0],x-2,5.87,z-11.80,.26,.26,.11);
    g.orb(lenses[1],x-2,5.26,z-11.80,.26,.26,.11);
    g.box(m.dark,x-offset+.4,4.97,z-11.95,2.3,.43,.09);
  }
}

function buildArcoCauseway(g,m) {
  const z=-244;
  g.box(m.cement,232,-1.20,z,311,2.1,29.3);
  g.box(m.asphalt,241,.005,z,328,.09,24.5);
  for(const d of [-1,1]){
    g.box(m.cream,240,.42,z+d*13.1,328,.67,.42);
    g.box(m.gold,239,.06,z+d*.35,321,.025,.15);
    for(let x=109;x<393;x+=9)g.box(m.lane,x,.062,z+d*5.7,4.5,.027,.16);
    for(let x=137;x<391;x+=8.5)g.box(m.metal,x,.65,z+d*13.3,.14,1.3,.15);
    for(let x=153;x<389;x+=22)g.orb(m.lamps,x,1.04,z+d*13.37,.40,.28,.34);
  }
  for(const x of [183,319]) {
    for(const s of [-1,1]){
      const edge=z+s*15.1;
      g.box(m.cement,x,-5,edge,7.7,11,8.2);
      g.line(m.cream,[x,-2,edge],[x,49,z+s*10.2],2.32);
      g.line(m.white,[x+.5,2,edge],[x+.5,50,z+s*10.2],.38);
      g.box(m.red,x,49.6,z+s*10.2,.59,.32,.6);
      for(let i=1;i<=7;i++) for(const side of [-1,1]){
        const dx=i*8.0;
        g.line(m.cream,[x,48-i*3.15,z+s*(9.9+i*.28)],[x+side*dx,.86,edge-s*1.7],.13);
      }
    }
    g.box(m.cream,x,28,z,2.7,3.0,26);
    g.box(m.cream,x,44,z,2.1,2.45,22);
  }
  installSign(g,'ARCO CROSSING','CALYPSO FREEPORT  ›','#d5efde',148,6,-241,15,2.6,Math.PI/2);
}

function buildMarina(g,m) {
  const z=-68;
  g.box(m.decks,240,-.13,z,227,.30,38);
  g.box(m.cream,241,.38,z+18.7,223,.72,.3);
  g.box(m.cream,241,.38,z-18.7,223,.72,.3);
  for(let x=139;x<353;x+=12){
    for(const side of [-1,1]){
      g.box(m.timber,x,-2.7,z+side*16,.6,6,.65);
      g.box(m.dark,x,1.1,z+side*17.8,.27,2.3,.3);
      g.orb(m.lamps,x,2.48,z+side*17.8,.52,.54,.52);
    }
  }
  for(let i=0;i<5;i++){
    const x=163+i*18;
    g.box(m.decks,x,-.30,-37,3,.43,32);
    buildBoat(g,m,x+6,-33+i%2*8,2.8,12,0,i%2===0);
  }
  installSign(g,'MIRAMAR','PIER  /  WHEEL  /  MARINA','#f9c9a0',201,5.2,z+8,17,3,Math.PI/2);
  for(let x=193;x<268;x+=16){
    g.box(m.hotels[Math.floor(x/9)%6],x,1.81,z-12,8,3.6,7);
    g.box(m.cream,x,3.70,z-12,8.8,.38,7.6);
    g.box(m.glass,x,1.65,z-8.45,6,1.8,.17);
    g.box(m.aqua,x,3.35,z-8.49,7.2,.10,.13);
  }
}

function buildBoat(g,m,x,z,width,length,yaw,tall=false) {
  g.box(m.white,x,-.15,z,width,.75,length*.73,yaw);
  g.box(m.containers[1],x,-.48,z,width+.08,.24,length*.75,yaw);
  g.box(m.decks,x,.23,z,.83*width,.13,length*.69,yaw);
  g.box(m.white,x,.68,z,width*.70,.88,length*.39,yaw);
  g.box(m.glass,x,1.13,z,width*.66,.35,length*.34,yaw);
  g.box(m.white,x,1.39,z,width*.75,.14,length*.45,yaw);
  if(tall){
    g.line(m.white,[x,1.3,z+1],[x,5,z+1],.06);
    g.line(m.white,[x,3.5,z+1],[x+1.2,3.5,z+1],.04);
  }
}

function makeFerrisWheel(g,m) {
  const x=274,z=-68,r=22;
  g.box(m.cement,x,.19,z,36,.40,29);
  for(const side of [-1,1]){
    g.line(m.cream,[x-12,.4,z+side*7],[x,24,z+side*2.7],.55);
    g.line(m.cream,[x+12,.4,z+side*7],[x,24,z+side*2.7],.55);
  }
  const wheel=new THREE.Group();
  wheel.position.set(x,24,z);
  const ring=new THREE.TorusGeometry(r,.32,8,96);
  for(const offset of [-2.35,2.35]){
    const hoop=new THREE.Mesh(ring,m.cream);
    hoop.position.z=offset;
    wheel.add(hoop);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(r-.22,.18,7,120),offset<0?m.neon:m.lamps);
    rim.position.z=offset+Math.sign(offset)*.12;wheel.add(rim);
  }
  const rimBulb=new THREE.IcosahedronGeometry(.29,0);
  const bulbs=new THREE.InstancedMesh(rimBulb,m.lamps,96);
  const pose=new THREE.Matrix4();
  for(let i=0;i<96;i++){
    const a=i*Math.PI/24;
    bulbs.setMatrixAt(i,pose.makeTranslation(Math.cos(a)*r,Math.sin(a)*r,i<48?2.59:-2.59));
  }
  wheel.add(bulbs);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(r*.78,.12,6,72),m.aqua);
  wheel.add(inner);
  const spokeGeometry=new THREE.CylinderGeometry(.11,.11,r*2,6);
  for(let i=0;i<10;i++){
    const spoke=new THREE.Mesh(spokeGeometry,i%2?m.neon:m.cream);
    spoke.rotation.z=i*Math.PI/10;
    wheel.add(spoke);
  }
  const gondolas=[];
  for(let i=0;i<24;i++){
    const a=i*2*Math.PI/24;
    const pod=new THREE.Group();
    pod.position.set(Math.cos(a)*r,Math.sin(a)*r,0);
    const seat=new THREE.Mesh(unitBox,i%2?m.neon:m.aqua);
    seat.scale.set(2.65,1.7,4.0);
    seat.position.y=-.9;
    const top=new THREE.Mesh(unitBox,m.cream);
    top.scale.set(2.77,.43,4.13);
    top.position.y=.09;
    pod.add(seat,top);
    wheel.add(pod);
    gondolas.push(pod);
  }
  g.scene.add(wheel);
  return {wheel,gondolas};
}

function buildCalypsoPort(g,m) {
  g.box(m.paving,454,-1.15,-235,151,2.2,144);
  g.box(m.asphalt,454,-.03,-244,151,.09,25);
  g.box(m.asphalt,470,-.022,-225,12,.08,36);
  g.box(m.dark,470,.041,-211,23,.15,23);
  g.box(m.gold,470,.125,-211,11,.035,.45);
  for(const x of [464.5,475.5])g.box(m.gold,x,.125,-211,.45,.035,11);
  for(let x=394;x<521;x+=7){
    g.box(m.gold,x,.035,-176.6,3.7,.021,.20);
    g.box(m.dark,x,.42,-164.8,.75,.85,.7);
    g.box(m.gold,x,.88,-164.8,.75,.09,.70);
  }
  for(const x of [403,512]){
    g.box(m.containers[1],x,3.64,-209,19,7.3,23);
    g.box(m.metal,x,7.35,-209,19.5,.42,23.6);
    g.box(m.cream,x,4.5,-197.45,8,5.7,.07);
    g.obstacle(x,-209,19,23,7.4);
  }
  for(let z=-294;z<-258;z+=15)for(let x=409;x<=505;x+=16){
    const color=m.containers[(x+z+600)%5];
    for(let floor=0;floor<(x%3+1);floor++){
      const y=1.4+floor*2.76;
      g.box(color,x,y,z,12.5,2.72,5.5);
      for(let n=-6;n<=6;n++)g.box(color,x+n*.88,y,z, .23,2.65,5.66);
      g.box(m.cream,x+6.27,y,z+.3,.11,2.05,.12);
    }
    g.obstacle(x,z,12.5,5.5,3);
  }
  for(const x of [407,450,499]){
    for(const side of [-1,1]){
      g.line(m.truss,[x+side*5,0,-170],[x+side*3,32,-185],.73);
      g.line(m.truss,[x+side*3,32,-185],[x+side*3,24,-146],.48);
      g.line(m.cream,[x+side*3,33,-185],[x+side*3,27,-163],.21);
    }
    g.box(m.truss,x,32,-187,10,.9,1.6);
    g.line(m.metal,[x,28,-156],[x,8,-156],.08);
    g.box(m.gold,x,8,-156,3,.4,2);
  }
  installSign(g,'CALYPSO','FREEPORT  /  CARGO','#ffdc87',392,4.5,-237,12,2.5,Math.PI/2);
  const bow=new THREE.Shape();
  bow.moveTo(-58,0);bow.lineTo(-48,7.6);bow.lineTo(-37,10.4);bow.lineTo(50,10.4);
  bow.lineTo(55,7);bow.lineTo(55,-7);bow.lineTo(50,-10.4);bow.lineTo(-37,-10.4);bow.lineTo(-48,-7.6);bow.closePath();
  const hull=new THREE.Mesh(new THREE.ExtrudeGeometry(bow,{depth:3.8,bevelEnabled:true,bevelSegments:1,bevelSize:.55,bevelThickness:.45,steps:1}),m.truss);
  hull.position.set(434,.97,-131);hull.rotation.x=Math.PI/2;g.scene.add(hull);
  const deck=new THREE.Mesh(new THREE.ShapeGeometry(bow),m.dark);
  deck.position.set(434,1.44,-131);deck.rotation.x=-Math.PI/2;g.scene.add(deck);
  g.box(m.cream,473,4.5,-131,16,6.3,16);
  g.box(m.glass,473,7.75,-131,16.12,1.32,16.12);
  g.box(m.white,473,8.5,-131,17,.22,17);
  g.box(m.containers[0],479,10.2,-129,3.4,4.8,3);
  for(let x=395;x<464;x+=10)for(let i=-1;i<=1;i++) {
    const color=m.containers[(x+i+510)%5];
    g.box(color,x,2.94,-131+i*6,8.6,3,5);
    if(x%3!==0)g.box(m.containers[(x+i+511)%5],x,5.97,-131+i*6,8.6,3,5);
  }
  g.line(m.cream,[399,.7,-133],[399,8,-133],.13);
}

export function buildSolarisKeys(scene) {
  const random=seededRandom(88013);
  const geometry=new CityGeometry(scene);
  const materials=makeCityMaterials();
  geometry.shadowCasters=new Set([...materials.hotels,...materials.tower,materials.cream]);
  paintAsphalt(geometry,materials);
  buildBlocks(geometry,materials,random);
  buildExchangePlaza(geometry,materials);
  furnishChallenges(geometry,materials);
  furnishStreets(geometry,materials,random);
  landscapeWaterfront(geometry,materials,random);
  buildArcoCauseway(geometry,materials);
  buildMarina(geometry,materials);
  const {wheel,gondolas}=makeFerrisWheel(geometry,materials);
  buildCalypsoPort(geometry,materials);
  geometry.finish();
  const launches=[[246,-8,76,31],[327,17,43,36],[403,-35,34,34],[305,-165,45,37]].map(([x,z,rx,rz],i)=>
    ({boat:spawnVehicle(scene,'boat',x,z,0),x,z,rx,rz,phase:.8+i*1.39}));
  const swimmers=Array.from({length:12},(_,i)=>{
    const group=new THREE.Group(),z=-283+i*52,x=tideLine(z)+3.5+(i%3)*3.8;
    const head=new THREE.Mesh(unitSphere,standard([0x8f5037,0xb26944,0xb98163][i%3]));
    head.scale.set(.67,.59,.65);head.position.y=.1;group.add(head);
    const vest=new THREE.Mesh(unitSphere,i%2?materials.aqua:materials.neon);
    vest.scale.set(1.32,.32,.54);group.add(vest);scene.add(group);
    return {group,x,z};
  });

  return {
    blocks:geometry.colliders,
    rampAt(v){
      const id=RAMPS.findIndex(([x,z,yaw])=>{
        const dx=v.pos.x-x,dz=v.pos.z-z;
        const lateral=Math.abs(dx*Math.cos(yaw)+dz*Math.sin(yaw));
        const forward=dx*Math.sin(yaw)-dz*Math.cos(yaw);
        return Math.abs(angleDelta(yaw,v.yaw))<.55&&lateral<2.6&&forward>.55&&forward<3.35;
      });
      return id<0?null:id;
    },
    canMove(x,z,y,r=.45) {
      if(y<2.5&&!isGround(x,z)) return false;
      return !geometry.colliders.some(b=>y<b.h+.2&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);
    },
    animate(time) {
      materials.signals.forEach(([red,green],phase)=>{
        const open=(time%14<7)===Boolean(phase);
        red.emissiveIntensity=open?0:1.7;green.emissiveIntensity=open?1.5:0;
      });
      wheel.rotation.z=time*.057;
      for(const {boat,x,z,rx,rz,phase} of launches){
        const a=phase+time*.105;
        boat.pos.set(x+Math.cos(a)*rx,0,z+Math.sin(a)*rz);
        boat.yaw=Math.atan2(-Math.sin(a)*rx,-Math.cos(a)*rz);boat.speed=21;
        animateVehicle(boat,0,time);
      }
      swimmers.forEach(({group,x,z},i)=>group.position.set(x+Math.sin(time*.4+i)*1.2,-.67+Math.sin(time*3+i)*.08,z+Math.cos(time*.3+i)*2.2));
      for(const pod of gondolas)pod.rotation.z=-wheel.rotation.z;
      for(const {mesh,phase,angle} of geometry.trees){
        mesh.rotation.x=Math.sin(time*1.4+phase)*.13;
        mesh.rotation.y=angle+Math.sin(time*1.1+phase)*.09;
      }
    },
  };
}
