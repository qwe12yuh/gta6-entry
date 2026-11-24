import * as THREE from 'three';
import { AVENUES, BOATHOUSE, CAMPAIGN, CREW, DISTRICTS, GARAGE, HOME, ARMORY, RADIO, RANKS, STREETS, WEAPONS, WORLD, clamp, districtAt, tideLine } from './config.js';
import { clockLabel } from './engine.js';
import { currentObjective, interactionPrompt } from './missions.js';
import { dispatchRows } from './police.js';

const byId=id=>document.getElementById(id);
const money=new Intl.NumberFormat('en-US');
const icons={
  fist:'M12 30l-5-9 2-9 4 1 2-5 5 1 2-3 5 2 4-1 4 3v10l-7 10z',
  baton:'M6 26l22-18 4 3-22 19zM5 28l4 4-3 2-4-4z',
  pistol:'M3 13h29l3 3v5H22l-3 10h-9l3-11H3zM31 11h5v3h-5z',
  smg:'M2 13h5v-3h20v3h8v3h4v4h-9l-4 7h-5l-3-7h-4l-4 6H6l1-6H2z',
  shotgun:'M1 16h10l5-3h24v4H25l-2 4h-7l-5 6H4l2-5H1zM24 18h10v2H24z',
  rifle:'M0 14h8l5-4h9l2 3h9v2h7v4H22l-1 5 5 1-1 4-8-2-2-8h-3l-4 6H1l4-6H0zM15 8h9v2h-9z',
  rpg:'M1 12h25l8-4 6 7-6 6-8-5H18l-3 8h-5l3-8H1zM2 17h4v4H2z',
  star:'M20 2l5.55 11.23 12.4 1.80-8.98 8.76 2.12 12.36L20 30.3l-11.09 5.85 2.12-12.36-8.98-8.76 12.4-1.8z',
};
function icon(name){return '<svg viewBox="0 0 40 38" aria-hidden="true"><path d="'+icons[name]+'"/></svg>';}

export function portrait(name) {
  const {color,ink}=CREW[name];
  const hair=name==='Mira'?'M8 31V17Q8 6 23 6Q39 5 39 19L41 31L30 31L29 18L18 16L15 32z':
    name==='Rico'?'M12 22V13L21 7L32 9L37 16L33 23L30 15L18 16z':'M10 21l2-10L25 6L37 13L36 20L26 15L15 16z';
  return '<svg viewBox="0 0 48 48" role="img" aria-label="'+name+'"><path fill="'+ink+'" d="M0 0h48v48H0z"/>'+
    '<circle fill="'+color+'" opacity=".47" cx="26" cy="17" r="14"/>'+
    '<path fill="#163743" d="M2 48l4-9 13-6h10l14 6 4 9z"/>'+
    '<path fill="'+color+'" d="M19 29h10v9l-5 4-5-4z"/>'+
    '<path fill="'+color+'" d="M13 16l4-6 15 1 4 7-2 11-7 7h-7l-6-7z"/>'+
    '<path fill="'+ink+'" d="'+hair+'"/><path fill="#422d39" d="M17 22h5v2h-5zm10 0h5v2h-5zM21 30h6v1.4h-6z"/>'+
    '<path stroke="#8effe8" stroke-width="1.8" d="M37 19v9l-5 3M12 19v8"/><path fill="#8effe8" d="M30 30h3v2h-3z"/>'+
    '<path stroke="#e6c37c" stroke-width="1.3" d="M1 8V1h7m39 39v7h-7"/></svg>';
}

