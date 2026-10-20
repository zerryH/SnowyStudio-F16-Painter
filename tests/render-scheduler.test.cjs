'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../app.js','utf8');
const start=code.indexOf('function scheduleFrame(){'),end=code.indexOf('function compose(){',start);
assert.ok(start>=0&&end>start);
const scheduler=code.slice(start,end);
function scenario(quality,brushActive,orbitActive,tool){
 const scheduled=[],rafCallbacks=[];
 const state={quality,brushActive,orbitActive,tool,needsRender:false};
 const profiles={fast:{paintFps:30,orbitFps:38,idleFps:35},balanced:{paintFps:30,orbitFps:45,idleFps:50},detail:{paintFps:40,orbitFps:60,idleFps:60}};
 const ctx={state,qualityProfile:()=>profiles[state.quality],performance:{now:()=>1000},document:{hidden:false},
  requestAnimationFrame:fn=>{rafCallbacks.push(fn);return rafCallbacks.length;},
  setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},frame(){}};
 vm.createContext(ctx);
 vm.runInContext('let raf=0,frameTimer=0,lastDrawTime=1000;',ctx);
 vm.runInContext(scheduler,ctx);
 for(let i=0;i<100;i++)ctx.requestView();
 assert.equal(scheduled.length,1,'repeated 240Hz pointer events schedule only one next frame');
 assert.equal(rafCallbacks.length,0,'must defer instead of scheduling 100 RAF callbacks');
 return scheduled[0].ms;
}
const fast=scenario('fast',true,false,'brush'),balanced=scenario('balanced',true,false,'brush'),detail=scenario('detail',true,false,'brush');
assert.ok(fast>32&&fast<35,'Fast brush redraw cap should be ~30fps');
assert.ok(balanced>32&&balanced<35,'Balanced cap should be ~30fps');
assert.ok(detail>24&&detail<26,'Detail cap should be ~40fps');
const fastOrbit=scenario('fast',false,true,'orbit');
assert.ok(fastOrbit>25&&fastOrbit<28,'camera orbit cap should be ~38fps');
assert.ok(code.includes('maxPixels:850000'),'Fast viewport has an 850k pixel buffer budget');
assert.ok(code.includes('textureSize:1024'),'Fast on-screen texture is 1024px');
assert.ok(code.includes("Math.min(state.tool==='spray'?2:5"),'stamp count per frame is bounded');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert.match(html,/id="previewQualityBtn"/,'preview mode selector');
assert.match(html,/app\.js\?v=color-lab-20261020/,'script cache bust');
console.log('PASS: 30/30/40fps paint caps, 38fps camera cap, one RAF per 100 events, 850k pixels, 1K preview, bounded brush stamps.');

