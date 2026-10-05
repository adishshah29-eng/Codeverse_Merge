// Small synthesized cues; no sound files or network connection are needed.
let audioContext;
let master;
let enabled=true;
let finaleTrack;
let finaleTrackActive=false;
let finaleFallbackPlayed=false;
let finaleFadeTimer;

function context(){
 if(!enabled||typeof window==='undefined')return null;
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass)return null;
 if(!audioContext){
  audioContext=new AudioContextClass();
  master=audioContext.createGain();
  master.gain.value=.8;
  master.connect(audioContext.destination);
 }
 return audioContext;
}

export function prepareAudio(){
 const ctx=context();
 if(ctx?.state==='suspended')void ctx.resume().catch(()=>{});
}

export function setSoundEnabled(value){
 enabled=value;
 if(master&&audioContext)master.gain.setTargetAtTime(value?.8:0,audioContext.currentTime,.025);
 if(finaleTrack){
  if(value&&finaleTrackActive)void finaleTrack.play().catch(()=>{});
  else if(!value)finaleTrack.pause();
 }
 if(value)prepareAudio();
}

function tone(ctx,{at=0,from=220,to=220,duration=.25,volume=.08,type='sine'}){
 const start=ctx.currentTime+at;
 const oscillator=ctx.createOscillator();
 const gain=ctx.createGain();
 oscillator.type=type;
 oscillator.frequency.setValueAtTime(from,start);
 oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,to),start+duration);
 gain.gain.setValueAtTime(.0001,start);
 gain.gain.exponentialRampToValueAtTime(volume,start+.015);
 gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 oscillator.connect(gain).connect(master);
 oscillator.start(start);
 oscillator.stop(start+duration+.02);
}

function rush(ctx,{at=0,duration=.55,volume=.07,low=120,high=1800}){
 const start=ctx.currentTime+at;
 const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);
 const samples=buffer.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 const source=ctx.createBufferSource();source.buffer=buffer;
 const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.Q.value=.7;
 filter.frequency.setValueAtTime(low,start);
 filter.frequency.exponentialRampToValueAtTime(high,start+duration);
 const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,start);
 gain.gain.exponentialRampToValueAtTime(volume,start+duration*.3);
 gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 source.connect(filter).connect(gain).connect(master);
 source.start(start);source.stop(start+duration);
}

function playClearFallback(ctx){
 [392,494,588].forEach((frequency,i)=>tone(ctx,{at:i*.13,from:frequency,to:frequency*.997,duration:.75,volume:.13,type:'sine'}));
}

function playFinaleFallback(){
 if(finaleFallbackPlayed||!enabled)return;
 finaleFallbackPlayed=true;
 finaleTrackActive=false;
 const ctx=context();
 if(ctx)playClearFallback(ctx);
}

export function startFinaleMusic(){
 finaleFallbackPlayed=false;
 const ctx=context();
 if(!ctx)return;
 if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
 if(typeof window==='undefined'||typeof window.Audio==='undefined'){
  playFinaleFallback();return;
 }
 if(!finaleTrack){
  finaleTrack=new window.Audio('/audio/bella-ciao.mp3');
  finaleTrack.preload='auto';
 }
 finaleTrack.pause();
 finaleTrack.currentTime=0;
 finaleTrackActive=true;
 finaleTrack.onerror=playFinaleFallback;
 const playback=finaleTrack.play();
 if(playback&&typeof playback.catch==='function'){
  void playback.catch(playFinaleFallback);
 }
}

export function stopFinaleMusic(){
 finaleTrackActive=false;
 if(finaleFadeTimer){clearInterval(finaleFadeTimer);finaleFadeTimer=undefined;}
 if(finaleTrack){
  finaleTrack.pause();
  finaleTrack.currentTime=0;
  finaleTrack.volume=1;
 }
}

export function finishFinaleMusic(fadeMs=2000){
 finaleTrackActive=false;
 if(!finaleTrack)return;
 if(finaleFadeTimer){clearInterval(finaleFadeTimer);finaleFadeTimer=undefined;}
 const initialVolume=finaleTrack.volume;
 const startedAt=Date.now();
 finaleFadeTimer=setInterval(()=>{
  const progress=Math.min(1,(Date.now()-startedAt)/fadeMs);
  finaleTrack.volume=initialVolume*(1-progress);
  if(progress>=1){
   clearInterval(finaleFadeTimer);finaleFadeTimer=undefined;
   finaleTrack.pause();finaleTrack.currentTime=0;finaleTrack.volume=1;
  }
 },50);
}

export function playBeat(beat){
 const ctx=context();if(!ctx)return;
 if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
 if(finaleTrackActive)return;
 switch(beat){
  case 'vault':
   for(let i=0;i<3;i++)tone(ctx,{at:i*.19,from:480,to:165,duration:.13,volume:.18,type:'triangle'});
   tone(ctx,{at:.2,from:62,to:42,duration:1.1,volume:.15,type:'sawtooth'});
   break;
  case 'tunnel':
   rush(ctx,{duration:1.3,volume:.22,low:180,high:1000});
   tone(ctx,{from:84,to:58,duration:1.25,volume:.12,type:'sine'});
   break;
  case 'boarding':
   rush(ctx,{duration:.9,volume:.18,low:1500,high:320});
   tone(ctx,{from:245,to:90,duration:.85,volume:.16,type:'triangle'});
   break;
  case 'escape':
   tone(ctx,{from:65,to:135,duration:1.2,volume:.16,type:'sawtooth'});
   rush(ctx,{at:.2,duration:1.1,volume:.13,low:220,high:850});
   break;
  case 'clear':
   break;
 }
}
