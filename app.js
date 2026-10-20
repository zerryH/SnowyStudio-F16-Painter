/* SnowyStudio F-16A Block 20 MLU — standalone WebGL2 UV surface painter.
   No server, framework, CDN or paid services required. */
'use strict';
(()=>{
const $=id=>document.getElementById(id), W=4096,H=4096, TAU=Math.PI*2;
const view=$('view3d'), wrap=$('viewWrap'), hint=$('status'), mini=$('atlasPreview'), miniCtx=mini.getContext('2d');
const strokeOverlay=$('strokeOverlay'), strokeOverlayCtx=strokeOverlay?strokeOverlay.getContext('2d'):null;
let overlayLast=null;
const toast=$('toast'), gl=view.getContext('webgl2',{antialias:false,alpha:true,preserveDrawingBuffer:false,desynchronized:true,powerPreference:'high-performance'});
if(!gl){hint.textContent='WebGL2 unavailable · enable hardware acceleration in Chrome / Edge'; alert('SnowyStudio needs WebGL2. Enable hardware acceleration in Chrome or Edge.');return;}
const V=(x,y,z)=>[x,y,z], sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>mul(a,1/(len(a)||1)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const baseCanvas=document.createElement('canvas'),camCanvas=document.createElement('canvas'),paintCanvas=document.createElement('canvas'),outCanvas=document.createElement('canvas');
for(const c of [baseCanvas,camCanvas,paintCanvas,outCanvas]){c.width=W;c.height=H;}
const base=baseCanvas.getContext('2d',{willReadFrequently:true}), cam=camCanvas.getContext('2d'),paint=paintCanvas.getContext('2d',{willReadFrequently:true}),out=outCanvas.getContext('2d',{willReadFrequently:true});
const state={tool:'brush',pane:'paint',quality:'fast',lastPaintTool:'brush',style:'round',size:.24,opacity:1,hardness:1,sprayDensity:68,spraySpread:1.45,peakHeight:1.1,peakSpacing:1.5,color:'#101820',decalSize:1.4,decalRotate:0,camo:'none',camoStrength:.78,showPaint:true,showCamo:true,stamp:'alpine',image:null,mouse:[-100,-100],brushActive:false,strokeTravel:0,orbitActive:false,panActive:false,undo:[],redo:[],loaded:false,dirtyTex:true,needsRender:true,needMini:true,move:null,pressed:false,lastStamp:null,lastDecal:null,baseLoaded:false,previewHit:null,previewInside:false};
const orbit={yaw:.87,pitch:.37,dist:21,target:[.65,.15,0],pos:[0,0,0],right:[0,0,0],up:[0,1,0],forward:[0,0,-1]};
let program,tex,decalTex,locations,meshes=[],skin=null,lastTexUpload=0,lastMini=0,toastTimer=0,raf=0,lastPointerRay=null,baseAlpha=null,modelTri=0;
const TILE=256,GRID=W/TILE,dirtyTiles=new Set();
const patchCanvas=document.createElement('canvas');patchCanvas.width=patchCanvas.height=TILE;
const patchCtx=patchCanvas.getContext('2d');
const renderProfiles={
 fast:{textureSize:1024,maxPixels:850000,maxDpr:.9,paintFps:30,orbitFps:38,idleFps:35,label:'Fast'},
 balanced:{textureSize:2048,maxPixels:1650000,maxDpr:1.1,paintFps:30,orbitFps:45,idleFps:50,label:'Balanced'},
 detail:{textureSize:4096,maxPixels:2700000,maxDpr:1.5,paintFps:40,orbitFps:60,idleFps:60,label:'Detail'}
};
const customQuality={fps:60,unlimited:false,textureSize:2048,maxSide:1800};
const previewCanvas=document.createElement('canvas');
const previewCtx=previewCanvas.getContext('2d');
let previewSize=1024,frameTimer=0,lastDrawTime=-1000,lastStatusTime=0;
let textureFull=true,activeEdit=null,pendingStrokePoint=null;
function qualityProfile(){
 if(state.quality!=='custom')return renderProfiles[state.quality]||renderProfiles.fast;
 const fps=customQuality.unlimited?Infinity:customQuality.fps;
 return {textureSize:customQuality.textureSize,maxPixels:customQuality.maxSide**2,
  maxSide:customQuality.maxSide,maxDpr:3,paintFps:fps,orbitFps:fps,idleFps:fps,label:'Custom'};
}
function clampQualityNumber(value,min,max,fallback){
 const n=Number(value);
 return Number.isFinite(n)&&n>=min?Math.round(clamp(n,min,max)):fallback;
}
function syncCustomQualityInputs(){
 const fps=$('customFps'),unlimited=$('customUnlimited'),texture=$('customTextureSize'),maxSide=$('customViewportSize');
 if(!fps||!unlimited||!texture||!maxSide)return;
 fps.value=customQuality.fps;
 fps.disabled=customQuality.unlimited;
 unlimited.checked=customQuality.unlimited;
 texture.value=customQuality.textureSize;
 maxSide.value=customQuality.maxSide;
}
function readCustomQualityInputs(){
 const fps=$('customFps'),unlimited=$('customUnlimited'),texture=$('customTextureSize'),maxSide=$('customViewportSize');
 customQuality.fps=clampQualityNumber(fps.value,1,1000,customQuality.fps);
 customQuality.unlimited=unlimited.checked;
 customQuality.textureSize=clampQualityNumber(texture.value,256,3000,customQuality.textureSize);
 customQuality.maxSide=clampQualityNumber(maxSide.value,320,3000,customQuality.maxSide);
 syncCustomQualityInputs();
}
function saveQualityPreferences(){
 try{localStorage.setItem('snowystudio-quality-v1',JSON.stringify({mode:state.quality,custom:customQuality}));}catch(e){}
}
function loadQualityPreferences(){
 try{
  const raw=localStorage.getItem('snowystudio-quality-v1');
  if(!raw)return;
  const data=JSON.parse(raw),c=data?.custom;
  if(c&&typeof c==='object'){
   customQuality.fps=clampQualityNumber(c.fps,1,1000,60);
   customQuality.textureSize=clampQualityNumber(c.textureSize,256,3000,2048);
   customQuality.maxSide=clampQualityNumber(c.maxSide,320,3000,1800);
   customQuality.unlimited=c.unlimited===true;
  }
  if(['fast','balanced','detail','custom'].includes(data.mode))state.quality=data.mode;
 }catch(e){}
}
function setPreviewQuality(next){
 if(next!=='custom'&&!renderProfiles[next])return;
 state.quality=next;
 const profile=qualityProfile();
 const changed=previewSize!==profile.textureSize||previewCanvas.width!==profile.textureSize;
 previewSize=profile.textureSize;
 if(changed){
  previewCanvas.width=previewCanvas.height=previewSize;
  // Non-power-of-two values such as 3000px use per-tile integer boundaries.
  // The patch canvas is resized for each destination tile in refreshTexture.
  textureFull=true;dirtyTiles.clear();state.dirtyTex=true;
 }
 state.needsRender=true;
 const btn=$('previewQualityBtn');
 if(btn){
  btn.textContent='⚡ '+profile.label+' ▾';
  btn.title='Choose 3D preview quality and custom FPS settings; skin export stays 4K.';
 }
 for(const option of document.querySelectorAll('[data-quality-option]')){
  const active=option.dataset.qualityOption===next;
  option.classList.toggle('active',active);
  option.setAttribute('aria-pressed',String(active));
 }
 const info=$('perfModeText');
 if(info)info.textContent=profile.label+' · '+previewSize+'px texture · '+
 (state.quality==='custom'?(customQuality.unlimited?'Unlimited':customQuality.fps+' FPS')+' · ':'')+'4K export';
 saveQualityPreferences();
 requestView();
}


function message(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3300);}
function status(msg){hint.textContent=msg;}
const hexRGB=hex=>{let x=parseInt(hex.replace('#',''),16);return[(x>>16)&255,(x>>8)&255,x&255]};
function shader(type,code){let sh=gl.createShader(type);gl.shaderSource(sh,code);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
function initGL(){
 const vs=`#version 300 es
 in vec3 aPos;in vec3 aNorm;in vec2 aUV;
 uniform mat4 uVP;out vec3 vNorm;out vec3 vPos;out vec2 vUV;
 void main(){vNorm=aNorm;vPos=aPos;vUV=aUV;gl_Position=uVP*vec4(aPos,1.0);}`;
 const fs=`#version 300 es
 precision highp float;in vec3 vNorm;in vec3 vPos;in vec2 vUV;
 uniform sampler2D uTex;uniform sampler2D uDecal;uniform vec3 uTint;uniform float uUseTex;uniform float uAlpha;
 uniform float uPreviewOn;uniform vec3 uDecalCenter,uDecalNormal,uDecalRight,uDecalUp;
 uniform float uDecalWidth,uDecalAspect,uDecalAngle,uDecalOpacity;
 out vec4 frag;
 void main(){vec3 n=normalize(vNorm);float key=max(dot(n,normalize(vec3(0.35,0.8,0.7))),0.0);
 float sky=max(n.y,0.0)*0.11;float lit=0.66+0.27*key+sky;
 vec3 c=mix(uTint,texture(uTex,vUV).rgb,uUseTex);
 if(uPreviewOn>0.5){
   vec3 d=vPos-uDecalCenter;
   float maxRadius=uDecalWidth*0.85+0.03;
   float maxPlane=max(0.05,uDecalWidth*0.85*0.21);
   // Match the actual decal stamping rules (camera-facing projection onto nearby skin triangles).
   if(length(d)<maxRadius && abs(dot(d,uDecalNormal))<maxPlane && abs(dot(normalize(vNorm),uDecalNormal))>0.085){
     float x=dot(d,uDecalRight),y=-dot(d,uDecalUp);
     float cR=cos(uDecalAngle),sR=sin(uDecalAngle);
     float px=cR*x+sR*y,py=-sR*x+cR*y;
     float du=px/uDecalWidth+0.5,dv=py/(uDecalWidth*uDecalAspect)+0.5;
     if(du>=0.0 && du<=1.0 && dv>=0.0 && dv<=1.0){
       vec4 ink=texture(uDecal,vec2(du,1.0-dv));
       c=mix(c,ink.rgb,ink.a*uDecalOpacity);
       // Subtle placement boundary; only appears while hovering, never exported.
       float e=min(min(du,1.0-du),min(dv,1.0-dv));
       if(e<0.012){c=mix(c,vec3(0.28,0.91,0.97),0.50);}
     }
   }
 }
 c=(c*lit)*1.06+vec3(0.035,0.055,0.070);
 float spec=pow(max(dot(reflect(normalize(vec3(-0.35,-0.8,-0.7)),n),normalize(vec3(0.4,0.7,0.3))),0.0),18.0)*0.08;
 frag=vec4(clamp(c+spec,0.0,1.0),uAlpha);}`;
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 locations={pos:gl.getAttribLocation(program,'aPos'),norm:gl.getAttribLocation(program,'aNorm'),uv:gl.getAttribLocation(program,'aUV'),vp:gl.getUniformLocation(program,'uVP'),tex:gl.getUniformLocation(program,'uTex'),tint:gl.getUniformLocation(program,'uTint'),useTex:gl.getUniformLocation(program,'uUseTex'),alpha:gl.getUniformLocation(program,'uAlpha'),decalSampler:gl.getUniformLocation(program,'uDecal'),previewOn:gl.getUniformLocation(program,'uPreviewOn'),decalCenter:gl.getUniformLocation(program,'uDecalCenter'),decalNormal:gl.getUniformLocation(program,'uDecalNormal'),decalRight:gl.getUniformLocation(program,'uDecalRight'),decalUp:gl.getUniformLocation(program,'uDecalUp'),decalWidth:gl.getUniformLocation(program,'uDecalWidth'),decalAspect:gl.getUniformLocation(program,'uDecalAspect'),decalAngle:gl.getUniformLocation(program,'uDecalAngle'),decalOpacity:gl.getUniformLocation(program,'uDecalOpacity')};
 gl.useProgram(program);gl.uniform1i(locations.tex,0);gl.uniform1i(locations.decalSampler,1);
 tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([190,207,211,255]));
 gl.activeTexture(gl.TEXTURE1);decalTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,decalTex);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));gl.activeTexture(gl.TEXTURE0);
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
}
function decode64(txt,Type){const s=atob(txt),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return new Type(b.buffer);}
function initMesh(){
 for(const p of window.F16_MODEL.parts){const v=decode64(p.vertices,Float32Array),idx=decode64(p.indices,Uint32Array);const mesh={kind:p.kind,v,idx,triCount:p.triCount};
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);
 const e=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
 gl.enableVertexAttribArray(locations.pos);gl.vertexAttribPointer(locations.pos,3,gl.FLOAT,false,32,0);
 gl.enableVertexAttribArray(locations.uv);gl.vertexAttribPointer(locations.uv,2,gl.FLOAT,false,32,12);
 gl.enableVertexAttribArray(locations.norm);gl.vertexAttribPointer(locations.norm,3,gl.FLOAT,false,32,20);
 mesh.vao=vao; if(p.kind==='skin'){mesh.bvh=decode64(p.bvh,Float32Array);mesh.order=decode64(p.order,Uint32Array);skin=mesh;modelTri=p.triCount;}meshes.push(mesh);
 }
 window.F16_MODEL=null; // free packed source after decoding
 gl.bindVertexArray(null);status('MODEL READY · 4096² UV');
}
function cameraBasis(){const {yaw,pitch,dist,target}=orbit;orbit.pos=[target[0]+dist*Math.cos(pitch)*Math.sin(yaw),target[1]+dist*Math.sin(pitch),target[2]+dist*Math.cos(pitch)*Math.cos(yaw)];orbit.forward=unit(sub(target,orbit.pos));orbit.right=unit(cross(orbit.forward,[0,1,0]));orbit.up=unit(cross(orbit.right,orbit.forward));}
function vpMatrix(aspect){cameraBasis();const r=orbit.right,u=orbit.up,f=orbit.forward,p=orbit.pos;
 const view=new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,p),-dot(u,p),dot(f,p),1]);
 const far=250,near=.1,q=1/Math.tan(Math.PI/6),proj=new Float32Array([q/aspect,0,0,0,0,q,0,0,0,0,(far+near)/(near-far),-1,0,0,(2*far*near)/(near-far),0]);
 const result=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++){result[c*4+row]=0;for(let k=0;k<4;k++)result[c*4+row]+=proj[k*4+row]*view[c*4+k];}return result;
}
function scheduleFrame(){
 if(raf||frameTimer||document.hidden)return;
 const profile=qualityProfile();
 const fps=state.brushActive?profile.paintFps:state.orbitActive?profile.orbitFps:state.tool==='decal'?profile.paintFps:profile.idleFps;
 const wait=Number.isFinite(fps)?Math.max(0,1000/fps-(performance.now()-lastDrawTime)):0;
 if(wait>3){
  frameTimer=setTimeout(()=>{frameTimer=0;if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);},wait);
 }else raf=requestAnimationFrame(frame);
}
function requestView(){state.needsRender=true;scheduleFrame();}

