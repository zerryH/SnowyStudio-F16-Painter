'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const a=src.indexOf('function shapeBounds('),b=src.indexOf('function stampDecal(hit)',a);
assert(a>0&&b>a);
const ops=[],tiles=new Set();
const canvas=new Proxy({},{
 set(o,k,v){o[k]=v;return true;},
 get(o,k){
  if(['save','restore','beginPath','stroke','fill','lineTo','moveTo','rect','ellipse'].includes(k))
   return (...args)=>ops.push({name:k,args});
  return o[k];
 }});
const state={tool:'line',shapeFilled:false,opacity:1,color:'#22aaff',colorAlpha:.7,size:.2};
const context=vm.createContext({Math,TAU:Math.PI*2,state,TILE:256,GRID:16,paint:canvas,Set,
 shapeTools:new Set(['line','rectangle','ellipse','square','circle']),
 uvDabGeometry:hit=>({x:hit.x,y:hit.y,radius:4}),
 markPaintRect:(x,y,r)=>tiles.add(Math.floor(x/256)+16*Math.floor(y/256)),
 markTile:i=>tiles.add(i)});
vm.runInContext(src.slice(a,b),context);
const start={x:105,y:125},end={x:800,y:700};
function draw(tool,filled=false,shift=false){
 state.tool=tool;state.shapeFilled=filled;ops.length=0;tiles.clear();
 assert.equal(context.paintShape(start,end,shift),true);
 return {paths:ops.map(o=>o.name),count:tiles.size,shape:ops.find(o=>['ellipse','rect'].includes(o.name))};
}
const line=draw('line');
assert.ok(line.paths.includes('lineTo'),'draws straight line');
assert.ok(line.count<30,'line captures only narrow affected tiles, not full bbox');
const rect=draw('rectangle');
assert.ok(rect.paths.includes('rect'));
assert.ok(rect.count<40,'hollow rectangle does not snapshot its interior');
const ell=draw('ellipse');assert.ok(ell.paths.includes('ellipse'));
const filled=draw('rectangle',true);assert.ok(filled.paths.includes('fill'));assert.ok(filled.count>rect.count,'filled rectangle captures interior');
const square=draw('rectangle',false,true);
assert.equal(square.shape.args[2],square.shape.args[3],'Shift constrains rectangle to square');
const circle=draw('ellipse',false,true);
assert.equal(circle.shape.args[2],circle.shape.args[3],'Shift constrains ellipse to circle');
const realSquare=draw('square');assert.equal(realSquare.shape.args[2],realSquare.shape.args[3],'dedicated Square is constrained');
const realCircle=draw('circle');assert.equal(realCircle.shape.args[2],realCircle.shape.args[3],'dedicated Circle is constrained');
assert.equal(context.paintShape(null,end,false),false,'do not draw without initial hit');
assert.match(src,/if\(ev&&ev\.type==='pointerup'\)/,'shape committed only on pointerup');
assert.match(src,/if\(state\.shapeStart\)\{state\.shapeCurrent=p;ghostShape/,'shape preview during drag');
for(const tool of ['brush','spray','mountain','erase','line','rectangle','ellipse','square','circle'])assert.ok(html.includes('data-paint-tool="'+tool+'"'));
console.log('PASS: line, rectangle, ellipse, constrained square/circle, fill vs outline, optimized tile capture, tool presence.');

