'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const js=fs.readFileSync(__dirname+'/../app.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function cut(start,end){
 let i=js.indexOf(start),j=js.indexOf(end,i+start.length);
 assert(i>=0 && j>i,'missing '+start);
 return js.slice(i,j);
}
const log=[];
const context={
 state:{tool:'brush',size:.24,color:'#000000',opacity:1,hardness:1,style:'round',sprayDensity:42,spraySpread:1.2,peakHeight:1.1,peakSpacing:1.5},
 hexRGB:()=>[0,0,0],sphereQuery:()=>[3],projectTriangle:(tri,hit,r,mode)=>{log.push('mode:'+mode);return {uv:[[0,0],[1,0],[0,1]],mat:[1,0,0,1,0,0]};},
 clipUV:()=>{},paintDirty:()=>{},TAU:Math.PI*2,Math,console,
 paint:new Proxy({}, {set(obj,k,v){if(k==='globalCompositeOperation')log.push('composite:'+v);obj[k]=v;return true;},get(obj,k){
 if(k==='createRadialGradient')return ()=>({addColorStop(){}});
 if(['save','restore','setTransform','beginPath','arc','fill','stroke','moveTo','lineTo','bezierCurveTo'].includes(k))return (...args)=>{if(['arc','fill','stroke','lineTo'].includes(k))log.push(k);};
 return obj[k];
 }})
};
vm.createContext(context);
vm.runInContext(cut('function dab(hit,radius,params','function stampDecal(hit)'),context);
const hit={point:[0,0,0],normal:[0,1,0],dir:[0,0,1]};
function draw(type){
 context.state.tool=type;log.length=0;context.dab(hit,.2,{});
 return {arc:log.filter(x=>x==='arc').length,stroke:log.filter(x=>x==='stroke').length,fill:log.filter(x=>x==='fill').length,peakProjection:log.includes('mode:peak'),erases:log.includes('composite:destination-out')};
}
let brush=draw('brush'),spray=draw('spray'),peak=draw('mountain'),erase=draw('erase');
assert.equal(brush.arc,1,'Brush creates one smooth filled dab');
assert.equal(brush.fill,1);
assert.equal(spray.arc,42,'Spray creates configurable scattered dots');
assert.equal(spray.fill,42);
assert.equal(spray.stroke,0);
assert.equal(peak.arc,0,'Peak does not paint filled brush circles');
assert.equal(peak.stroke,2,'Peak draws mountain skyline and rock details');
assert.equal(peak.peakProjection,true,'Peak uses camera-plane projection');
assert.equal(erase.erases,true,'Erase removes artwork');
assert.match(html,/id="sprayDensity"/);assert.match(html,/id="spraySpread"/);
assert.match(html,/id="peakHeight"/);assert.match(html,/id="peakSpacing"/);
assert.match(html,/id="toolPreview"/);
assert.ok(js.includes('updateToolControls();'));
assert.ok(js.includes("state.tool==='mountain'"));
assert.ok(!js.includes("openPane(b.dataset.tool"),'keeps tab gating logic intact');
console.log('PASS: brush (smooth), spray ('+spray.arc+' particles), Alpine peaks ('+peak.stroke+' paths), erase (destination-out), tool controls and gating.');