function compose(){
 out.clearRect(0,0,W,H);
 out.drawImage(baseCanvas,0,0);
 if(state.showCamo)out.drawImage(camCanvas,0,0);
 if(state.showPaint)out.drawImage(paintCanvas,0,0);
}
// Called for full-layer changes (camo, base texture, show/hide layer, project).
function paintDirty(){
 textureFull=true;dirtyTiles.clear();state.dirtyTex=true;state.needMini=true;requestView();
}
function markTile(id){
 if(id<0||id>=GRID*GRID)return;
 // First touch in an edit captures the actual old pixel state *before* painting.
 if(activeEdit&&activeEdit.kind==='paint'&&!activeEdit.tiles.has(id)){
  const x=(id%GRID)*TILE,y=Math.floor(id/GRID)*TILE;
  activeEdit.tiles.set(id,paint.getImageData(x,y,TILE,TILE));
 }
 dirtyTiles.add(id);
 state.dirtyTex=true;state.needMini=true;requestView();
}
function markUV(m,worldRadius){
 const ux=m.uv.map(v=>v[0]),uy=m.uv.map(v=>v[1]);
 const cx=m.mat[4],cy=m.mat[5],margin=4;
 const rx=worldRadius*(Math.abs(m.mat[0])+Math.abs(m.mat[2]))+margin;
 const ry=worldRadius*(Math.abs(m.mat[1])+Math.abs(m.mat[3]))+margin;
 const left=Math.max(0,Math.max(Math.min(...ux),cx-rx));
 const top=Math.max(0,Math.max(Math.min(...uy),cy-ry));
 const right=Math.min(W,Math.min(Math.max(...ux),cx+rx));
 const bottom=Math.min(H,Math.min(Math.max(...uy),cy+ry));
 if(right<=left||bottom<=top)return;
 const x0=Math.floor(left/TILE),x1=Math.min(GRID-1,Math.floor((right-0.001)/TILE));
 const y0=Math.floor(top/TILE),y1=Math.min(GRID-1,Math.floor((bottom-0.001)/TILE));
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)markTile(y*GRID+x);
}
function refreshTexture(){
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 if(textureFull){
  compose();
  previewCtx.clearRect(0,0,previewSize,previewSize);
  previewCtx.drawImage(outCanvas,0,0,previewSize,previewSize);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,previewCanvas);
  textureFull=false;dirtyTiles.clear();state.dirtyTex=false;
 }else{
  // Only upload regions actually touched by the brush, instead of 16M pixels.
  let batch=0;
  for(const id of dirtyTiles){
   dirtyTiles.delete(id);
   const x=(id%GRID)*TILE,y=Math.floor(id/GRID)*TILE;
   out.clearRect(x,y,TILE,TILE);
   out.drawImage(baseCanvas,x,y,TILE,TILE,x,y,TILE,TILE);
   if(state.showCamo)out.drawImage(camCanvas,x,y,TILE,TILE,x,y,TILE,TILE);
   if(state.showPaint)out.drawImage(paintCanvas,x,y,TILE,TILE,x,y,TILE,TILE);
   const scale=previewSize/W;
   const left=Math.round(x*scale),right=Math.round((x+TILE)*scale);
   const bottom=Math.round((H-y-TILE)*scale),top=Math.round((H-y)*scale);
   const pw=right-left,ph=top-bottom;
   if(pw<1||ph<1)continue;
   if(patchCanvas.width!==pw)patchCanvas.width=pw;
   if(patchCanvas.height!==ph)patchCanvas.height=ph;
   patchCtx.clearRect(0,0,pw,ph);
   patchCtx.drawImage(outCanvas,x,y,TILE,TILE,0,0,pw,ph);
   // Integer-aligned boundaries correctly cover 3000px and other custom sizes.
   gl.texSubImage2D(gl.TEXTURE_2D,0,left,bottom,gl.RGBA,gl.UNSIGNED_BYTE,patchCanvas);
   if(++batch>=4)break;
  }
  state.dirtyTex=dirtyTiles.size>0;
 }
 lastTexUpload=performance.now();state.needsRender=true;state.needMini=true;
}
function setDecalImage(img,label){
 state.image=img;
 const preview=$('selectedDecalArt');
 preview.src=img instanceof HTMLCanvasElement?img.toDataURL('image/png'):img.src;
 $('selectedDecalName').textContent=label;
 $('decalHint').textContent='Move over the plane to preview. Change size / rotation, then left-click to place. Right-drag rotates the plane.';
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,decalTex);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
 gl.activeTexture(gl.TEXTURE0);
 requestView();
}
function decalPreviewUniforms(){
 // The projected decal lives only in the WebGL frame, NOT on the export texture until clicked.
 // Recast after camera/zoom changes so the preview never sticks to an old world position.
 if(state.tool!=='decal'||!state.image||!state.baseLoaded||!state.previewInside||state.orbitActive||state.pressed){
   state.previewHit=null;gl.uniform1f(locations.previewOn,0);return;
 }
 const hit=cast(...state.mouse);
 state.previewHit=hit;
 if(!hit){gl.uniform1f(locations.previewOn,0);return;}
 cameraBasis();
 const img=state.image,iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
 gl.uniform1f(locations.previewOn,1);
 gl.uniform3fv(locations.decalCenter,hit.point);
 gl.uniform3fv(locations.decalNormal,hit.normal);
 gl.uniform3fv(locations.decalRight,orbit.right);
 gl.uniform3fv(locations.decalUp,orbit.up);
 gl.uniform1f(locations.decalWidth,state.decalSize);
 gl.uniform1f(locations.decalAspect,ih/iw);
 gl.uniform1f(locations.decalAngle,state.decalRotate*Math.PI/180);
 gl.uniform1f(locations.decalOpacity,Math.min(0.86,Math.max(0.12,state.opacity*0.78)));
}
function frame(time){raf=0;lastDrawTime=time;
 if(state.brushActive&&pendingStrokePoint)flushStrokePoint();
 const w=wrap.clientWidth,h=wrap.clientHeight;
 if(w<1||h<1)return;
 const profile=qualityProfile();
 const dpr=Math.min(window.devicePixelRatio||1,profile.maxDpr,Math.sqrt(profile.maxPixels/(w*h)),(profile.maxSide||Infinity)/Math.max(w,h));

 const dw=Math.max(1,Math.round(w*dpr)),dh=Math.max(1,Math.round(h*dpr));if(view.width!==dw||view.height!==dh){view.width=dw;view.height=dh;gl.viewport(0,0,dw,dh);state.needsRender=true;}
 if(state.dirtyTex&&state.baseLoaded&&(!state.pressed||time-lastTexUpload>42)){refreshTexture();state.needsRender=true;}
 if(state.needMini&&state.baseLoaded&&!state.pressed&&$('uvDrawer').classList.contains('is-open')&&time-lastMini>400){miniCtx.clearRect(0,0,440,440);miniCtx.drawImage(outCanvas,0,0,440,440);state.needMini=false;lastMini=time;}
 if(state.needsRender){
  gl.viewport(0,0,dw,dh);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);gl.uniformMatrix4fv(locations.vp,false,vpMatrix(w/h));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,decalTex);decalPreviewUniforms();gl.activeTexture(gl.TEXTURE0);
  for(const m of meshes){if(m.kind==='glass')continue;gl.bindVertexArray(m.vao);gl.uniform1f(locations.useTex,m.kind==='skin'?1:0);gl.uniform1f(locations.alpha,1);gl.uniform1f(locations.previewOn,m.kind==='skin'&&state.tool==='decal'&&state.previewHit&&state.previewInside&&!state.orbitActive&&!state.pressed?1:0);let c=m.kind==='cockpit'?[.14,.19,.24]:[.4,.48,.53];gl.uniform3fv(locations.tint,c);gl.drawElements(gl.TRIANGLES,m.idx.length,gl.UNSIGNED_INT,0);}
  gl.uniform1f(locations.previewOn,0);gl.depthMask(false);for(const m of meshes){if(m.kind!=='glass')continue;gl.bindVertexArray(m.vao);gl.uniform1f(locations.useTex,0);gl.uniform1f(locations.alpha,.35);gl.uniform3fv(locations.tint,[.16,.33,.39]);gl.drawElements(gl.TRIANGLES,m.idx.length,gl.UNSIGNED_INT,0);}gl.depthMask(true);gl.bindVertexArray(null);state.needsRender=false;if(!state.dirtyTex)clearGhostStroke();
 }
 if(state.dirtyTex)requestView();
}
function getRay(x,y){cameraBasis();const w=wrap.clientWidth,h=wrap.clientHeight,ax=(2*x/w-1)*w/h*Math.tan(Math.PI/6),ay=(1-2*y/h)*Math.tan(Math.PI/6);return {pos:orbit.pos,dir:unit(add(orbit.forward,add(mul(orbit.right,ax),mul(orbit.up,ay))))};}
function nodeRayBox(minx,miny,minz,maxx,maxy,maxz,r,best){let tlo=0,thi=best;
 for(let i=0;i<3;i++){let lo=[minx,miny,minz][i],hi=[maxx,maxy,maxz][i],inv=1/(Math.abs(r.dir[i])>1e-10?r.dir[i]:1e-10),t1=(lo-r.pos[i])*inv,t2=(hi-r.pos[i])*inv;if(t1>t2)[t1,t2]=[t2,t1];tlo=Math.max(tlo,t1);thi=Math.min(thi,t2);if(tlo>thi)return false;}return true;}
