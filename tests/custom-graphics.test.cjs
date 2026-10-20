'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../app.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function cut(from,to){let i=code.indexOf(from),j=code.indexOf(to,i+from.length);assert(i>=0&&j>i,from);return code.slice(i,j);}
const memory=new Map();
const controls={
 previewQualityBtn:{textContent:'',title:''},perfModeText:{textContent:''},
 customFps:{value:'60',disabled:false},customUnlimited:{checked:false},
 customTextureSize:{value:'2048'},customViewportSize:{value:'1800'}
};
const calls=[];
const canvasContext={clearRect(){},drawImage(){}};
const context={
 state:{quality:'fast',needsRender:false,dirtyTex:false,baseLoaded:true,showCamo:false,showPaint:false},W:4096,H:4096,TILE:256,GRID:16,
 Math,Set,Map,dirtyTiles:new Set(),patchCanvas:{width:0,height:0},requestView(){},
 $:id=>controls[id]||null,
 localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
 document:{querySelectorAll(){return [];},createElement(){
  return {width:0,height:0,getContext:()=>canvasContext};
 }},
 gl:{TEXTURE0:0,TEXTURE_2D:1,UNPACK_FLIP_Y_WEBGL:2,RGBA:3,UNSIGNED_BYTE:4,
  activeTexture(){},bindTexture(){},pixelStorei(){},
  texImage2D(target,level,format,fmt,type,canvas){calls.push({op:'full',w:canvas.width});},
  texSubImage2D(target,level,x,y,format,type,canvas){calls.push({op:'patch',x,y,w:canvas.width,h:canvas.height});}},
 tex:{},out:canvasContext,outCanvas:{},baseCanvas:{},camCanvas:{},paintCanvas:{},
 patchCtx:canvasContext,
 previewCtx:canvasContext,
 clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),
 performance:{now:()=>1000},
};
vm.createContext(context);
vm.runInContext(cut('const renderProfiles=','function message('),context);
vm.runInContext(cut('function compose(){','function setDecalImage('),context);
vm.runInContext("customQuality.textureSize=3000;customQuality.maxSide=3000;customQuality.fps=144;customQuality.unlimited=false;setPreviewQuality('custom');",context);
assert.equal(vm.runInContext('previewSize',context),3000);
assert.equal(vm.runInContext('qualityProfile().paintFps',context),144);
assert.equal(vm.runInContext('qualityProfile().maxSide',context),3000);
assert.ok(controls.perfModeText.textContent.includes('144 FPS'));
assert.ok(controls.perfModeText.textContent.includes('4K export'));
assert.equal(JSON.parse(memory.get('snowystudio-quality-v1')).custom.textureSize,3000);
vm.runInContext('syncCustomQualityInputs()',context);
assert.equal(controls.customTextureSize.value,3000);
controls.customFps.value='6000';controls.customTextureSize.value='99999';controls.customViewportSize.value='4100';
controls.customUnlimited.checked=true;
vm.runInContext('readCustomQualityInputs();setPreviewQuality("custom")',context);
assert.equal(vm.runInContext('customQuality.fps',context),1000);
assert.equal(vm.runInContext('customQuality.textureSize',context),3000);
assert.equal(vm.runInContext('customQuality.maxSide',context),3000);
assert.equal(controls.customFps.disabled,true);
assert.equal(vm.runInContext('qualityProfile().paintFps',context),Infinity,'Unlimited FPS means no app cap');
assert.match(controls.perfModeText.textContent,/Unlimited/);
const storage=memory.get('snowystudio-quality-v1');
assert.equal(JSON.parse(storage).mode,'custom');
vm.runInContext("customQuality.textureSize=1024;customQuality.unlimited=false;state.quality='fast';loadQualityPreferences()",context);
assert.equal(vm.runInContext('customQuality.textureSize',context),3000,'restores saved resolution');
assert.equal(vm.runInContext('customQuality.unlimited',context),true,'restores Unlimited setting');
assert.equal(context.state.quality,'custom');
// Exact 3000px non-power-of-two layout: patches must tile without gaps or overlaps.
context.refreshTexture();
assert.deepEqual(calls.at(-1),{op:'full',w:3000});
function tile(id){
 const x=(id%16)*256,y=Math.floor(id/16)*256;
 context.dirtyTiles.add(id);vm.runInContext('textureFull=false;',context);
 context.refreshTexture();
 const patch=calls.at(-1);assert.equal(patch.op,'patch');
 const scale=3000/4096;
 assert.equal(patch.x,Math.round(x*scale));
 assert.equal(patch.y,Math.round((4096-y-256)*scale));
 assert.equal(patch.w,Math.round((x+256)*scale)-Math.round(x*scale));
 assert.equal(patch.h,Math.round((4096-y)*scale)-Math.round((4096-y-256)*scale));
 return patch;
}
const t0=tile(0),t1=tile(1),end=tile(255);
assert.equal(t0.x+t0.w,t1.x,'adjacent horizontal tiles meet');
assert.equal(end.x+end.w,3000,'last tile finishes texture width');
assert.equal(end.y,0,'last tile reaches texture bottom');
const scheduleCalls=[];
Object.assign(context,{document:{...context.document,hidden:false},requestAnimationFrame:cb=>{scheduleCalls.push(['raf']);return 1;},
 setTimeout:(cb,ms)=>{scheduleCalls.push(['timeout',ms]);return 1;},frame(){}});
vm.runInContext('let raf=0;lastDrawTime=1000;',context);
vm.runInContext(cut('function scheduleFrame(){','function compose(){'),context);
vm.runInContext("state.brushActive=true;state.orbitActive=false;state.tool='brush';scheduleFrame()",context);
assert.deepEqual(scheduleCalls,[['raf']],'Unlimited FPS skips the explicit timeout and follows requestAnimationFrame');
assert.match(html,/id="qualityMenu"/);
assert.match(html,/id="customFps" type="number"/);
assert.match(html,/id="customUnlimited" type="checkbox"/);
assert.match(html,/id="customTextureSize" type="number" min="256" max="3000"/);
assert.match(html,/id="customViewportSize" type="number" min="320" max="3000"/);
console.log('PASS: 3000px custom texture tiled exactly, FPS 144/Unlimited, max viewport, saved preferences, custom controls, uncapped RAF.');

