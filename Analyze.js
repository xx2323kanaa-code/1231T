// Analyze.js
let LOG = [];
let hudEl = null;

export function initDebug(hudId){
  hudEl = document.getElementById(hudId);
  log("debug init");
}

function log(msg){
  const t = new Date().toLocaleTimeString();
  LOG.push(`[${t}] ${msg}`);
  if(hudEl) hudEl.textContent = LOG[LOG.length-1];
}

export function copyDebugLog(){
  navigator.clipboard.writeText(LOG.join("\n"));
  alert("デバッグログをコピーしました");
}

function angle2D(v1, v2){
  const dot = v1.x*v2.x + v1.y*v2.y;
  const m = Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y);
  if(!m) return null;
  return Math.acos(dot/m)*180/Math.PI;
}

async function processVideo(file, cb){
  const video=document.createElement("video");
  video.src=URL.createObjectURL(file);
  await video.play();

  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");

  const hands=new Hands({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({maxNumHands:1,modelComplexity:1});
  hands.onResults(cb);

  for(let t=0;t<video.duration;t+=0.5){
    log(`seek ${t.toFixed(2)}s`);
    video.currentTime=t;
    await new Promise(r=>video.onseeked=r);
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0);
    await hands.send({image:canvas});
  }
}

/* ① MP / IP */
export async function analyzeMPIP(file, outId){
  log("analyze MP/IP start");
  let MP=[],IP=[];
  await processVideo(file,res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];
    const ang=(a,b,c)=>{
      const ab={x:a.x-b.x,y:a.y-b.y};
      const cb={x:c.x-b.x,y:c.y-b.y};
      return angle2D(ab,cb);
    };
    const mp=ang(lm[0],lm[2],lm[3]);
    const ip=ang(lm[2],lm[3],lm[4]);
    if(mp) MP.push(mp);
    if(ip) IP.push(ip);
  });
  const flex=x=>180-Math.min(...x);
  const ext=x=>Math.max(...x)-180;
  document.getElementById(outId).innerHTML=
  `① MP/IP<br>
   MP：屈曲 ${flex(MP).toFixed(1)}° / 伸展 ${ext(MP).toFixed(1)}°<br>
   IP：屈曲 ${flex(IP).toFixed(1)}° / 伸展 ${ext(IP).toFixed(1)}°`;
  log("analyze MP/IP end");
}

/* ②③ CMC（示指0°基準・JOA準拠） */
export async function analyzeCMC(file, outId, label){
  log(`analyze ${label} start`);
  let vals=[];
  await processVideo(file,res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];

    // 示指MC方向（0°基準）
    const idx={x:lm[5].x-lm[0].x,y:lm[5].y-lm[0].y};
    // 母指MC方向
    const th ={x:lm[2].x-lm[0].x,y:lm[2].y-lm[0].y};

    const ang=angle2D(idx,th);
    if(ang!=null) vals.push(Math.abs(180-ang));
  });

  const v=Math.max(...vals);
  document.getElementById(outId).innerHTML+=
  `<br>${label}：${v.toFixed(1)}°`;
  log(`analyze ${label} end`);
}