function triCoords(tri){const id=tri*3,i0=skin.idx[id]*8,i1=skin.idx[id+1]*8,i2=skin.idx[id+2]*8,v=skin.v;return [[v[i0],v[i0+1],v[i0+2]],[v[i1],v[i1+1],v[i1+2]],[v[i2],v[i2+1],v[i2+2]]];}
function triUV(tri){const id=tri*3,v=skin.v,i0=skin.idx[id]*8,i1=skin.idx[id+1]*8,i2=skin.idx[id+2]*8;return [[v[i0+3]*W,(1-v[i0+4])*H],[v[i1+3]*W,(1-v[i1+4])*H],[v[i2+3]*W,(1-v[i2+4])*H]];}
function cast(x,y){if(!skin)return null;const ray=getRay(x,y),nodes=skin.bvh,order=skin.order,stack=[0];let best=1e6,result=null;
 while(stack.length){let k=stack.pop(),o=k*10;
 if(!nodeRayBox(nodes[o],nodes[o+1],nodes[o+2],nodes[o+3],nodes[o+4],nodes[o+5],ray,best))continue;
 let left=nodes[o+6]|0,right=nodes[o+7]|0;if(left>=0){stack.push(left,right);continue;}
 const start=nodes[o+8]|0,num=nodes[o+9]|0;
 for(let q=start;q<start+num;q++){
  const tri=order[q],idx=tri*3,v=skin.v,i0=skin.idx[idx]*8,i1=skin.idx[idx+1]*8,i2=skin.idx[idx+2]*8;
  const p0=[v[i0],v[i0+1],v[i0+2]],p1=[v[i1],v[i1+1],v[i1+2]],p2=[v[i2],v[i2+1],v[i2+2]];
  const e1=sub(p1,p0),e2=sub(p2,p0),h=cross(ray.dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;
  const inv=1/det,s=sub(ray.pos,p0),u=dot(s,h)*inv;if(u<0||u>1)continue;
  const z=cross(s,e1),vv=dot(ray.dir,z)*inv;if(vv<0||u+vv>1)continue;
  const t=dot(e2,z)*inv;if(t>.01&&t<best){best=t;result={point:add(ray.pos,mul(ray.dir,t)),tri,uv:[v[i0+3]*(1-u-vv)+v[i1+3]*u+v[i2+3]*vv,v[i0+4]*(1-u-vv)+v[i1+4]*u+v[i2+4]*vv],normal:unit(cross(e1,e2)),dir:ray.dir};}
 }
 }return result;}
function sphereQuery(center,r){const nodes=skin.bvh,order=skin.order,stack=[0],ids=[];
 while(stack.length){let k=stack.pop(),o=k*10,d2=0;for(let a=0;a<3;a++){let lo=nodes[o+a],hi=nodes[o+a+3],v=center[a],d=v<lo?lo-v:v>hi?v-hi:0;d2+=d*d;}if(d2>r*r)continue;
 const l=nodes[o+6]|0;if(l>=0){stack.push(l,nodes[o+7]|0);continue;}
 const start=nodes[o+8]|0,count=nodes[o+9]|0;for(let i=start;i<start+count;i++)ids.push(order[i]);
 }return ids;}
function projectTriangle(tri,hit,size,mode){const p=triCoords(tri),uv=triUV(tri),e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),n=unit(cross(e1,e2)),plane=dot(sub(hit.point,p[0]),n);
 if(Math.abs(plane)>Math.max(.05,size*(mode==='decal'?.21:.32)))return null;
 // Avoid painting back-facing / very oblique surfaces, but tolerate alternate winding.
 const facing=Math.abs(dot(n,hit.dir));if(facing<.085)return null;
 const axisX=unit(e1),axisY=unit(cross(n,axisX)),x1=len(e1),x2=dot(e2,axisX),y2=dot(e2,axisY);
 if(x1<.00001||Math.abs(y2)<.00001)return null;
 const mx=[(uv[1][0]-uv[0][0])/x1,(uv[1][1]-uv[0][1])/x1];
 const my=[(uv[2][0]-uv[0][0]-mx[0]*x2)/y2,(uv[2][1]-uv[0][1]-mx[1]*x2)/y2];
 const d=sub(hit.point,p[0]),cx=uv[0][0]+mx[0]*dot(d,axisX)+my[0]*dot(d,axisY),cy=uv[0][1]+mx[1]*dot(d,axisX)+my[1]*dot(d,axisY);
 if(!Number.isFinite(cx)||Math.max(Math.abs(mx[0]),Math.abs(my[0]))>3e5)return null;
 if(mode==='decal'||mode==='peak'){
  const coords=p.map(pt=>[dot(sub(pt,hit.point),orbit.right),-dot(sub(pt,hit.point),orbit.up)]);
  const dx1=coords[1][0]-coords[0][0],dy1=coords[1][1]-coords[0][1],dx2=coords[2][0]-coords[0][0],dy2=coords[2][1]-coords[0][1],det=dx1*dy2-dy1*dx2;
  if(Math.abs(det)<.000005)return null;
  const ax=( (uv[1][0]-uv[0][0])*dy2-(uv[2][0]-uv[0][0])*dy1)/det;
  const bx=( (uv[2][0]-uv[0][0])*dx1-(uv[1][0]-uv[0][0])*dx2)/det;
  const ay=( (uv[1][1]-uv[0][1])*dy2-(uv[2][1]-uv[0][1])*dy1)/det;
  const by=( (uv[2][1]-uv[0][1])*dx1-(uv[1][1]-uv[0][1])*dx2)/det;
  const ox=uv[0][0]-ax*coords[0][0]-bx*coords[0][1],oy=uv[0][1]-ay*coords[0][0]-by*coords[0][1];
  if(Math.max(Math.abs(ax),Math.abs(bx),Math.abs(ay),Math.abs(by))>1e5)return null;
  return {uv,mat:[ax,ay,bx,by,ox,oy]};
 }
 return {uv,mat:[mx[0],mx[1],my[0],my[1],cx,cy]};
}
function clipUV(ctx,uv){ctx.beginPath();ctx.moveTo(uv[0][0],uv[0][1]);ctx.lineTo(uv[1][0],uv[1][1]);ctx.lineTo(uv[2][0],uv[2][1]);ctx.closePath();ctx.clip();}

