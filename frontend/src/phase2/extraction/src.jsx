import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as THREE from 'three';
import App from './App.jsx';
import './style.css';

export function Vault({unlocked,opening,playback=0,onBeat,onFinish,skip=false,crewSize=4}){
 const host=useRef();const state=useRef({unlocked,opening,playback,onBeat,onFinish,skip,crewSize});state.current={unlocked,opening,playback,onBeat,onFinish,skip,crewSize};
 useEffect(()=>{
  const el=host.current,scene=new THREE.Scene();scene.background=new THREE.Color('#111014');scene.fog=new THREE.Fog('#111014',24,65);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;el.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,1,.1,50);camera.position.set(0.4,1.0,10.8);camera.lookAt(0,0,0);
  const metal=new THREE.MeshStandardMaterial({color:0x53565e,metalness:.85,roughness:.32});const dark=new THREE.MeshStandardMaterial({color:0x25262b,metalness:.7,roughness:.48});const edge=new THREE.MeshStandardMaterial({color:0x868991,metalness:.95,roughness:.23});
  function box(w,h,d,mat,x=0,y=0,z=0,parent=scene){let mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  function ring(r,t,mat,z,parent=scene){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,20,100),mat);mesh.position.z=z;parent.add(mesh);return mesh}
  // Cut a circular opening into the wall; the interior is real depth behind it.
  const wallShape=new THREE.Shape();wallShape.moveTo(-7,-5);wallShape.lineTo(7,-5);wallShape.lineTo(7,5);wallShape.lineTo(-7,5);wallShape.closePath();
  const aperture=new THREE.Path();aperture.absarc(0,0,2.42,0,Math.PI*2,true);wallShape.holes.push(aperture);
  const wall=new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape,{depth:.45,bevelEnabled:false,curveSegments:80}),dark);wall.position.z=-.65;scene.add(wall);
  const tunnelMaterial=new THREE.MeshStandardMaterial({color:0x272d31,roughness:.65,metalness:.5,side:THREE.BackSide});
  const tunnel=new THREE.Mesh(new THREE.CylinderGeometry(2.42,2.42,14,80,1,true),tunnelMaterial);tunnel.rotation.x=Math.PI/2;tunnel.position.z=-7.5;scene.add(tunnel);
  const lightMaterial=new THREE.MeshStandardMaterial({color:0xffdb9c,emissive:0xffbc63,emissiveIntensity:3});
  const gold=new THREE.MeshStandardMaterial({color:0xd7a54d,roughness:.23,metalness:.82});
  box(4.4,.14,14,dark,0,-1.75,-7.5);
  for(let z=-1.1;z>-14;z-=2.1){ring(2.34,.065,metal,z);for(let x of [-1.66,1.66]){box(.075,.025,1.2,lightMaterial,x,-1.66,z);box(.045,.54,.08,lightMaterial,x,.7,z);}box(3.5,.013,.035,metal,0,-1.672,z);}
  for(let z of [-3,-7,-11]){const lamp=new THREE.PointLight(0xffc884,9,5);lamp.position.set(0,1.6,z);scene.add(lamp);}
  for(let side of [-1,1]){for(let row=0;row<2;row++){let x=side*1.12,z=-4.2-row*2.5;box(.9,.65,1.25,metal,x,-1.36,z);for(let stack=0;stack<2;stack++)for(let k=0;k<3;k++){const bar=box(.2,.12,.58,gold,x+(k-1)*.24,-.96+stack*.13,z);bar.rotation.y=.04*(k-1);}}}
  const exitDoors=[box(2.4,4.8,.18,metal,-1.2,0,-14.5),box(2.4,4.8,.18,metal,1.2,0,-14.5)];
  box(.055,3.7,.04,lightMaterial,0,0,-14.38);
  const exitSeam=scene.children[scene.children.length-1];
  // A loading bay and waiting transport sit beyond the tunnel doors.
  const concrete=new THREE.MeshStandardMaterial({color:0x252c32,roughness:.92});
  box(14,.15,38,concrete,0,-1.8,-33);box(.2,9,35,concrete,-7,2,-32);box(.2,9,35,concrete,7,2,-32);box(14,.15,35,concrete,0,6,-32);
  for(let z=-18;z>-47;z-=6){for(let x of [-5.6,5.6]){box(.3,7,.4,metal,x,1.7,z);box(.06,1.8,.08,lightMaterial,x,.6,z);}box(6,.04,.4,lightMaterial,0,5.4,z);const lamp=new THREE.PointLight(0x9ac8d8,25,11);lamp.position.set(0,4,z);scene.add(lamp);}
  for(let x of [-2.4,2.4])box(.065,.015,32,gold,x,-1.712,-32);
  const van=new THREE.Group();van.position.set(0,-.25,-22);scene.add(van);
  const vanPaint=new THREE.MeshStandardMaterial({color:0x182c31,roughness:.31,metalness:.75});
  box(2.55,.14,5.4,vanPaint,0,-.65,0,van);box(2.55,.14,5.4,vanPaint,0,1.68,0,van);box(.12,2.4,5.4,vanPaint,-1.23,.48,0,van);box(.12,2.4,5.4,vanPaint,1.23,.48,0,van);box(2.55,2.4,.12,vanPaint,0,.48,-2.6,van);box(2.65,.18,.22,edge,0,-.42,2.8,van);
  for(let side of [-1,1]){const rearDoor=box(1.18,2,.1,metal,side*1.65,.6,2.45,van);rearDoor.rotation.y=side*1.1;box(.15,.46,.12,new THREE.MeshStandardMaterial({color:0xff2c31,emissive:0xff1726,emissiveIntensity:4}),side*1.14,-.05,2.84,van);for(let z of [-1.7,1.7]){let tire=new THREE.Mesh(new THREE.CylinderGeometry(.57,.57,.25,24),dark);tire.rotation.z=Math.PI/2;tire.position.set(side*1.29,-.87,z);van.add(tire);}}
  // Four detailed crew members fit in two staggered rows; one is hidden for three-person teams.
  const black=new THREE.MeshStandardMaterial({color:0x15191e,roughness:.86});
  const vest=new THREE.MeshStandardMaterial({color:0x252a31,roughness:.9});
  const trim=new THREE.MeshStandardMaterial({color:0xd3b976,roughness:.68,metalness:.2});
  function ball(parent,r,mat,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
  const crew=[];
  const positions=[[-.38,2.25,0],[.38,2.25,0],[-.91,1.78,.28],[.91,1.78,.28]];
  const suitColors=[0x9b2638,0xaa2c3b,0x872332,0x9f303a];
  const skinColors=[0xc99070,0x8d5a47,0xe0ad89,0x654638];
  const hairColors=[0x1b1718,0x2d211d,0x241b1d,0x18191b];
  positions.forEach(([x,z,lift],index)=>{
   const suit=new THREE.MeshStandardMaterial({color:suitColors[index],roughness:.88});
   const skin=new THREE.MeshStandardMaterial({color:skinColors[index],roughness:.83});
   const hair=new THREE.MeshStandardMaterial({color:hairColors[index],roughness:.94});
   const person=new THREE.Group();person.position.set(x,lift,z);person.scale.setScalar(index>1?.94:.98);van.add(person);
   const torso=new THREE.Mesh(new THREE.CylinderGeometry(.19,.25,.59,12),suit);torso.position.set(0,.37,0);person.add(torso);
   box(.34,.43,.075,vest,0,.37,.19,person);
   for(const side of [-1,1]){
    box(.045,.5,.035,black,side*.16,.42,.235,person);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.105,.085,.45,10),suit);leg.position.set(side*.135,-.19,0);person.add(leg);
    box(.17,.12,.3,black,side*.135,-.48,.09,person);
   }
   box(.48,.075,.33,black,0,.06,0,person);
   box(.08,.06,.045,trim,0,.06,.19,person);
   box(.18,.035,.04,trim,0,.67,.14,person);
   const neck=new THREE.Mesh(new THREE.CylinderGeometry(.08,.09,.13,10),skin);neck.position.y=.75;person.add(neck);
   ball(person,.17,skin,0,1.02,.02,1,1.08,.94);
   const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.173,20,14,0,Math.PI*2,0,Math.PI*.52),hair);hairCap.position.set(0,1.04,.01);person.add(hairCap);
   for(const side of [-1,1]){
    ball(person,.034,skin,side*.162,1.01,.02,.65,1,.7);
    ball(person,.011,black,side*.063,1.045,.178,.75,1,.45);
    box(.055,.009,.012,hair,side*.063,1.095,.177,person);
    box(.045,.11,.03,black,side*.176,1.03,.01,person);
   }
   ball(person,.028,skin,0,.995,.185,.58,.78,.7);
   box(.06,.01,.012,hair,0,.92,.165,person);
   box(.07,.016,.025,black,-.16,.97,.105,person);
   const radio=box(.13,.19,.07,black,.25,.28,.08,person);radio.rotation.z=-.1;
   const arms=[];
   for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.23,.6,0);person.add(arm);
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(.09,.075,.29,10),suit);upper.position.y=-.15;arm.add(upper);
    const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.076,.065,.26,10),suit);forearm.position.set(0,-.405,.02);arm.add(forearm);
    ball(arm,.072,black,0,-.55,.04,1,.82,1);
    arms.push({arm,side});
   }
   crew.push({person,arms,index,baseY:lift});
  });
  for(let side of [-1,1]){ball(van,.28,dark,side*.85,-.39,2.45,1,.7,.8);for(let k=0;k<3;k++){const ingot=box(.19,.075,.27,gold,side*.85+(k-1)*.065,-.16+k*.055,2.44,van);ingot.rotation.y=k*.22}}
  const cargoLamp=new THREE.PointLight(0xffe7cf,13,5);cargoLamp.position.set(0,1.4,3.4);van.add(cargoLamp);
  const rearGlow=new THREE.PointLight(0xff2037,2,6);rearGlow.position.set(0,.3,3.1);van.add(rearGlow);
  const exitLight=new THREE.PointLight(0xd2e7f2,55,22);exitLight.position.set(0,2,-44);scene.add(exitLight);
  const signCanvas=document.createElement('canvas');signCanvas.width=768;signCanvas.height=160;const ctx=signCanvas.getContext('2d');ctx.fillStyle='#101b20';ctx.fillRect(0,0,768,160);ctx.fillStyle='#d5f5e8';ctx.font='bold 54px Arial';ctx.textAlign='center';ctx.fillText('EXTRACTION  /  NORTH 07',384,98);const signTex=new THREE.CanvasTexture(signCanvas);box(4.8,1,.04,new THREE.MeshBasicMaterial({map:signTex}),0,3.4,-18);
  ring(2.64,.26,metal,-.1);ring(2.42,.08,edge,.03);
  const hinge=new THREE.Group();hinge.position.set(-2.35,0,0);scene.add(hinge);const door=new THREE.Group();door.position.x=2.35;hinge.add(door);
  let disk=new THREE.Mesh(new THREE.CylinderGeometry(2.37,2.37,.48,96),metal);disk.rotation.x=Math.PI/2;door.add(disk);ring(2.15,.04,edge,.26,door);ring(1.96,.035,dark,.27,door);
  for(let i=0;i<24;i++){let a=i*Math.PI/12;box(.085,.085,.07,edge,Math.cos(a)*2.23,Math.sin(a)*2.23,.28,door)}
  const wheel=new THREE.Group();wheel.position.z=.59;door.add(wheel);ring(.8,.075,edge,0,wheel);let hub=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.25,24),edge);hub.rotation.x=Math.PI/2;wheel.add(hub);
  for(let i=0;i<6;i++){const arm=box(.07,.78,.07,metal,0,.39,0,wheel);const pivot=new THREE.Group();wheel.remove(arm);pivot.add(arm);pivot.rotation.z=i*Math.PI/3;wheel.add(pivot)}
  const bolts=[];for(let i=0;i<4;i++){let g=new THREE.Group();g.rotation.z=i*Math.PI/2;door.add(g);let b=box(.24,.8,.22,edge,0,2.03,.35,g);bolts.push(b);box(.42,.3,.31,dark,0,1.75,.31,g)}
  for(let x of [-4.1,4.1]){box(.06,7,.04,new THREE.MeshStandardMaterial({color:0xf12742,emissive:0xe72039,emissiveIntensity:4}),x,0,-.7);for(let y of [-3,0,3])box(1.3,.025,.02,metal,x,y,-.76)}
  const floor=box(16,.1,16,dark,0,-2.85,1);scene.add(new THREE.HemisphereLight(0xb6c6e5,0x15121a,2));const key=new THREE.DirectionalLight(0xd9e3ff,4);key.position.set(1,5,6);scene.add(key);const red=new THREE.PointLight(0xff1230,32,14);red.position.set(-4,0,3);scene.add(red);const warm=new THREE.PointLight(0xffc368,0,9);warm.position.set(0,0,1);scene.add(warm);
  let frame,t=0,openStarted=null,lastPlayback=-1,lastBeat='',finished=false;const clock=new THREE.Clock();function resize(){const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}let observer=new ResizeObserver(resize);observer.observe(el);resize();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth=(v)=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v)};
  function animate(){frame=requestAnimationFrame(animate);t=clock.getElapsedTime();const s=state.current;const startZ=camera.aspect<1?12.4:10.8;bolts.forEach((b,i)=>{const target=i<s.unlocked?1.58:2.03;b.position.y+=(target-b.position.y)*.06});
   if(s.opening){if(openStarted===null||lastPlayback!==s.playback){openStarted=t;lastPlayback=s.playback;lastBeat='';finished=false;}const elapsed=(reduced||s.skip)?24:t-openStarted;const doorP=smooth((elapsed-1.3)/5.5),travel=smooth((elapsed-7)/9),exitP=smooth((elapsed-12)/2.5),depart=smooth((elapsed-18)/6);
    wheel.rotation.z=Math.min(elapsed/1.3,1)*Math.PI*1.1;hinge.rotation.y=-1.8*doorP;warm.intensity=3*doorP;
    camera.position.set(.4*(1-travel),1-.95*travel,startZ+(-15.6-startZ)*travel);camera.lookAt(0,.05*travel,-26*travel);camera.fov=40+12*travel;camera.updateProjectionMatrix();
    exitDoors[0].position.x=-1.2-exitP*2.4;exitDoors[1].position.x=1.2+exitP*2.4;exitSeam.visible=exitP<.03;van.position.z=-22-25*depart;
    const follow=smooth((elapsed-17)/3);camera.position.z=THREE.MathUtils.lerp(camera.position.z,van.position.z+6.5,follow);camera.position.y=THREE.MathUtils.lerp(camera.position.y,.65,follow);camera.lookAt(0,.3,THREE.MathUtils.lerp(-26*travel,van.position.z+2,follow));
    const celebration=smooth((elapsed-17)/2);
    crew.forEach(({person,arms,index,baseY})=>{person.visible=index<s.crewSize;person.position.y=baseY+(reduced?0:Math.sin(t*3.2+index*1.7)*.018*celebration);arms.forEach(({arm,side},armIndex)=>{const wave=(index+armIndex)%2===0?1.85:.35;arm.rotation.z=side*(.18+celebration*(wave+(reduced?0:Math.sin(t*3.3+index)*.09)))});});
    const beat=elapsed<7?'vault':elapsed<13?'tunnel':elapsed<18?'boarding':elapsed<23?'escape':'clear';if(beat!==lastBeat){lastBeat=beat;s.onBeat?.(beat)}if(elapsed>=28&&!finished){finished=true;s.onFinish?.()}
   }else{openStarted=null;finished=false;lastBeat='';wheel.rotation.z=0;hinge.rotation.y=0;warm.intensity=0;camera.position.set(.4,1,startZ);camera.lookAt(0,0,0);camera.fov=40;camera.updateProjectionMatrix();exitDoors[0].position.x=-1.2;exitDoors[1].position.x=1.2;exitSeam.visible=true;van.position.z=-22;crew.forEach(({person,index})=>{person.visible=index<s.crewSize})}
   red.intensity=reduced?25:25+Math.sin(t*1.4)*6;renderer.render(scene,camera)}animate();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();const materials=new Set();scene.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material)});materials.forEach(m=>m.dispose());signTex.dispose();el.replaceChildren()};
 },[]);return <div className="vault-canvas" ref={host} aria-label="Interactive three-dimensional steel vault"/>;
}
if (typeof document !== 'undefined' && document.getElementById('root') && window.__STANDALONE_EXTRACTION__) {
  createRoot(document.getElementById('root')).render(<App Vault={Vault}/>);
}
export default Vault;
