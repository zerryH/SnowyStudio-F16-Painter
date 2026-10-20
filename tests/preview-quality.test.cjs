'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const start=source.indexOf('const renderProfiles='),end=source.indexOf('function message(',start);
assert.ok(start>0&&end>start);
const canvases=[],btn={},info={};
const ctx={Math,Set,Map,W:4096,TILE:256,state:{quality:'fast',dirtyTex:false,needsRender:false},
 dirtyTiles:new Set(),patchCanvas:{width:0,height:0},requestView(){},
 $:id=>id==='previewQualityBtn'?btn:id==='perfModeText'?info:null,
 document:{createElement(tag){
  assert.equal(tag,'canvas');let el={width:0,height:0,getContext(){return {}}};canvases.push(el);return el;
 }}};
vm.createContext(ctx);
vm.runInContext(source.slice(start,end),ctx);
function check(mode,expected){
 vm.runInContext('setPreviewQuality('+JSON.stringify(mode)+')',ctx);
 assert.equal(vm.runInContext('previewSize',ctx),expected,'selected WebGL texture size');
 assert.equal(vm.runInContext('patchCanvas.width',ctx),expected/16,'tile patch size');
 assert.equal(ctx.state.dirtyTex,true,'full preview rebuilt after quality switch');
 assert.equal(vm.runInContext('textureFull',ctx),true);
 assert.match(info.textContent,/4K export/,'original output resolution maintained');
}
check('fast',1024);check('balanced',2048);check('detail',4096);
assert.match(source,/preserveDrawingBuffer:false/);
assert.match(source,/antialias:false/);
assert.match(source,/maxPixels:850000/);
console.log('PASS: Fast/Balanced/Detail GPU texture sizes, correct scaled patches, full 4K export, MSAA/framebuffer disabled.');