// The CPU paint loop intentionally does NOT walk nearby 3D triangles for brush strokes.
// One raycast already returns a UV coordinate; drawing into that location is much cheaper.
const sprayStamp=document.createElement('canvas');sprayStamp.width=sprayStamp.height=256;
const sprayStampCtx=sprayStamp.getContext('2d');
let sprayStampKey='',paintDabSerial=0;
function uvDabGeometry(hit,radius){
 const uv=triUV(hit.tri),world=triCoords(hit.tri);
 const w1=sub(world[1],world[0]),w2=sub(world[2],world[0]);
 const realArea=len(cross(w1,w2));
 const ux=uv[1][0]-uv[0][0],uy=uv[1][1]-uv[0][1];
 const vx=uv[2][0]-uv[0][0],vy=uv[2][1]-uv[0][1];
 const uvArea=Math.abs(ux*vy-uy*vx);
 const density=realArea>1e-8?Math.sqrt(uvArea/realArea):180;
 return {x:hit.uv[0]*W,y:(1-hit.uv[1])*H,
  radius:clamp(radius*clamp(density,35,1800),1.3,600)};
}
function markPaintRect(x,y,r){
 const left=Math.max(0,Math.floor((x-r-3)/TILE));
 const right=Math.min(GRID-1,Math.floor((x+r+3)/TILE));
 const top=Math.max(0,Math.floor((y-r-3)/TILE));
 const bottom=Math.min(GRID-1,Math.floor((y+r+3)/TILE));
 if(right<left||bottom<top)return;
 for(let ty=top;ty<=bottom;ty++)for(let tx=left;tx<=right;tx++)markTile(ty*GRID+tx);
}
function rebuildSprayStamp(kind){
 const key=[kind,state.color,state.sprayDensity,state.spraySpread].join('/');
 if(sprayStampKey===key)return;
 sprayStampKey=key;
 const ctx=sprayStampCtx;ctx.clearRect(0,0,256,256);
 const rng=pseudo(29173);
 const chalk=kind==='chalk',total=chalk?150:Math.round(state.sprayDensity*3.2);
 const rgba=hexRGB(state.color);
 ctx.fillStyle='rgb('+rgba.join(',')+')';
 for(let i=0;i<total;i++){
  const a=rng()*TAU,r=Math.sqrt(rng())*119;
  const x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;
  ctx.globalAlpha=(chalk?.29:.13)+(.40*(1-r/119))*rng();
  const dot=chalk?.6+rng()*1.9:1.2+rng()*2.8;
  ctx.beginPath();ctx.arc(x,y,dot,0,TAU);ctx.fill();
 }
 ctx.globalAlpha=1;
}
function dab(hit,radius,params={}){
 if(!hit)return 0;
 const p=uvDabGeometry(hit,radius),t=state.tool;
 const spray=t==='spray',peak=t==='mountain',erase=t==='erase';
 const r=p.radius*(spray?state.spraySpread:1);
 // A single rect capture, a single 2D stamp. Never a sphere query or per-triangle clip.
 markPaintRect(p.x,p.y,peak?r*Math.max(1.4,state.peakHeight)*1.2:r*1.06);
 paint.save();paint.globalAlpha=state.opacity;
 paint.globalCompositeOperation=erase?'destination-out':'source-over';
 if(peak){
  paint.translate(p.x,p.y);
  const h=state.peakHeight;
  paint.strokeStyle=state.color;paint.lineWidth=Math.max(1,r*.072);
  paint.lineCap='round';paint.lineJoin='round';
  paint.beginPath();
  paint.moveTo(-r,r*.35);paint.lineTo(-r*.79,-r*.12*h);
  paint.lineTo(-r*.60,r*.10);paint.lineTo(-r*.28,-r*.96*h);
  paint.lineTo(r*.03,r*.08);paint.lineTo(r*.24,-r*.47*h);
  paint.lineTo(r*.41,-r*.06);paint.lineTo(r*.65,-r*.67*h);
  paint.lineTo(r*.86,r*.06);paint.lineTo(r,r*.32);paint.stroke();
  paint.lineWidth=Math.max(.5,r*.027);paint.beginPath();
  paint.moveTo(-r*.43,-r*.49*h);paint.lineTo(-r*.28,-r*.34*h);paint.lineTo(-r*.12,-r*.51*h);
  paint.moveTo(r*.56,-r*.38*h);paint.lineTo(r*.66,-r*.29*h);paint.lineTo(r*.73,-r*.38*h);paint.stroke();
 }else if(spray||(state.style==='chalk'&&!erase)){
  rebuildSprayStamp(spray?'spray':'chalk');
  // One pre-rendered particle sprite instead of drawing thousands of circles.
  paint.translate(p.x,p.y);
  paint.rotate((++paintDabSerial%7)*.8976);
  paint.drawImage(sprayStamp,-r,-r,r*2,r*2);
 }else{
  paint.fillStyle=state.color;
  if(!erase&&(state.style==='soft'||state.hardness<.98)){
   const rgb=hexRGB(state.color);
   const grad=paint.createRadialGradient(p.x,p.y,r*state.hardness*.75,p.x,p.y,r);
   grad.addColorStop(0,state.color);
   grad.addColorStop(1,'rgba('+rgb.join(',')+',0)');
   paint.fillStyle=grad;
  }
  paint.beginPath();paint.arc(p.x,p.y,r,0,TAU);paint.fill();
 }
 paint.restore();
 return 1;
}
function stampDecal(hit){if(!hit||!state.image)return;const size=state.decalSize,halfDiag=size*.85;let count=0;
 for(const tri of sphereQuery(hit.point,halfDiag+.03)){const m=projectTriangle(tri,hit,halfDiag,'decal');if(!m)continue;markUV(m,size*Math.max(1,(state.image.naturalHeight||state.image.height)/(state.image.naturalWidth||state.image.width))*1.3);paint.save();clipUV(paint,m.uv);paint.setTransform(...m.mat);paint.globalAlpha=state.opacity;
 paint.rotate(state.decalRotate*Math.PI/180);let ih=state.image.naturalHeight||state.image.height,iw=state.image.naturalWidth||state.image.width,ratio=ih/iw;
 paint.drawImage(state.image,-size/2,-size*ratio/2,size,size*ratio);paint.restore();count++;
 }if(!count)message('Decal missed the paintable surface; try a flatter view.');}
