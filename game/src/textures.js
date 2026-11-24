import * as THREE from 'three';
import { seededRandom } from './config.js';

function drawTexture(width, height, painter, repeat = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  painter(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function noise(ctx, width, height, count, seed, opacity) {
  const rng = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng() < .48 ? 'rgba(0,0,0,' + opacity + ')' : 'rgba(255,255,255,' + opacity + ')';
    ctx.fillRect(rng() * width, rng() * height, 1 + rng() * 4, 1 + rng() * 3);
  }
}

export function buildSurfaceLibrary() {
  const asphalt = drawTexture(256, 256, (ctx,w,h) => {
    ctx.fillStyle = '#5a5758'; ctx.fillRect(0,0,w,h);
    noise(ctx,w,h,6600,24,.10);
    const g = ctx.createLinearGradient(0,0,w,0);
    g.addColorStop(0,'#3d3d4108'); g.addColorStop(.83,'#17182033'); g.addColorStop(1,'#2f2e300a');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }, true);
  const paving = drawTexture(256,256,(ctx,w,h) => {
    ctx.fillStyle='#bfb4a6'; ctx.fillRect(0,0,w,h);
    noise(ctx,w,h,3100,16,.08);
    ctx.strokeStyle='#73696955'; ctx.lineWidth=2;
    for(let i=0;i<9;i++){ctx.strokeRect(i*32,0,32,256);ctx.strokeRect(0,i*32,256,32);}
  },true);
  const sand = drawTexture(256,256,(ctx,w,h) => {
    ctx.fillStyle='#e3c28d'; ctx.fillRect(0,0,w,h);
    noise(ctx,w,h,6500,19,.12);
    for(let i=0;i<18;i++){
      ctx.fillStyle='#7e552315';
      ctx.fillRect(0,i*15,256,2);
    }
  },true);
  const decks = drawTexture(128,128,(ctx,w,h) => {
    ctx.fillStyle='#a67859'; ctx.fillRect(0,0,w,h);
    noise(ctx,w,h,2000,52,.09);
    ctx.strokeStyle='#61453377';
    for(let y=0;y<h;y+=16){ ctx.strokeRect(0,y,w,16);ctx.strokeRect((y%32)*3,y,32,16); }
  },true);
  for (const t of [asphalt,paving,sand,decks]) t.repeat.set(4,4);
  return { asphalt, paving, sand, decks };
}

export function towerFacade(seed, evening = false, style = 'glass') {
  return drawTexture(256, 512, (ctx,w,h) => {
    const rng = seededRandom(seed);
    const glass = style === 'glass';
    const gradient = ctx.createLinearGradient(0,0,w,h);
    gradient.addColorStop(0,glass?'#a6c5c6':'#f3e8c8');
    gradient.addColorStop(.42,glass?'#64868f':'#ecdbc3');
    gradient.addColorStop(1,glass?'#233d58':'#b8a996');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    const cols = glass ? 8 : 5;
    const rows = glass ? 18 : 8;
    const dx = w/cols, dy = h/rows;
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
      const x=col*dx,y=row*dy;
      ctx.fillStyle=glass?'#182c42':'#c3b5a0';ctx.fillRect(x+2,y+3,dx-4,dy-5);
      const window = ctx.createLinearGradient(x,y,x+dx,y+dy);
      const lit = rng() < (evening ? .40 : .09);
      window.addColorStop(0,lit?'#f8d89d':glass?'#91b3b6':'#718d8e');
      window.addColorStop(1,lit?'#b98b65':glass?'#345871':'#344955');
      ctx.fillStyle=window;
      const inset=glass?4:9;
      ctx.fillRect(x+inset,y+(glass?5:12),dx-inset*2,dy-(glass?9:19));
      ctx.fillStyle=lit?'#faeabb66':'#172b3555';
      ctx.fillRect(x+dx*.53,y+6,2,dy-9);
      if(!glass){ctx.fillStyle='#e5d3b4';ctx.fillRect(x+6,y+dy-7,dx-12,4);}
    }
    noise(ctx,w,h,1850,seed,.07);
  });
}

export function signTexture(title, subtitle, accent, background = '#15222b') {
  return drawTexture(512, 128, (ctx,w,h) => {
    ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.strokeRect(6,6,w-12,h-12);
    ctx.globalAlpha=.32;ctx.lineWidth=1;ctx.strokeRect(13,13,w-26,h-26);ctx.globalAlpha=1;
    for(const x of [21,w-21]){
      ctx.fillStyle=accent;ctx.fillRect(x-2,88,4,18);
    }
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor=accent;ctx.shadowBlur=17;ctx.fillStyle=accent;
    ctx.font='900 55px "Segoe UI", sans-serif';ctx.fillText(title,w/2,52,w-38);
    ctx.shadowBlur=0;ctx.font='bold 17px monospace';ctx.fillText(subtitle,w/2,98,w-53);
  });
}

export function policeLivery(word, accent) {
  return drawTexture(512, 128, (ctx,w,h) => {
    ctx.fillStyle='#eae8df';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#203249';ctx.fillRect(0,5,w,16);ctx.fillRect(0,105,w,22);
    ctx.fillStyle=accent;ctx.fillRect(0,91,w,6);
    ctx.fillStyle='#24374b';ctx.font='900 76px Arial';ctx.textAlign='center';
    ctx.fillText(word,274,83,395);
    ctx.fillStyle='#e5ae55';
    ctx.beginPath();ctx.moveTo(16,42);ctx.lineTo(59,42);ctx.lineTo(58,71);ctx.lineTo(37,86);ctx.lineTo(17,71);ctx.fill();
  });
}

export function shadowTexture() {
  return drawTexture(128,128,(ctx,w,h) => {
    const gradient=ctx.createRadialGradient(w/2,h/2,8,w/2,h/2,w/2);
    gradient.addColorStop(0,'#0c1422a9');gradient.addColorStop(.58,'#0c142264');gradient.addColorStop(1,'#0c142200');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  });
}
