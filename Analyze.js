// Analyze.js  (1231TROM)

let DEBUG_LOG = [];
let hud;

export function initDebug(hudId){
  hud = document.getElementById(hudId);
}

function log(msg){
  const t = new Date().toLocaleTimeString();
  const line = `[${t}] ${msg}`;
  DEBUG_LOG.push(line);
  if(hud) hud.innerText = msg;
}

export function copyDebugLog(){
  navigator.clipboard.writeText(DEBUG_LOG.join("\n"));
  alert("デバッグログをコピーしました");
}

async function seekVideo(video, time){
  return new Promise(resolve=>{
    const h=()=>{video.removeEventListener("seeked",h);resolve();};
    video.addEventListener("seeked",h);
    video.currentTime=time;
  });
}

function innerAngle3D(a,b,c){
  const ab={x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};
  const cb={x:c.x-b.x,y:c.y-b.y,z:c.z-b.z};
  const dot=ab.x*cb.x+ab.y*cb.y+ab.z*cb.z;
  const mag=Math.hypot(ab.x,ab.y,ab.z)*Math.hypot(cb.x,cb.y,cb.z);
  if(!isFinite(dot/mag)) return null;
  return Math.acos(dot/mag)*180/Math.PI;
}

/* ===== ① MP / IP ===== */
export async function analyzeMPIP(file, resultId){
  DEBUG_LOG=[]; log("analyzeMPIP start");

  const video=document.createElement("video");
  video.src=URL.createObjectURL(file);
  await video.play();

  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");

  let MP=[],IP=[];
  const hands=new Hands({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({maxNumHands:1,modelComplexity:1});

  hands.onResults(res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];
    const palm=lm[0];
    const mp=innerAngle3D(palm,lm[2],lm[3]);
    const ip=innerAngle3D(lm[2],lm[3],lm[4]);
    if(mp!=null) MP.push(mp);
    if(ip!=null) IP.push(ip);
  });

  for(let t=0;t<video.duration;t+=0.5){
    log(`seek ${t.toFixed(2)}s`);
    await seekVideo(video,t);
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0);
    await hands.send({image:canvas});
  }

  const flex=x=>180-Math.min(...x);
  const ext=x=>Math.max(...x)-180;

  document.getElementById(resultId).innerHTML=`
  <b>① MP / IP</b><br>
  MP：屈曲 ${flex(MP).toFixed(1)}° / 伸展 ${ext(MP).toFixed(1)}°<br>
  IP：屈曲 ${flex(IP).toFixed(1)}° / 伸展 ${ext(IP).toFixed(1)}°
  `;

  log("analyzeMPIP finished");
}

/* ===== ②③ CMC 外転（共通） ===== */
export async function analyzeCMC(file, resultId, label){
  DEBUG_LOG=[]; log(`analyzeCMC ${label} start`);

  const video=document.createElement("video");
  video.src=URL.createObjectURL(file);
  await video.play();

  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");

  let angles=[];
  const hands=new Hands({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({maxNumHands:1,modelComplexity:1});

  hands.onResults(res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];
    // CMC角：母指中手骨 vs 手掌基準（簡易平面）
    const a=innerAngle3D(lm[0],lm[1],lm[2]);
    if(a!=null) angles.push(a);
  });

  for(let t=0;t<video.duration;t+=0.5){
    await seekVideo(video,t);
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0);
    await hands.send({image:canvas});
  }

  const val = Math.max(...angles)-180;
  document.getElementById(resultId).innerHTML+=`
  <br><b>${label}</b>：${val.toFixed(1)}°
  `;
  log(`analyzeCMC ${label} finished`);
}
