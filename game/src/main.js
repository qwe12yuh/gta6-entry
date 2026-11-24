import { clamp } from './config.js';
import { advanceSimulation, chooseTime, connectControls, createEngine, createSimulation } from './engine.js';
import { createHUD } from './hud.js';
import { createSafehouseMenu } from './save.js';
import { frameTitle, stageShowcase } from './shots.js';

const canvas=document.getElementById('game');

function startSolarisKeys(){
  const engine=createEngine(canvas);
  const sim=createSimulation(engine);
  const hud=createHUD();
  let interact=false;
  const activeInputs=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','ControlLeft','ControlRight','KeyF','Pointer','KeyE']);
  const releasePreview=()=>{
    if(!sim.director)return;
    sim.director=null;sim.cameraCut=true;
  };
  sim.frameTitle=()=>{sim.director=null;frameTitle(sim);};
  const menu=createSafehouseMenu(sim,releasePreview);
  const shot=new URLSearchParams(location.search).get('shot');
  const showcase=stageShowcase(sim,shot);
  if(!showcase)frameTitle(sim);
  menu.render();

  function act(code){
    sim.audio.unlock();
    if(code==='Escape'){
      if(sim.mode==='play')menu.setMode('hub','pause');
      else if(sim.mode==='hub')menu.setMode('play');
      else if(sim.mode==='start')menu.setMode('start');
      return;
    }
    if(code==='KeyM'&&['play','hub'].includes(sim.mode)){
      menu.toggleAtlas();return;
    }
    if(sim.mode!=='play')return;
    if(activeInputs.has(code)||code==='KeyV')releasePreview();
    if(code==='KeyE')interact=true;
    else if(code==='KeyF')sim.leaveVehicle();
    else if(code==='KeyR')sim.combat.load();
    else if(/^Digit[1-7]$/.test(code))sim.combat.select(Number(code.at(-1))-1);
    else if(code==='KeyV'){ sim.player.camera=(sim.player.camera+1)%4;sim.cameraCut=true; }
    else if(code==='KeyT')chooseTime(sim);
    else if(code==='KeyQ')sim.notice('RADIO  /  '+sim.audio.cycle());
    else if(code==='KeyZ')sim.useCrew(0);
    else if(code==='KeyX')sim.useCrew(1);
    else if(code==='KeyC')sim.useCrew(2);
  }

  function look(dx,dy){
    if(sim.mode!=='play')return;
    releasePreview();
    const p=sim.player;
    if(p.vehicle)p.orbit=clamp(p.orbit+dx*.0032,-2.8,2.8);
    else p.yaw+=dx*.0029;
    p.pitch=clamp(p.pitch-dy*.0016,-.42,.42);
  }

  sim.controls=connectControls(canvas,act,look);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.mode==='play'&&!sim.director)menu.setMode('hub','pause');});
  let last=performance.now(),frames=0,uiTime=0;
  function frame(now){
    if(sim.director?.finished&&sim.mode===(shot==='start'?'start':'play')){
      last=now;menu.render();requestAnimationFrame(frame);return;
    }
    let dt=clamp((now-last)/1000,.001,.084);
    last=now;
    if(sim.director?.shot&&!sim.director.finished){
      dt=Math.min(1/30,sim.director.captureAt-sim.time);
    }
    while(dt>.0005){
      const step=Math.min(dt,1/40);
      advanceSimulation(sim,step,sim.controls,interact);
      interact=false;dt-=step;
    }
    engine.draw(sim, Math.min(.084,(now-(frame.last??now-16))/1000));
    frame.last=now;
    menu.render();
    const uiDue=now>=uiTime;
    const capture=sim.director?.shot&&sim.time>=sim.director.captureAt-.0006;
    if(uiDue||!frames||capture){uiTime=now+60;hud.render(sim);}
    frames++;
    if(capture){sim.director.finished=true;window.__shotReady=true;}
    if(!showcase&&frames===4)window.__shotReady=true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

try { startSolarisKeys(); }
catch(error) {
  const alert=document.getElementById('error');
  alert.hidden=false;alert.textContent='A WebGL 2 context is needed to open Solaris Keys.';
  throw error;
}
