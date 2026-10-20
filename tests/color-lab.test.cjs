'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function cut(a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert(i>=0&&j>i,'missing '+a);return src.slice(i,j);}
const state={color:'#101820',colorAlpha:1,decalTint:false,camoTint:false},ctx=vm.createContext({state,Math,TAU:Math.PI*2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),console,setTimeout:()=>1,clearTimeout(){}});
vm.runInContext(cut('let lastPickerHue=','const styleTitles='),ctx);
for(const hex of ['#ff0000','#00ff00','#0000ff','#7f7f7f','#101820']){
 const rgb=hex.match(/[0-9a-f]{2}/g).map(x=>parseInt(x,16));
 const hsv=ctx.rgbToHsv(rgb);
 const result=ctx.hsvToRgb(hsv.h,hsv.s,hsv.v);
 assert.deepEqual(Array.from(result),rgb,'RGB -> HSV -> RGB for '+hex);
 assert.equal(ctx.rgbHex(result),hex);
}
ctx.updateColorDependents=()=>{};
ctx.setGlobalColor('#FFAA05',.57);
assert.equal(state.color,'#ffaa05');
assert.equal(state.colorAlpha,.57);
ctx.setGlobalColor('wrong',.25);
assert.equal(state.color,'#ffaa05','invalid input ignored');
assert.equal(state.colorAlpha,.57);
for(const id of ['colorEditor','svPicker','rgbR','rgbG','rgbB','rgbA','rgbRNum','rgbGNum','rgbBNum','rgbANum','hueSlide','colorHexInput','colorEditorDone','globalColorBtn','decalTint','camoTint','decalOpacity','exportPngBtn','exportTgaBtn','normalInput','exportNormalBtn'])
 assert.ok(html.includes('id="'+id+'"'),'missing color/export control '+id);
assert.equal((html.match(/id="colorEditor"/g)||[]).length,1);
console.log('PASS: RGB/HSV round trips, HEX, alpha, invalid HEX protection, and complete precision-color UI.');