function drawRoadNetwork(ctx,sim,chart=false) {
  ctx.fillStyle=chart?'#263f44':'#254049';
  ctx.fillRect(WORLD.west,WORLD.north,92-WORLD.west,WORLD.south-WORLD.north);
  function shoreline(from,to,color){
    ctx.fillStyle=color;ctx.beginPath();
    for(let z=WORLD.north;z<=WORLD.south;z+=10)ctx.lineTo(from(z),z);
    for(let z=WORLD.south;z>=WORLD.north;z-=10)ctx.lineTo(to(z),z);
    ctx.closePath();ctx.fill();
  }
  shoreline(()=>91,z=>tideLine(z)-8,'#3c5d56');
  shoreline(z=>tideLine(z)-8,tideLine,'#a38b5f');
  ctx.fillStyle='#46584c';ctx.fillRect(380,-308,150,145);
  ctx.fillStyle='#5f675b';ctx.fillRect(139,-86,222,36);
  ctx.fillStyle='#8a9477';ctx.fillRect(140,-257,242,26);
  ctx.fillStyle=chart?'#49615f':'#334e59';
  for(const b of sim.world.blocks)ctx.fillRect(b.x-b.w/2,b.z-b.d/2,b.w,b.d);
  ctx.lineCap='butt';
  function line(x,z,a,b,width,color){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(a,b);ctx.stroke();
  }
  for(const x of AVENUES){
    line(x,-399,x,388,x===58?23:18,chart?'#162e37':'#16313f');
    if(chart)line(x,-399,x,388,1.8,x===58?'#dbb273':'#628e8c');
  }
  for(const z of STREETS){
    const to=z===-244?528:z===-68?359:78;
    line(-379,z,to,z,z===-244?21:17,chart?'#172f37':'#152e3e');
    if(chart)line(-379,z,to,z,1.7,z===-244?'#edc18c':'#648c8d');
  }
  if(chart) {
    ctx.strokeStyle='#9bd6cb82';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(WORLD.west,WORLD.north);
    for(let z=WORLD.north;z<=WORLD.south;z+=10)ctx.lineTo(tideLine(z),z);
    ctx.lineTo(WORLD.west,WORLD.south);ctx.closePath();ctx.stroke();
    ctx.strokeRect(380,-308,150,145);
    ctx.strokeRect(140,-86,221,36);
  }
  for(const [x,z] of [[183,-244],[319,-244],[298,-68]]){
    ctx.fillStyle='#e7c198';ctx.fillRect(x-2.5,z-7,5,14);
  }
}

function marker(ctx,x,y,r,fill,diamond=false){
  ctx.fillStyle=fill;
  ctx.beginPath();
  if(diamond){ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();}
  else ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fill();
}

function minimap(ctx,sim){
  const {width:w,height:h}=ctx.canvas, p=sim.focus();
  const angle=sim.player.vehicle?.yaw??sim.player.yaw;
  const zoom=sim.player.vehicle?.parts.mainRotor?.91:1.67;
  const x=w*.50,y=h*.60;
  ctx.fillStyle='#193948';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(x,y);ctx.scale(zoom,zoom);ctx.rotate(-angle);ctx.translate(-p.x,-p.z);
  drawRoadNetwork(ctx,sim);
  const custom=sim.missions.waypoint;
  const site=custom??currentObjective(sim);
  if(site){
    const dx=site.x-p.x,dz=site.z-p.z,d=Math.hypot(dx,dz);
    const scale=Math.min(1,65/Math.max(.01,d));
    const xx=p.x+dx*scale,zz=p.z+dz*scale;
    ctx.strokeStyle=custom?'#83e3dfb8':'#e7b959a9';ctx.lineWidth=2.3;ctx.setLineDash([5,6]);
    ctx.beginPath();ctx.moveTo(p.x,p.z);ctx.lineTo(xx,zz);ctx.stroke();ctx.setLineDash([]);
    marker(ctx,xx,zz,5.8,custom?'#8befe4':'#ffd773',true);
  }
  for(const v of sim.vehicles) {
    if(Math.hypot(v.pos.x-p.x,v.pos.z-p.z)<145&&v!==sim.player.vehicle)marker(ctx,v.pos.x,v.pos.z,1.7,'#badde2');
  }
  for(const {car} of sim.police.units)marker(ctx,car.pos.x,car.pos.z,3.7,'#ff6968');
  if(sim.police.air)marker(ctx,sim.police.air.pos.x,sim.police.air.pos.z,4.8,'#f18aff',true);
  ctx.restore();
  ctx.fillStyle='#95e8db'; ctx.strokeStyle='#101f30';ctx.lineWidth=2.1;
  ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x+8,y+8);ctx.lineTo(x,y+5);ctx.lineTo(x-8,y+8);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.font='bold 17px Consolas';ctx.fillStyle='#e1e9dd';
  ctx.fillText('N',12,27);
  ctx.fillStyle='#c7ede999';ctx.fillRect(12,30,11,2);
}

const labelOffset=[
  [-72,63],[-98,-36],[-36,53],[-8,43],[-34,-31],[-46,-54],
];