const palette=['#101820','#000000','#273c4e','#6c8494','#ffffff','#d5f5fa','#a1dee7','#6a9ac1','#194f69','#d8ded6','#c6b3a1','#9b7160','#ec6d51','#f4ca63','#9b9dd4','#8bcbb3'];
function setupSwatches(){const el=$('swatches');for(let c of palette){let b=document.createElement('button');b.className='swatch';b.style.background=c;b.title=c;b.addEventListener('click',()=>{state.color=c;$('colorPick').value=c;updateColors();drawToolPreview();});el.append(b);}updateColors();}
function updateColors(){$('colorCode').textContent=state.color.toUpperCase();for(const e of document.querySelectorAll('.swatch'))e.classList.toggle('active',e.title.toLowerCase()===state.color.toLowerCase());}
const styleTitles={brush:['Solid brush','Draw smooth, continuous lines.'],spray:['Spray paint','Scattered dots for fades and weathering.'],mountain:['Alpine peaks','Place spaced mountain ranges with snowcaps.'],decal:['Decal preview','Hover to inspect the decal before clicking to apply.'],erase:['Eraser','Remove artwork without erasing original detail.'],orbit:['Camera navigation','Drag to rotate the aircraft. No paint applied.']};
// The selected sidebar page and the active painting tool are one coordinated UI state.
const paintTools=new Set(['brush','spray','mountain','erase']);
const validPanes=new Set(['paint','decals','camo','layers']);
function setPane(name){
 if(!validPanes.has(name))return;
 state.pane=name;
 for(const e of document.querySelectorAll('.panel.left > .section[data-pane]')){
  const active=e.dataset.pane===name;
  e.classList.toggle('pane-active',active);
  e.hidden=!active;
  e.setAttribute('aria-hidden',String(!active));
 }
 for(const e of document.querySelectorAll('.sidebar-tab')){
  const active=e.dataset.paneTarget===name;
  e.classList.toggle('active',active);
  e.setAttribute('aria-selected',String(active));
  e.tabIndex=active?0:-1;
 }
 const headline=name==='camo'?['Camouflage','Apply a preset without accidentally painting.']:
  name==='layers'?['Layers','Show or hide the artwork and camouflage layers.']:
  styleTitles[state.tool]||styleTitles.brush;
 $('toolHeading').textContent=headline[0];
 $('toolSubtitle').textContent=headline[1];
}

function drawToolPreview(){
 const c=$('toolPreview');if(!c)return;
 const g=c.getContext('2d'),w=c.width,h=c.height,ink=state.color;
 const rgb=hexRGB(ink),brightness=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 g.clearRect(0,0,w,h);g.fillStyle=brightness<155?'#dceef4':'#152738';g.fillRect(0,0,w,h);
 g.strokeStyle=ink;g.fillStyle=ink;g.lineCap='round';g.lineJoin='round';
 if(state.tool==='spray'){
  const rand=pseudo(44213);
  for(let i=0;i<Math.round(state.sprayDensity*3);i++){
   const x=20+rand()*(w-40),y=h/2+(rand()-.5)*26*state.spraySpread;
   g.globalAlpha=.20+rand()*.75;
   g.beginPath();g.arc(x,y,.6+rand()*1.6,0,TAU);g.fill();
  }
 }else if(state.tool==='mountain'){
  g.lineWidth=2.8;
  const height=state.peakHeight*18;
  for(let j=0;j<3;j++){
   const x=8+j*90;
   g.beginPath();g.moveTo(x,h*.75);g.lineTo(x+19,h*.49);
   g.lineTo(x+32,h*.49-height);
   g.lineTo(x+51,h*.49);
   g.lineTo(x+66,h*.51-height*.53);
   g.lineTo(x+83,h*.75);g.stroke();
  }
 }else{
  g.lineWidth=state.tool==='erase'?19:16;
  if(state.tool==='erase')g.setLineDash([9,6]);
  g.beginPath();g.moveTo(20,h*.74);
  g.bezierCurveTo(72,0,115,h,163,h*.45);
  g.bezierCurveTo(210,0,239,h*.65,w-18,h*.31);g.stroke();
  g.setLineDash([]);
 }
 g.globalAlpha=1;
}
function updateToolControls(){
 const t=state.tool;
 for(const e of document.querySelectorAll('[data-tool-config]'))
  e.hidden=!e.dataset.toolConfig.split(' ').includes(t);
 const titles={brush:'Solid brush',spray:'Spray paint',mountain:'Alpine peaks',erase:'Eraser',orbit:'Orbit camera',decal:'Image decal'};
 const desc={brush:'Continuous, clean lines',spray:'Scattered particles; adjust density and spread',mountain:'Separated peaks; adjust height and spacing',erase:'Remove only your painted artwork',orbit:'Rotate the aircraft without painting',decal:'Preview, then click to place images'};
 if($('activeToolName'))$('activeToolName').textContent=titles[t]||t;
 if($('activeToolHelp'))$('activeToolHelp').textContent=desc[t]||'';
 drawToolPreview();
}
function setTool(t,requestedPane=null){
 if(!styleTitles[t])return;
 state.tool=t;
 if(paintTools.has(t))state.lastPaintTool=t;
 const pane=requestedPane||(t==='decal'?'decals':paintTools.has(t)?'paint':state.pane);
 for(const e of document.querySelectorAll('.rail-button[data-tool]')){
  const active=e.dataset.tool===t;
  e.classList.toggle('active',active);
  e.setAttribute('aria-pressed',String(active));
 }
 $('brushHUD').textContent=(t==='decal'?'DECAL · '+state.decalSize.toFixed(2):t.toUpperCase()+' · '+state.size.toFixed(2))+' m';
 view.style.cursor=t==='orbit'?'grab':'crosshair';
 state.previewHit=null;
 state.previewInside=false;
 updateToolControls();
 setPane(pane);
 requestView();
}
function setCamera(k){if(k==='iso'){orbit.yaw=.87;orbit.pitch=.37;orbit.dist=21;}if(k==='top'){orbit.yaw=0;orbit.pitch=1.51;}if(k==='bottom'){orbit.yaw=0;orbit.pitch=-1.51;}if(k==='right'){orbit.yaw=0;orbit.pitch=.03;}if(k==='left'){orbit.yaw=Math.PI;orbit.pitch=.03;}if(k==='front'){orbit.yaw=Math.PI/2;orbit.pitch=.015;}for(let e of document.querySelectorAll('[data-camera]'))e.classList.toggle('active',e.dataset.camera===k);requestView();}
function selectCamo(name){if(name===state.camo)return;beginHistory('camo');state.camo=name;renderCamo();document.querySelectorAll('.preset').forEach(x=>x.classList.toggle('active',x.dataset.camo===name));paintDirty();message(name==='none'?'Camouflage removed':name[0].toUpperCase()+name.slice(1)+' camouflage applied');finishHistory();}
function pseudo(seed){let s=seed|0;return()=>{s=(Math.imul(s,1664525)+1013904223)|0;return(s>>>0)/4294967296;};}
const camoPalettes={arctic:['#f0f9fa','#a4d4e5','#739cbb','#dcecef'],alpine:['#eef6fb','#a1dbeb','#8faed1','#d8eef4'],digital:['#d5e8e9','#8cb5c5','#537f95','#b5dbd5'],naval:['#b8cbd3','#637c8d','#31485a','#8daab2'],desert:['#d0c1a0','#8e9878','#a48c70','#eee2c8']};
function renderCamo(){cam.clearRect(0,0,W,H);if(state.camo==='none')return;
 const p=camoPalettes[state.camo],rng=pseudo({arctic:231,alpine:667,digital:431,naval:998,desert:641}[state.camo]);cam.save();cam.globalAlpha=state.camoStrength;
 cam.fillStyle=p[0];cam.globalAlpha=state.camoStrength*.43;cam.fillRect(0,0,W,H);
 const count=state.camo==='digital'?800:state.camo==='alpine'?220:170;
 for(let i=0;i<count;i++){const x=rng()*W,y=rng()*H,s=(.025+rng()*.13)*W,sy=s*(.4+rng()*.9);
  cam.globalAlpha=state.camoStrength*(.22+rng()*.32);cam.fillStyle=p[1+Math.floor(rng()*(p.length-1))];cam.beginPath();
  if(state.camo==='digital'){
   const z=16+Math.floor(rng()*10)*12;const a=Math.ceil(s/z)*z,b=Math.ceil(sy/z)*z;
   cam.rect(x,y,a,b);if(rng()>.5)cam.rect(x+a/3,y-b/2,a/3,b*2);if(rng()>.6)cam.rect(x-a/4,y+b/4,a/2,b/2);
  }else{
   cam.moveTo(x-s*.55,y-sy*.18);cam.lineTo(x-s*.16,y-sy*(.5+rng()));cam.lineTo(x+s*.3,y-sy*(.4+rng()));cam.lineTo(x+s*.65,y+sy*.2);cam.lineTo(x+s*.12,y+sy*.62);cam.lineTo(x-s*.4,y+sy*.45);
  }cam.closePath();cam.fill();
 }
 cam.restore();}
