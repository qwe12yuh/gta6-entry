import { RADIO } from './config.js';

const PATTERNS=[
  [45,45,52,57,48,48,55,60,43,43,50,55,40,47,52,55],
  [48,60,55,48,51,63,58,51,46,58,53,46,43,55,50,43],
  [42,54,57,61,45,57,60,64,38,50,54,57,40,52,55,59],
];

export function createAudio(){
  let context, master, engine, air, siren, motorGain, airGain, sirenGain, receiver, next=0, step=0, noise;
  const radio={station:1,volume:.63,muted:false};

  function unlock(){
    if(!context){
      context=new AudioContext();
      master=context.createGain();master.gain.value=radio.volume;master.connect(context.destination);
      const hum=context.createBiquadFilter();hum.type='lowpass';hum.frequency.value=185;
      hum.connect(master);
      receiver=context.createGain();receiver.gain.value=.29;receiver.connect(master);
      function continuous(wave,feed){
        const source=context.createOscillator(), gain=context.createGain();
        source.type=wave;gain.gain.value=0;
        source.connect(gain);gain.connect(feed);source.start();
        return [source,gain];
      }
      [engine,motorGain]=continuous('sawtooth',hum);
      [air,airGain]=continuous('triangle',hum);
      [siren,sirenGain]=continuous('sine',master);
      air.frequency.value=19;
      noise=context.createBuffer(1,context.sampleRate*.53,context.sampleRate);
      const samples=noise.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
  }

  function synth(freq,end,length,volume,wave='triangle',at=context.currentTime,bus=master){
    const osc=context.createOscillator(), gain=context.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(freq,at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1,end),at+length);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    osc.connect(gain);gain.connect(bus);osc.start(at);osc.stop(at+length+.02);
  }

  function noiseBurst(length,volume,frequency){
    const at=context.currentTime;
    const sample=context.createBufferSource(), gain=context.createGain(), filter=context.createBiquadFilter();
    sample.buffer=noise;filter.type='lowpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    sample.connect(filter);filter.connect(gain);gain.connect(master);sample.start();sample.stop(at+length);
  }

  function effect(name,variant=0){
    if(!context||context.state!=='running')return;
    if(name==='pickup'){synth(440,675,.16,.11);synth(659,880,.23,.06,'sine',context.currentTime+.09);}
    if(name==='shot'){noiseBurst(.16,.26,2400+variant*200);synth(125,43,.11,.13);}
    if(name==='blast'){noiseBurst(.48,.43,910);synth(83,29,.43,.32,'sine');}
    if(name==='hit'||name==='punch'){noiseBurst(.14,.16,480);synth(107,45,.12,.13);}
    if(name==='reload')noiseBurst(.08,.08,4600);
  }

  function update(vehicle,wanted,dist,paused){
    if(!context||context.state!=='running')return;
    const now=context.currentTime;
    master.gain.setTargetAtTime(radio.muted?0:radio.volume,now,.09);
    const drive=Boolean(vehicle&&!paused);
    const speed=Math.abs(vehicle?.speed??0);
    engine.frequency.setTargetAtTime(31+speed*1.65+(vehicle?.boost?19:0),now,.052);
    motorGain.gain.setTargetAtTime(drive&&!vehicle.parts.mainRotor?(vehicle.boost?.16:.079):0,now,.06);
    airGain.gain.setTargetAtTime(drive&&(vehicle.parts.mainRotor||vehicle.drift)?vehicle.drift?.11:.16:0,now,.08);
    air.frequency.setTargetAtTime(vehicle?.drift?119:23,now,.06);
    siren.frequency.setTargetAtTime(586+Math.sin(now*5.4)*201,now,.045);
    sirenGain.gain.setTargetAtTime(wanted&&!paused?Math.max(0,.075-dist*.0008):0,now,.12);
    if(!drive||!radio.station){next=now+.04;return;}
    const pattern=PATTERNS[radio.station-1];
    const beat=[.24,.19,.32][radio.station-1];
    if(next<now-.12)next=now+.02;
    while(next<now+.085){
      const note=440*2**((pattern[step%pattern.length]-69)/12);
      synth(note,note,beat*.92,.105,radio.station===2?'square':'triangle',next,receiver);
      if(step%2===0)synth(110,46,.12,.16,'sine',next,receiver);
      if(step%4===2)synth(note*2,note*2,beat*1.9,.065,'sine',next+.025,receiver);
      step++;next+=beat;
    }
  }
  return {unlock,effect,update,radio,cycle(){radio.station=(radio.station+1)%RADIO.length;return RADIO[radio.station];}};
}