export function renderCityChart(canvas,sim,selected){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const ratio=Math.min(devicePixelRatio,2);
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  }
  const ctx=canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);
  const compact=canvas.parentElement.classList.contains('preview-chart');
  const scale=Math.max(.06,Math.min((w-48)/990,(h-25)/810));
  const ox=w*.5-82*scale,oz=h*.50+4*scale;
  const at=(x,z)=>[ox+x*scale,oz+z*scale];
  const background=ctx.createLinearGradient(0,0,w,h);
  background.addColorStop(0,'#102c3beF');background.addColorStop(.72,'#204653eF');background.addColorStop(1,'#122f3ceC');
  ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#a8d5d31c';ctx.lineWidth=1;
  for(let i=20;i<w;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();}
  for(let i=20;i<h;i+=32){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}
  ctx.save();ctx.translate(ox,oz);ctx.scale(scale,scale);
  drawRoadNetwork(ctx,sim,true);
  const regions=[[-1,-391,145,766],[-375,-391,371,326],[-375,-62,371,437],[147,-86,214,36],[147,-257,230,26],[381,-307,146,143]];
  regions.forEach(([x,z,width,height],i)=>{
    ctx.fillStyle=DISTRICTS[i].color+'1c';ctx.fillRect(x,z,width,height);
    ctx.strokeStyle=DISTRICTS[i].color+'76';ctx.lineWidth=2;ctx.strokeRect(x,z,width,height);
  });
  ctx.restore();
  ctx.font='600 9px Consolas';ctx.fillStyle='#9abfc0';
  for(let i=0;i<7;i++)ctx.fillText(String(18+i)+'°',15,27+i*(h-52)/7);
  ctx.font='800 11px Consolas';ctx.fillStyle='#99c2c6';
  const [seaX,seaY]=at(282,125);
  ctx.fillText('M I R A M A R   B A Y',seaX-35,seaY);
  const [bayX,bayY]=at(236,265);
  ctx.fillStyle='#7fb3bd';ctx.font='10px Consolas';ctx.fillText('SOLARIS KEYS WATERS',bayX,bayY);
  const mapKeys=[[GARAGE,'R','#a4e5d9'],[ARMORY,'A','#a4e5d9'],[HOME,'H','#eec78b'],[BOATHOUSE,'G','#8fe5fd']];
  for(const [site,code,color] of mapKeys){
    const [x,z]=at(site.x,site.z);
    ctx.fillStyle='#102833';ctx.fillRect(x-7,z-7,14,14);
    ctx.strokeStyle=color;ctx.strokeRect(x-6.5,z-6.5,13,13);
    ctx.fillStyle=color;ctx.font='bold 9px Consolas';ctx.fillText(code,x-2.8,z+3.3);
  }
  const target=sim.missions.waypoint??sim.gpsTarget??currentObjective(sim);
  if(target){
    const p=sim.focus();
    const [x,z]=at(p.x,p.z),[tx,tz]=at(target.x,target.z);
    ctx.strokeStyle='#ffc979dc';ctx.lineWidth=1.85;ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(x,tz);ctx.lineTo(tx,tz);ctx.stroke();ctx.setLineDash([]);
    marker(ctx,tx,tz,6,'#ffd77e',true);
  }
  DISTRICTS.forEach((district,i)=>{
    const [x,y]=at(district.x,district.z),[a,b]=labelOffset[i];
    const txt=district.name.toUpperCase();
    const font=compact?'800 10.5px "Segoe UI"':'800 13px "Segoe UI"';
    ctx.font=font;
    const tw=ctx.measureText(txt).width+(compact?31:37);
    const previewLabels=[[.48,.77],[.045,.30],[.06,.82],[.69,.55],[.52,.17],[.73,.31]];
    const xx=clamp(compact?w*previewLabels[i][0]:x+a,14,w-tw-8);
    const yy=clamp(compact?h*previewLabels[i][1]:y+b,22,h-15);
    ctx.strokeStyle=district.color+'93';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,yy-6);ctx.lineTo(xx+tw*.46,yy-6);ctx.stroke();
    marker(ctx,x,y,3.7,district.color,true);
    ctx.fillStyle='#0a1f2ceF';ctx.fillRect(xx,yy-17,tw,24);
    ctx.strokeStyle=CAMPAIGN[selected]?.district===i?district.color:district.color+'82';
    ctx.strokeRect(xx+.5,yy-16.5,tw-1,23);
    ctx.fillStyle=district.color;ctx.fillRect(xx,yy-17,2,24);
    ctx.font='700 10px Consolas';ctx.fillText(district.id,xx+7,yy-1);
    ctx.font=font;ctx.fillStyle='#e6ece0';ctx.fillText(txt,xx+(compact?23:25),yy);
  });
  const p=sim.focus(),[px,pz]=at(p.x,p.z);
  marker(ctx,px,pz,6,'#0d2533');marker(ctx,px,pz,4.4,'#8df5df');
  if(sim.missions.waypoint){
    const [x,z]=at(sim.missions.waypoint.x,sim.missions.waypoint.z);
    marker(ctx,x,z,6,'#80e9f3',true);
  }
  ctx.fillStyle='#d5eee0';ctx.font='bold 13px Consolas';ctx.fillText('N',w-29,28);
  ctx.strokeStyle='#a5d4d1';ctx.beginPath();ctx.moveTo(w-25,35);ctx.lineTo(w-25,53);ctx.stroke();
  ctx.fillStyle='#b1d1cb';ctx.font='10px Consolas';ctx.fillText('100 M',w-87,h-16);
  ctx.fillRect(w-89,h-11,100*scale,2);
  canvas.worldAt=(x,y)=>({x:(x-ox)/scale,z:(y-oz)/scale});
}