const HISTORY_LIMIT=24;
function updateUndo(){
 $('undoBtn').disabled=!state.undo.length||state.pressed;
 $('redoBtn').disabled=!state.redo.length||state.pressed;
 $('undoBtn').title='Undo ('+state.undo.length+' actions) · Ctrl+Z';
 $('redoBtn').title='Redo ('+state.redo.length+' actions) · Ctrl+Y';
}
function beginHistory(kind='paint'){
 if(activeEdit)finishHistory();
 activeEdit={kind,tiles:new Map(),before:{camo:state.camo,strength:state.camoStrength,showCamo:state.showCamo,showPaint:state.showPaint}};
}
function finishHistory(){
 if(!activeEdit)return;
 const step=activeEdit;activeEdit=null;
 step.after={camo:state.camo,strength:state.camoStrength,showCamo:state.showCamo,showPaint:state.showPaint};
 if(step.tiles.size||step.before.camo!==step.after.camo||step.before.strength!==step.after.strength||step.before.showCamo!==step.after.showCamo||step.before.showPaint!==step.after.showPaint){
  state.undo.push(step);
  if(state.undo.length>HISTORY_LIMIT)state.undo.shift();
  while(state.undo.length>1&&state.undo.reduce((n,item)=>n+(item.tiles?.size||0),0)>120)state.undo.shift();
  state.redo=[]; // New edits invalidate redo, not navigation/cancelled clicks.
 }
 updateUndo();
}
function swapHistoryTiles(step){
 const opposite=new Map();
 for(const [id,bytes] of step.tiles){
  const x=(id%GRID)*TILE,y=Math.floor(id/GRID)*TILE;
  opposite.set(id,paint.getImageData(x,y,TILE,TILE));
  paint.putImageData(bytes,x,y);
  // No active stroke during undo; marking these tiles does not capture new history.
  markTile(id);
 }
 return {kind:'paint',tiles:opposite,before:step.before,after:step.after};
}
function applyCamoHistory(settings){
 state.camo=settings.camo;state.camoStrength=settings.strength;
 state.showCamo=settings.showCamo;state.showPaint=settings.showPaint;
 $('showCamo').checked=state.showCamo;$('showPaint').checked=state.showPaint;
 $('camoStrength').value=String(Math.round(state.camoStrength*100));
 $('camoOut').textContent=$('camoStrength').value+'%';
 document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.camo===state.camo));
 renderCamo();paintDirty();
}
function undo(){
 if(state.pressed||!state.undo.length)return;
 const step=state.undo.pop();
 if(step.kind==='camo'||step.kind==='layers'){applyCamoHistory(step.before);state.redo.push(step);}
 else state.redo.push(swapHistoryTiles(step));
 updateUndo();message('Undo');
}
function redo(){
 if(state.pressed||!state.redo.length)return;
 const step=state.redo.pop();
 if(step.kind==='camo'||step.kind==='layers'){applyCamoHistory(step.after);state.undo.push(step);}
 else state.undo.push(swapHistoryTiles(step));
 updateUndo();message('Redo');
}
function imageFrom(src){return new Promise((ok,no)=>{let im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src;});}
function fitStrokeOverlay(){
 if(!strokeOverlay)return;
 const w=Math.round(wrap.clientWidth),h=Math.round(wrap.clientHeight);
 if(strokeOverlay.width!==w||strokeOverlay.height!==h){
  strokeOverlay.width=w;strokeOverlay.height=h;overlayLast=null;
 }
}
function ghostStroke(p,start=false){
 if(!strokeOverlayCtx||state.tool==='decal'||state.tool==='orbit')return;
 fitStrokeOverlay();
 const c=strokeOverlayCtx,scale=wrap.clientHeight/(2*Math.tan(Math.PI/6)*orbit.dist);
 const width=clamp(state.size*scale*2,2,90);
 c.save();c.lineCap='round';c.lineJoin='round';
 c.globalAlpha=state.tool==='spray'?.30:state.tool==='erase'?.38:.72;
 c.strokeStyle=state.tool==='erase'?'#b6f4fc':state.color;
 c.fillStyle=c.strokeStyle;c.lineWidth=width;
 if(start||!overlayLast){c.beginPath();c.arc(p[0],p[1],width*.5,0,TAU);c.fill();}
 else{c.beginPath();c.moveTo(overlayLast[0],overlayLast[1]);c.lineTo(p[0],p[1]);c.stroke();}
 c.restore();overlayLast=p;
}
function clearGhostStroke(){
 if(strokeOverlayCtx&&strokeOverlay.width)strokeOverlayCtx.clearRect(0,0,strokeOverlay.width,strokeOverlay.height);
 overlayLast=null;
}
function pos(ev){let r=view.getBoundingClientRect();return [ev.clientX-r.left,ev.clientY-r.top];}
function stampAt(posn){let hit=cast(...posn);if(!hit){status('Outside paintable skin');return null;}if(state.tool==='decal')stampDecal(hit);else dab(hit,state.size,{}) ;status(`${hit.uv[0].toFixed(3)}, ${hit.uv[1].toFixed(3)} UV · ${state.tool.toUpperCase()}`);return hit;}
function beginStroke(ev){if(ev.button===2||ev.altKey||ev.shiftKey&&ev.button===1||state.tool==='orbit'||ev.buttons===4||ev.buttons===2){state.orbitActive=true;state.panActive=ev.buttons===4;view.setPointerCapture(ev.pointerId);state.move=pos(ev);view.style.cursor='grabbing';return;}
 if(ev.button!==0||!state.baseLoaded)return;const p=pos(ev),hit=cast(...p);if(!hit){message('Click on the painted fuselage or wings, not empty space.');return;}
 clearGhostStroke();beginHistory('paint');view.setPointerCapture(ev.pointerId);state.pressed=true;state.strokeTravel=0;state.move=p;state.lastStamp=p;state.brushActive=true;stampAt(p);ghostStroke(p,true);requestView();}
