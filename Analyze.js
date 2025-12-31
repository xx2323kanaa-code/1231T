// ===== Analyze.js =====
let DEBUG_LOG = [];
let HUD = null;

/* ===== Debug ===== */
export function initDebug(hudId){
  HUD = document.getElementById(hudId);
  DEBUG_LOG = [];
  log("debug initialized");
}

function log(msg){
  const t = new Date().toLocaleTimeString();
  const line = `[${t}] ${msg}`;
  DEBUG_LOG.push(line);
  if(HUD) HUD.innerText = line;
}

export function copyDebugLog(){
  navigator.clipboard.writeText(DEBUG_LOG.join("\n"));
  alert("ログをコピーしました");
}

/* ===== Utils ===== */
function innerAngle(a,b,c){
  const ab={x:a.x-b.x,y:a.y-b.y,z:(a.z||0)-(b.z||0)};
  const cb={x:c.x-b.x,y:c.y-b.y,z:(c.z||0)-(b.z||0)};
  const dot=ab.x*cb.x+ab.y*cb.y+ab.z*cb.z;
  const mag=Math.hypot(ab.x,ab.y,ab.z)*Math.hypot(cb.x,cb.y,cb.z);
  if(!isFinite(dot/mag)) return null;
  return Math.acos(dot/mag)*180/Math.PI;
}

async function seekVideo(video,time){
  return new Promise(res=>{
    const h=()=>{video.removeEventListener("seeked",h);res();};
    video.addEventListener("seeked",h);
    video.currentTime=time;
  });
}

async function processVideo(file,onResults){
  const video=document.createElement("video");
  video.src=URL.createObjectURL(file);
  await video.play();
  log(`video loaded (${video.duration.toFixed(2)}s)`);

  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");

  const hands=new Hands({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({maxNumHands:1,modelComplexity:1});

  hands.onResults(onResults);

  const FPS=2;
  for(let t=0;t<video.duration;t+=1/FPS){
    log(`seek ${t.toFixed(2)}s`);
    await seekVideo(video,t);
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0);
    try{
      await hands.send({image:canvas});
    }catch(e){
      log("hands.send failed");
    }
  }
}

/* ===== ① MP / IP ===== */
export async function analyzeMPIP(file,resultId){
  log("analyzeMPIP start");
  const out=document.getElementById(resultId);

  let MP=[],IP=[];
  await processVideo(file,res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];
    const mp=innerAngle(lm[0],lm[2],lm[3]);
    const ip=innerAngle(lm[2],lm[3],lm[4]);
    if(mp!=null) MP.push(mp);
    if(ip!=null) IP.push(ip);
  });

  const flex=x=>180-Math.min(...x);
  const ext=x=>Math.max(0,Math.max(...x)-180);

  out.innerHTML=`
  <b>① MP / IP</b><br>
  MP：屈曲 ${flex(MP).toFixed(1)}° / 伸展 ${ext(MP).toFixed(1)}°<br>
  IP：屈曲 ${flex(IP).toFixed(1)}° / 伸展 ${ext(IP).toFixed(1)}°
  `;
  log("analyzeMPIP finished");
}

/* ===== ②③ CMC 外転（JOA準拠・符号なし） ===== */
export async function analyzeCMC(file,resultId,label){
  log(`${label} start`);
  const out=document.getElementById(resultId);

  let angles=[];
  await processVideo(file,res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];
    const a=innerAngle(lm[0],lm[2],lm[3]); // CMC想定
    if(a!=null) angles.push(a);
  });

  if(angles.length<2){
    out.innerHTML+=`<br><br>${label}：測定不能`;
    log(`${label} failed`);
    return;
  }

  const base=angles[0];
  const abd=Math.max(...angles.map(v=>Math.abs(v-base)));

  out.innerHTML+=`
  <br><br><b>${label}</b><br>
  外転角：${abd.toFixed(1)}°
  `;
  log(`${label} finished`);
}
