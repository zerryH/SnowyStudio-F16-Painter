'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const first=source.indexOf('const sprayStamp=document.createElement'),last=source.indexOf('function stampDecal(hit)',first);
assert(first>=0 && last>first,'UV painting should use cached stamp and direct UV path');
const code=source.slice(first,last);
let mainCalls=[],stampCalls=[],tileWrites=[];
function fakeCtx(target){
 const calls=target;
 return new Proxy({},{
  set(obj,k,v){obj[k]=v;if(k==='globalCompositeOperation')calls.push('composite:'+v);return true;},
  get(obj,k){
   if(['arc','fill','stroke','drawImage','clearRect'].includes(k))return (...a)=>calls.push({op:k,args:a});
   if(k==='createRadialGradient')return ()=>({addColorStop(){}});
   if(['translate','rotate','save','restore','beginPath','moveTo','lineTo'].includes(k))return ()=>{};
   return obj[k];
  }
 });
}
const sprayCtx=fakeCtx(stampCalls);
const paint=fakeCtx(mainCalls);
const state={color:'#000000',opacity:1,style:'round',hardness:1,sprayDensity:60,spraySpread:1.3,peakHeight:1.1,tool:'brush'};
const fakeCanvas={width:0,height:0,getContext(){return sprayCtx;}};
const context={document:{createElement(k){assert.equal(k,'canvas');return fakeCanvas;}},state,W:4096,H:4096,TILE:256,GRID:16,
 paint,Math,console,Set,Map,TAU:Math.PI*2,
 triCoords:()=>[[0,0,0],[1,0,0],[0,1,0]],
 triUV:()=>[[0,0],[100,0],[0,100]],
 sub:(a,b)=>a.map((n,i)=>n-b[i]),
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(...a),
 clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 hexRGB:()=>[0,0,0],
 markTile:id=>tileWrites.push(id),
 pseudo:seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;},
 sphereQuery(){throw Error('SLOW 3D TRIANGLE LOOP SHOULD NOT RUN IN BRUSH DAB');},
 projectTriangle(){throw Error('SLOW TRIANGLE PROJECTION SHOULD NOT RUN IN BRUSH DAB');},
};
vm.createContext(context);
vm.runInContext(code,context);
const hit={tri:7,uv:[1000/4096,1-1000/4096],point:[1,2,3]};
function paintTool(name){
 state.tool=name;mainCalls.length=0;tileWrites.length=0;context.dab(hit,.24);
 return mainCalls.map(x=>x.op||x);
}
let brush=paintTool('brush');
assert.equal(brush.filter(x=>x==='arc').length,1,'brush should only draw one UV circle per dab');
assert.equal(brush.filter(x=>x==='fill').length,1,'one 2D paint operation');
assert.ok(tileWrites.length>=1&&tileWrites.length<=4,'small brush captures only adjacent 256px tiles');
let spray=paintTool('spray');
assert.equal(spray.filter(x=>x==='drawImage').length,1,'spray blits one cached sprite per dab');
const firstStampRenders=stampCalls.filter(x=>x.op==='arc').length;
assert.ok(firstStampRenders>100,'first spray stamp generates particle pattern');
spray=paintTool('spray');
assert.equal(stampCalls.filter(x=>x.op==='arc').length,firstStampRenders,'spray stamp cached between dabs');
let peak=paintTool('mountain');
assert.equal(peak.filter(x=>x==='stroke').length,2,'peak draws skyline and snowcap details');
let erase=paintTool('erase');
assert.ok(erase.includes('composite:destination-out'),'erase uses transparency');
assert.ok(source.includes('const tris=sphereQuery(')===false||source.indexOf('const tris=sphereQuery(')>source.indexOf('function stampDecal('),'UV dabs have no triangle search');
console.log('PASS: brush one UV circle, spray one cached sprite, peak two paths, erase compositing, cached stamps and no CPU mesh loops.');