function flushStrokePoint(){
 if(!pendingStrokePoint||!state.brushActive||!state.move)return;
 const p=pendingStrokePoint;pendingStrokePoint=null;
 if(state.tool==='decal')return;
 const old=state.move,dx=p[0]-old[0],dy=p[1]-old[1],distance=Math.hypot(dx,dy);
 if(distance<.001)return;
 const pxUnit=wrap.clientHeight/(2*Math.tan(Math.PI/6)*orbit.dist);
 if(state.tool==='mountain'){
  const step=Math.max(8,state.size*pxUnit*state.peakSpacing*2);
  let next=step-state.strokeTravel,count=0;
  while(next<=distance&&count<5){
   const ratio=next/distance;
   stampAt([old[0]+dx*ratio,old[1]+dy*ratio]);
   next+=step;count++;
  }
  state.strokeTravel=(state.strokeTravel+distance)%step;
 }else{
  const step=clamp(state.size*pxUnit*(state.tool==='spray'?.37:.42),3.5,20);
  const n=Math.min(state.tool==='spray'?2:5,Math.max(1,Math.ceil(distance/step)));
  for(let i=1;i<=n;i++)stampAt([old[0]+dx*i/n,old[1]+dy*i/n]);
 }
 state.move=p;requestView();
}
function moveStroke(ev){const p=pos(ev);state.mouse=p;const circle=$('cursorPreview');circle.style.left=p[0]+'px';circle.style.top=p[1]+'px';circle.style.display=ev.pointerType==='touch'||state.tool==='decal'||state.tool==='orbit'?'none':'block';state.previewInside=true;
 const pxRadius=state.tool==='decal'?state.decalSize:state.size;const scale=wrap.clientHeight/(2*Math.tan(Math.PI/6)*orbit.dist);const d=clamp(pxRadius*scale*2,6,260);circle.style.width=d+'px';circle.style.height=d+'px';
 if(state.orbitActive&&state.move){const dx=p[0]-state.move[0],dy=p[1]-state.move[1];if(state.panActive){cameraBasis();orbit.target=add(orbit.target,add(mul(orbit.right,-dx*orbit.dist*.0014),mul(orbit.up,dy*orbit.dist*.0014)));}else{orbit.yaw-=dx*.008;orbit.pitch=clamp(orbit.pitch+dy*.008,-1.55,1.55);}state.move=p;document.querySelectorAll('.camera-btn').forEach(b=>b.classList.remove('active'));requestView();return;}
 if(state.brushActive&&state.move){
  if(state.tool!=='decal'){ghostStroke(p);pendingStrokePoint=p;requestView();}
  return;
 }
 if(state.baseLoaded&&!state.pressed){const now=performance.now();if(now-lastStatusTime<70){if(state.tool==='decal')requestView();return;}lastStatusTime=now;let hit=cast(...p);if(hit)status('UV '+hit.uv.map(n=>n.toFixed(3)).join(' / ')+(state.tool==='decal'?' · DECAL PREVIEW · click to place':' · ready'));if(state.tool==='decal')requestView();}
}
function endStroke(ev){if(state.orbitActive){state.orbitActive=false;view.style.cursor=state.tool==='orbit'?'grab':'crosshair';}if(state.brushActive){if(ev&&ev.type==='pointerup')pendingStrokePoint=pos(ev);flushStrokePoint();state.brushActive=false;state.pressed=false;finishHistory();requestView();}state.move=null;}
function buildStamp(kind){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.strokeStyle='#071721';ctx.fillStyle='#071721';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=12;
 const L=(a)=>{ctx.beginPath();a.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
 if(kind==='alpine'){L([[30,388],[130,235],[190,305],[255,101],[315,283],[370,210],[486,381]]);L([[113,259],[147,276],[170,249]]);L([[230,150],[258,182],[279,161]]);L([[365,229],[389,249]]);L([[55,411],[170,411],[245,390],[355,411],[465,412]]);}
 if(kind==='badge'){ctx.lineWidth=16;ctx.beginPath();ctx.arc(256,256,206,0,TAU);ctx.stroke();L([[93,349],[183,270],[240,330],[302,214],[395,354],[432,336]]);ctx.lineWidth=9;L([[166,192],[241,172],[256,101],[272,168],[357,190],[294,201],[282,245],[259,222],[219,242],[218,204],[166,192]]);}
 if(kind==='snow'){ctx.lineWidth=22;for(let i=0;i<6;i++){let a=i*TAU/6;L([[256,256],[256+185*Math.cos(a),256+185*Math.sin(a)]]);const e=[256+146*Math.cos(a),256+146*Math.sin(a)],ax=a+.60,ay=a-.60;L([e,[e[0]-53*Math.cos(ax),e[1]-53*Math.sin(ax)]]);L([e,[e[0]-53*Math.cos(ay),e[1]-53*Math.sin(ay)]]);}}
 if(kind==='star'){ctx.beginPath();for(let i=0;i<10;i++){let r=i%2?90:210,a=i*Math.PI/5-Math.PI/2,x=256+r*Math.cos(a),y=256+r*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();}
 if(kind==='roundel'){ctx.lineWidth=32;ctx.beginPath();ctx.arc(256,256,190,0,TAU);ctx.stroke();ctx.lineWidth=24;ctx.beginPath();ctx.arc(256,256,110,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(256,256,37,0,TAU);ctx.fill();}
 if(kind==='chevron'){ctx.lineWidth=36;L([[67,345],[253,143],[445,345]]);}
 return c;}
function setupStamps(){const kinds=[['alpine','Alpine peaks'],['badge','Sukhoi badge'],['snow','Snowflake'],['chevron','Chevron'],['star','Star'],['roundel','Roundel']],grid=$('stampGrid');
 for(let[k,name]of kinds){let c=buildStamp(k),btn=document.createElement('button');btn.className='stamp';btn.dataset.stamp=k;btn.title=name;let preview=c.toDataURL('image/png');btn.innerHTML=`<img src="${preview}" alt="${name}" style="width:43px;height:43px;object-fit:contain;filter:invert(.76) sepia(.2) hue-rotate(145deg)"><span>${name}</span>`;btn.addEventListener('click',()=>{state.stamp=k;setDecalImage(c,name);state.decalRotate=0;$('decalRotate').value=0;$('decalRotateOut').textContent='0°';document.querySelectorAll('.stamp').forEach(e=>e.classList.toggle('active',e.dataset.stamp===k));setTool('decal');message(name+' selected. Hover to preview; click to place.');});grid.appendChild(btn);}
 grid.querySelector('[data-stamp="alpine"]').click();setTool('brush');}
function loadImageFile(f,onReady){if(!f)return;let reader=new FileReader();reader.onload=async()=>{try{let data=reader.result,img=await imageFrom(data);onReady(img);message('Loaded '+f.name);}catch(e){message('Image could not be read. Try PNG or JPG.');}};reader.readAsDataURL(f);}
function readTGA(bytes){const data=new Uint8Array(bytes),type=data[2],idlen=data[0],w=data[12]+(data[13]<<8),h=data[14]+(data[15]<<8),bits=data[16];if(type!==2||!([24,32].includes(bits))||w<1||h<1||w>8192||h>8192)throw Error('Only uncompressed 24/32-bit TGA supported');let stride=bits/8,start=18+idlen;const c=document.createElement('canvas');c.width=w;c.height=h;const ct=c.getContext('2d');const image=ct.createImageData(w,h),top=(data[17]&32)!==0;for(let y=0;y<h;y++){let srcY=top?y:h-1-y;for(let x=0;x<w;x++){let j=start+(srcY*w+x)*stride,i=(y*w+x)*4;image.data[i]=data[j+2];image.data[i+1]=data[j+1];image.data[i+2]=data[j];image.data[i+3]=stride===4?data[j+3]:255;}}ct.putImageData(image,0,0);return c;}
function importBase(f){if(!f)return; if(/\.tga$/i.test(f.name)){let r=new FileReader();r.onload=()=>{try{const c=readTGA(r.result);base.clearRect(0,0,W,H);base.drawImage(c,0,0,W,H);baseAlpha=null;paintDirty();message('Imported TGA base skin');}catch(e){message(e.message);}};r.readAsArrayBuffer(f);}else loadImageFile(f,img=>{base.clearRect(0,0,W,H);base.drawImage(img,0,0,W,H);baseAlpha=null;paintDirty();});}
async function loadBase(){const img=await imageFrom(window.F16_BASE_SRC);base.drawImage(img,0,0);window.F16_BASE_SRC=null;state.baseLoaded=true;paintDirty();}
function makeDownload(bytes,name,type='application/octet-stream'){const b=bytes instanceof Blob?bytes:new Blob([bytes],{type});let link=document.createElement('a'),url=URL.createObjectURL(b);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);}
function latinBytes(str){return new TextEncoder().encode(str);}
let crcTable=null;function crc32(bytes){if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}let c=0xffffffff;for(let i=0;i<bytes.length;i++)c=crcTable[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function word(view,offset,n){view.setUint16(offset,n,true);}
function dword(view,offset,n){view.setUint32(offset,n>>>0,true);}
async function deflate(data){if(typeof CompressionStream==='undefined')return {bytes:data,method:0};try{const stream=new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));let result=new Uint8Array(await new Response(stream).arrayBuffer());if(result.length>=data.length)return{bytes:data,method:0};return{bytes:result,method:8};}catch(e){return{bytes:data,method:0};}}
async function writeZIP(files){let chunks=[],local=0,records=[];
 for(const file of files){let name=latinBytes(file.name),uncompressed=file.data instanceof Uint8Array?file.data:new Uint8Array(file.data),compressed=await deflate(uncompressed);let c=crc32(uncompressed),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);dword(v,0,0x04034b50);word(v,4,20);word(v,6,0);word(v,8,compressed.method);word(v,10,0);word(v,12,0);dword(v,14,c);dword(v,18,compressed.bytes.length);dword(v,22,uncompressed.length);word(v,26,name.length);word(v,28,0);header.set(name,30);chunks.push(header,compressed.bytes);records.push({name,c,size:uncompressed.length,packed:compressed.bytes.length,method:compressed.method,offset:local});local+=header.length+compressed.bytes.length;}
 let dirStart=local;for(const f of records){const h=new Uint8Array(46+f.name.length),v=new DataView(h.buffer);dword(v,0,0x02014b50);word(v,4,20);word(v,6,20);word(v,8,0);word(v,10,f.method);dword(v,16,f.c);dword(v,20,f.packed);dword(v,24,f.size);word(v,28,f.name.length);dword(v,42,f.offset);h.set(f.name,46);chunks.push(h);local+=h.length;}
 const end=new Uint8Array(22),ve=new DataView(end.buffer);dword(ve,0,0x06054b50);word(ve,8,records.length);word(ve,10,records.length);dword(ve,12,local-dirStart);dword(ve,16,dirStart);chunks.push(end);return new Blob(chunks,{type:'application/zip'});}
function tgaRGBA(image,alpha){const px=image.data,ret=new Uint8Array(18+W*H*4),header=ret;header[2]=2;header[12]=W&255;header[13]=W>>8;header[14]=H&255;header[15]=H>>8;header[16]=32;header[17]=0x08;const dst=ret;
 for(let y=0;y<H;y++){let ofs=18+y*W*4,src=(H-1-y)*W*4;for(let x=0;x<W;x++){let j=src+x*4,k=ofs+x*4;dst[k]=px[j+2];dst[k+1]=px[j+1];dst[k+2]=px[j];dst[k+3]=alpha?alpha[j+3]:px[j+3];}}return ret;}
async function exportSkin(){if(!state.baseLoaded)return;const b=$('busyModal');b.classList.add('show');await new Promise(r=>setTimeout(r,90));try{
 $('busyTitle').textContent='Building the 4K TGA…';$('busyMessage').textContent='Preparing 16 million pixels. This may take a few seconds.';compose();const color=out.getImageData(0,0,W,H),a=base.getImageData(0,0,W,H).data;
 let bytes=tgaRGBA(color,a);$('busyTitle').textContent='Packing War Thunder ZIP…';await new Promise(r=>setTimeout(r,60));
 const blk=`name:t="user"\n\nreplace_tex{\n  from:t="f_16a_block_20_mlu_c*"\n  to:t="f_16a_block_20_mlu.tga"\n}\n`;
 const readme=`SNOWYSTUDIO - F-16A Block 20 MLU\n\n1. Extract the enclosed SnowyStudio_F16A_MLU folder into the War Thunder/UserSkins directory.\n2. Choose the F-16A Block 20 MLU in War Thunder, open Customization > User skin, select this folder.\n3. The skin replaces the aircraft's diffuse color texture only. War Thunder continues to use its original normal map.\n4. Texture: 4096x4096 TGA 32-bit BGRA, original alpha preserved.\n\nThis is a user-made texture, not an official Gaijin product.\n`;
 let root='SnowyStudio_F16A_MLU/';let zip=await writeZIP([{name:root+'f_16a_block_20_mlu.tga',data:bytes},{name:root+'f_16a_block_20_mlu.blk',data:latinBytes(blk)},{name:root+'README.txt',data:latinBytes(readme)}]);makeDownload(zip,'SnowyStudio_F16A_MLU_WarThunder.zip','application/zip');message('War Thunder skin exported! Extract into UserSkins.');
 }catch(e){console.error(e);message('Export failed: '+e.message);alert('Export failed: '+e.message);}finally{b.classList.remove('show');}}