export function createHUD(){
  const hud=byId('hud');
  const labels={};
  for(const node of hud.querySelectorAll('[id]'))labels[node.id]=node;
  const text=(id,value)=>{const node=labels[id],v=String(value);if(node.textContent!==v)node.textContent=v;};
  const html=(id,value)=>{const node=labels[id];if(node.dataset.model!==value){node.innerHTML=value;node.dataset.model=value;}};
  const show=(id,visible)=>{labels[id].hidden=!visible;};
  const fill=(id,n)=>{labels[id].style.width=clamp(n,0,100)+'%';};
  const ctx=labels.minimap.getContext('2d');
  labels.stars.innerHTML=Array.from({length:5},()=>icon('star')).join('');
  labels.weapons.innerHTML=WEAPONS.map((w,i)=>'<div class="weapon" title="'+w.name+'"><b>'+(i+1)+'</b>'+icon(w.icon)+'</div>').join('');
  labels.abilities.innerHTML=Object.entries(CREW).map(([name,member])=>
    '<div class="ability">'+portrait(name)+'<div><strong>'+member.ability+'</strong><span>'+name+' · '+member.job+
    '</span></div><div class="ability-state"><kbd>'+member.key+'</kbd><b></b></div><i></i></div>').join('');
  const point=new THREE.Vector3();

  function render(sim){
    hud.hidden=sim.mode!=='play';
    if(hud.hidden)return;
    const p=sim.focus(), d=districtAt(p.x,p.z), district=DISTRICTS[d];
    const target=currentObjective(sim),m=sim.missions;
    text('operation',m.alternate?'SIDE ACTIVITY':m.index<CAMPAIGN.length?'OPERATION  '+String(m.index+1).padStart(2,'0')+'  /  '+String(CAMPAIGN.length).padStart(2,'0'):'FREE ROAM');
    text('stage',target?'STAGE '+(target.stage+1)+' / '+target.total:'CAMPAIGN CLEAR');
    text('mission-name',target?.title??'Your Keys');
    text('mission-goal',target?.label??'Choose an activity on the map');
    const timer=m.alternate?.kind==='race'&&m.alternate.step>0;
    text('distance',timer?Math.ceil(m.alternate.time)+' S':target?Math.round(Math.hypot(p.x-target.x,p.z-target.z))+' M':'');
    html('stage-pips',target?Array.from({length:target.total},(_,i)=>'<i class="'+(i===target.stage?'active':i<target.stage?'done':'')+'"></i>').join(''):'');
    const rows=dispatchRows(sim);
    show('dispatch',sim.police.stars>0);
    text('unit-count',rows.length+' UNITS');
    html('unit-table',rows.map(([name,role,dm])=>'<div class="unit"><span>'+name+'</span><span class="tactic '+role.toLowerCase().replace(/ /g,'-')+'">'+role+'</span><span>'+dm+' M</span></div>').join(''));
    text('time',clockLabel(sim.clock));
    text('cash','$'+money.format(sim.stats.money));
    Array.from(labels.stars.children).forEach((star,i)=>star.classList.toggle('lit',i<sim.police.stars));
    labels.stars.setAttribute('aria-label','Wanted level '+sim.police.stars+' of 5');
    show('air-unit',Boolean(sim.police.air));
    text('air-unit',sim.police.spotlight?'IN SIGHT · FALCON-1 SPOTLIGHT':'FALCON-1 · AIR SUPPORT');
    const rank=Math.min(RANKS.length-1,Math.floor(sim.stats.rp/450));
    text('rank',RANKS[rank]);text('rp',money.format(sim.stats.rp)+' RP');fill('rank-fill',rank===RANKS.length-1?100:sim.stats.rp%450/4.5);
    text('district-index',district.id);text('district',district.name);text('street',district.street);
    text('standing',sim.stats.control[d]+'%');fill('standing-fill',sim.stats.control[d]);fill('health',sim.player.health);fill('armor',sim.player.armor);
    minimap(ctx,sim);
    const comms=sim.messages.commsUntil>sim.time;
    show('comms',comms);
    if(comms){
      const crew=sim.messages.crew;
      html('portrait',portrait(crew));html('voice',crew.toUpperCase()+' <span> / '+CREW[crew].job+'</span>');
      text('line',sim.messages.line);
    }
    show('notice',sim.messages.until>sim.time);
    text('notice',sim.messages.notice);
    const w=sim.combat.weapon;
    Array.from(labels.weapons.children).forEach((el,i)=>el.classList.toggle('equipped',i===w));
    text('weapon-name',WEAPONS[w].name);text('ammo',sim.combat.reload?'RELOADING':w<2?'MELEE':sim.combat.ammo[w]+' / '+sim.combat.reserve[w]);
    text('interaction',interactionPrompt(sim));
    const v=sim.player.vehicle;
    Array.from(labels.abilities.children).forEach((el,i)=>{
      const cooldown=sim.cooldowns[i],member=Object.values(CREW)[i];
      el.querySelector('b').textContent=cooldown>0?Math.ceil(cooldown)+'s':i===1&&!v?'IN CAR':'READY';
      el.querySelector('strong').textContent=i===0&&!v?'Call Support':member.ability;
      el.lastElementChild.style.width=100*(1-cooldown/member.cooldown)+'%';
    });
    show('vehicle',Boolean(v));
    show('flight-tape',Boolean(v?.parts.mainRotor));
    show('abilities',!v?.parts.mainRotor||v.pos.y<4);
    if(v){
      const flight=Boolean(v.parts.mainRotor),speed=Math.round(Math.abs(v.speed)*3.6);
      text('vehicle-class',flight?'FLIGHT TELEMETRY':v.parts.water?'MARINE TELEMETRY':v.boost?'NITRO ACTIVE':'VEHICLE TELEMETRY');
      text('gear',flight?(v.pos.y<2?'ON PAD':'AIRBORNE'):'GEAR  '+(v.speed<-.8?'R':speed<2?'N':Math.min(6,1+Math.floor(speed/32))));
      text('speed',speed);text('measurement','KM/H');text('vehicle-name',v.spec.name);
      text('primary-label',flight?'ALT':'NITRO');text('nitro-value',flight?Math.round(v.pos.y)+' M':Math.round(v.nitro)+'%');
      fill('nitro',flight?v.pos.y/2.3:v.nitro);text('hull-value',Math.round(v.hull)+'%');fill('hull',v.hull);
      text('radio',RADIO[sim.audio.radio.station]);
      show('nitro-row',!v.parts.water);
      if(flight){
        const compass=['N','NE','E','SE','S','SW','W','NW'];
        const heading=(Math.round(v.yaw*180/Math.PI)%360+360)%360;
        const bearing=Math.round(heading/45)%8;
        text('heading-left',compass[(bearing+7)%8]);text('heading-right',compass[(bearing+1)%8]);
        text('heading',compass[bearing]+' '+String(heading).padStart(3,'0')+'°');
        text('beacon',target?Math.round(Math.hypot(p.x-target.x,p.z-target.z,p.y-(target.action==='flyby'?103:0)))+' M TO BEACON':'GPS STANDBY');
      }
    }
    const aim=sim.aimUntil>sim.time||sim.controls?.aim;
    show('reticle',Boolean(aim));
    labels.reticle.classList.toggle('hit',sim.hitMarkerUntil>sim.time);
    const enemies=v?[]:[...sim.police.officers,...sim.syndicate].filter(h=>!h.down&&h.markedUntil>sim.time);
    html('target-pips',enemies.map(h=>{
      point.copy(h.group.position);point.y+=2;
      point.project(sim.camera);
      if(Math.abs(point.x)>.49||Math.abs(point.y)>.71||Math.abs(point.z)>1)return '';
      return '<div class="hostile" style="left:'+((point.x+1)*50).toFixed(2)+'%;top:'+((1-point.y)*50).toFixed(2)+'%">'+
        Array.from({length:4},(_,i)=>'<i'+(h.health>i*25?' class="live"':'')+'></i>').join('')+'</div>';
    }).join(''));
    labels.damage.classList.toggle('active',sim.hitUntil>sim.time);
  }
  return {render};
}
