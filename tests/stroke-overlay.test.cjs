'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../app.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const a=code.indexOf('function fitStrokeOverlay(){'),b=code.indexOf('function pos(ev)',a);
assert.ok(a>0&&b>a);
const events=[],ctx2d={save(){events.push('save')},restore(){},beginPath(){},arc(){events.push('arc')},fill(){events.push('fill')},
 moveTo(){},lineTo(){},stroke(){events.push('stroke')},clearRect(){events.push('clear')}};
const overlay={width:0,height:0};
const s={tool:'brush',size:.24,color:'#101820'};
const box={clientWidth:900,clientHeight:750};
const ctx={strokeOverlay:overlay,strokeOverlayCtx:ctx2d,overlayLast:null,wrap:box,state:s,shapeTools:new Set(['line','rectangle','ellipse']),
 orbit:{dist:18},Math,TAU:Math.PI*2,clamp:(x,a,b)=>Math.min(b,Math.max(a,x))};
vm.createContext(ctx);vm.runInContext(code.slice(a,b),ctx);
ctx.ghostStroke([150,150],true);
assert.ok(events.includes('arc'),'initial cursor mark');
assert.equal(overlay.width,900);assert.equal(overlay.height,750);
events.length=0;ctx.ghostStroke([155,160]);
assert.ok(events.includes('stroke'),'cursor drag renders immediately');
ctx.clearGhostStroke();assert.equal(events.at(-1),'clear');
assert.equal(ctx.overlayLast,null);
assert.match(code,/if\(!state\.dirtyTex&&!state\.shapeStart\)clearGhostStroke\(\)/,'preview cleared once 3D texture is ready');
assert.match(html,/id="strokeOverlay"/,'overlay exists in HTML');
assert.ok(!code.includes('out.drawImage(strokeOverlay'),'temporary overlay never appears in skin export');
console.log('PASS: immediate paint overlay draws and clears; 3D texture drives clearing; export remains separate.');