async function saveProject(){if(!state.baseLoaded)return;const obj={format:'snowystudio-project',version:1,created:new Date().toISOString(),aircraft:'f_16a_block_20_mlu',settings:{camo:state.camo,camoStrength:state.camoStrength},base:baseCanvas.toDataURL('image/png'),camo:camCanvas.toDataURL('image/png'),paint:paintCanvas.toDataURL('image/png')};makeDownload(latinBytes(JSON.stringify(obj)),'SnowyStudio_F16_MLU.snowyproject.json','application/json');message('Project saved with editable artwork layers');}
async function openProject(f){if(!f)return;try{const obj=JSON.parse(await f.text());if(obj.format!=='snowystudio-project'||obj.aircraft!=='f_16a_block_20_mlu')throw Error('Not an F-16 SnowyStudio project');const images=await Promise.all([imageFrom(obj.base),imageFrom(obj.camo),imageFrom(obj.paint)]);base.clearRect(0,0,W,H);cam.clearRect(0,0,W,H);paint.clearRect(0,0,W,H);base.drawImage(images[0],0,0,W,H);cam.drawImage(images[1],0,0,W,H);paint.drawImage(images[2],0,0,W,H);state.camo=obj.settings?.camo||'none';state.camoStrength=obj.settings?.camoStrength||.78;activeEdit=null;state.undo=[];state.redo=[];updateUndo();document.querySelectorAll('.preset').forEach(x=>x.classList.toggle('active',x.dataset.camo===state.camo));paintDirty();message('Project loaded successfully');}catch(e){message('Could not load project: '+e.message);}}
function setupUI(){setupSwatches();setupStamps();
 for(const e of document.querySelectorAll('.sidebar-tab'))e.addEventListener('click',()=>{
  const pane=e.dataset.paneTarget;
  if(pane==='paint')setTool(state.lastPaintTool||'brush');
  else if(pane==='decals')setTool('decal');
  else setTool('orbit',pane); // Camo / Layers must never paint during navigation.
 });
 const drawer=$('uvDrawer');const toggleUV=(open)=>{drawer.classList.toggle('is-open',open);if(open){state.needMini=true;requestView();}$('uvToggle').setAttribute('aria-expanded',String(open));};
 $('uvToggle').addEventListener('click',()=>toggleUV(!drawer.classList.contains('is-open')));
 $('uvClose').addEventListener('click',()=>toggleUV(false));
 const qualityButton=$('previewQualityBtn'),qualityMenu=$('qualityMenu'),qualityWrap=$('qualityWrap');
 function showQualityMenu(show){
  qualityMenu.hidden=!show;qualityButton.setAttribute('aria-expanded',String(show));
  $('customQualityFields').hidden=state.quality!=='custom';
  if(show)syncCustomQualityInputs();
 }
 qualityButton.addEventListener('click',()=>showQualityMenu(qualityMenu.hidden));
 document.addEventListener('pointerdown',e=>{
  if(!qualityMenu.hidden&&!qualityWrap.contains(e.target))showQualityMenu(false);
 });
 for(const option of document.querySelectorAll('[data-quality-option]')){
  option.addEventListener('click',()=>{
   const mode=option.dataset.qualityOption;
   setPreviewQuality(mode);
   $('customQualityFields').hidden=mode!=='custom';
   if(mode==='custom')syncCustomQualityInputs();
   else showQualityMenu(false);
  });
 }
 $('customUnlimited').addEventListener('change',()=>{
  $('customFps').disabled=$('customUnlimited').checked;
 });
 $('applyCustomQuality').addEventListener('click',()=>{
  readCustomQualityInputs();setPreviewQuality('custom');showQualityMenu(false);
 });
 loadQualityPreferences();syncCustomQualityInputs();setPreviewQuality(state.quality);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.needsRender)scheduleFrame();});
  $('zoomIn').addEventListener('click',()=>{orbit.dist=clamp(orbit.dist*.78,4.5,60);requestView();});
 $('zoomOut').addEventListener('click',()=>{orbit.dist=clamp(orbit.dist*1.28,4.5,60);requestView();});
 $('fitView').addEventListener('click',()=>setCamera('iso'));
 for(const b of document.querySelectorAll('.rail-button[data-tool]'))b.addEventListener('click',()=>setTool(b.dataset.tool));
 for(const b of document.querySelectorAll('.segbtn'))b.addEventListener('click',()=>{state.style=b.dataset.style;drawToolPreview();document.querySelectorAll('.segbtn').forEach(x=>x.classList.toggle('active',x===b));});
 function bindRange(id,prop,outid,render){let input=$(id),output=$(outid);input.addEventListener('input',()=>{state[prop]=+input.value*(prop==='opacity'||prop==='hardness'||prop==='camoStrength'?.01:1);output.textContent=prop==='size'||prop==='decalSize'?state[prop].toFixed(2)+' m':prop==='decalRotate'?state[prop]+'°':prop==='sprayDensity'?Math.round(state[prop])+' dots':prop==='spraySpread'||prop==='peakHeight'||prop==='peakSpacing'?state[prop].toFixed(2)+'×':Math.round(state[prop]*100)+'%';if(render)render();if(state.tool==='decal')requestView();drawToolPreview();$('brushHUD').textContent=(state.tool==='decal'?'DECAL · '+state.decalSize.toFixed(2):state.tool.toUpperCase()+' · '+state.size.toFixed(2))+' m';});}
 bindRange('sprayDensity','sprayDensity','sprayDensityOut');
 bindRange('spraySpread','spraySpread','spraySpreadOut');
 bindRange('peakHeight','peakHeight','peakHeightOut');
 bindRange('peakSpacing','peakSpacing','peakSpacingOut');
 bindRange('brushSize','size','sizeOut');bindRange('opacity','opacity','opacityOut');bindRange('hardness','hardness','hardnessOut');bindRange('decalSize','decalSize','decalSizeOut');bindRange('decalRotate','decalRotate','decalRotateOut');
 $('camoStrength').addEventListener('input',()=>{$('camoOut').textContent=$('camoStrength').value+'%';});$('camoStrength').addEventListener('change',()=>{const v=+$('camoStrength').value/100;if(v===state.camoStrength)return;beginHistory('camo');state.camoStrength=v;renderCamo();paintDirty();finishHistory();});
 $('colorPick').addEventListener('input',e=>{state.color=e.target.value;updateColors();drawToolPreview();});
 for(const b of document.querySelectorAll('.preset'))b.addEventListener('click',()=>selectCamo(b.dataset.camo));
 $('showCamo').addEventListener('change',e=>{beginHistory('layers');state.showCamo=e.target.checked;paintDirty();finishHistory();});$('showPaint').addEventListener('change',e=>{beginHistory('layers');state.showPaint=e.target.checked;paintDirty();finishHistory();});
 $('undoBtn').addEventListener('click',undo);$('redoBtn').addEventListener('click',redo);
 $('decalInput').addEventListener('change',e=>loadImageFile(e.target.files[0],img=>{setDecalImage(img,e.target.files[0].name);document.querySelectorAll('.stamp').forEach(x=>x.classList.remove('active'));setTool('decal');$('decalHint').textContent='Previewing '+e.target.files[0].name+' — click model to apply it';}));
 $('baseInput').addEventListener('change',e=>importBase(e.target.files[0]));$('importBaseBtn').addEventListener('click',()=>$('baseInput').click());
 $('atlasBtn').addEventListener('click',()=>{compose();outCanvas.toBlob(blob=>makeDownload(blob,'SnowyStudio_F16_UV_atlas.png','image/png'),'image/png');});
 $('exportBtn').addEventListener('click',exportSkin);$('projectBtn').addEventListener('click',saveProject);$('loadBtn').addEventListener('click',()=>$('projectInput').click());
 const projectInput=document.createElement('input');projectInput.id='projectInput';projectInput.type='file';projectInput.accept='.json,.snowyproject.json';projectInput.className='hidden';document.body.append(projectInput);projectInput.addEventListener('change',e=>openProject(e.target.files[0]));
 $('helpRail').addEventListener('click',()=>$('helpModal').classList.add('show'));$('helpSide').addEventListener('click',()=>$('helpModal').classList.add('show'));$('closeHelp').addEventListener('click',()=>$('helpModal').classList.remove('show'));
 for(const b of document.querySelectorAll('.camera-btn'))b.addEventListener('click',()=>setCamera(b.dataset.camera));
 view.addEventListener('pointerdown',beginStroke);view.addEventListener('pointermove',moveStroke);view.addEventListener('pointerup',endStroke);view.addEventListener('pointercancel',endStroke);view.addEventListener('contextmenu',e=>e.preventDefault());view.addEventListener('pointerleave',()=>{$('cursorPreview').style.display='none';state.previewInside=false;state.previewHit=null;requestView();});
 view.addEventListener('wheel',e=>{e.preventDefault();orbit.dist=clamp(orbit.dist*Math.exp(e.deltaY*.001),4.5,60);requestView();},{passive:false});
 wrap.addEventListener('dragover',e=>{e.preventDefault();});wrap.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer?.files?.[0];if(f&&f.type.startsWith('image/'))loadImageFile(f,img=>{setDecalImage(img,f.name);document.querySelectorAll('.stamp').forEach(x=>x.classList.remove('active'));setTool('decal');message('Image loaded. Hover over the aircraft to preview.');});});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('qualityMenu').hidden){$('qualityMenu').hidden=true;$('previewQualityBtn').setAttribute('aria-expanded','false');e.preventDefault();return;}if($('helpModal').classList.contains('show')){$('helpModal').classList.remove('show');}else if(state.tool==='decal'){setTool('orbit');message('Decal preview cancelled — no artwork placed.');}e.preventDefault();return;}if(e.target.matches('input,textarea,select'))return;let key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}if((e.ctrlKey||e.metaKey)&&key==='y'){e.preventDefault();redo();return;}if(key==='b')setTool('brush');if(key==='d')setTool('decal');if(key==='e')setTool('erase');if(key==='o')setTool('orbit');});
 window.addEventListener('resize',()=>{fitStrokeOverlay();requestView();});
}
try{status('Loading F-16 geometry…');initGL();initMesh();setupUI();requestView();loadBase().then(()=>{state.loaded=true;status('F-16 READY · 68k textured triangles');message('F-16 loaded. Paint directly on the aircraft!');}).catch(e=>{console.error(e);status('Could not load base image: '+e.message);message('Texture missing — keep assets folder next to index.html');});}catch(e){console.error('SnowyStudio boot',e);status('Startup error: '+e.message);alert('SnowyStudio failed to start: '+e.message);}
})();