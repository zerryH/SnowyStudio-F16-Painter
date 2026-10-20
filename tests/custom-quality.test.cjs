'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const start=source.indexOf('const renderProfiles='),end=source.indexOf('function message(',start);
assert.ok(start>=0&&end>start);
class El{
 constructor(dataset={}){this.dataset=dataset;this.listeners={};this.hidden=false;this.textContent='';this.value='';this.attrs={};this.classList={toggle(){}};}
 addEventListener(k,fn){this.listeners[k]=fn;}
 click(){this.listeners.click?.({target:this});}
 input(value){this.value=String(value);this.listeners.input?.({target:this});}
 focus(){this.focused=true;}
 setAttribute(k,v){this.attrs[k]=v;}
}
const els={};
const get=id=>(els[id]??=new El());
const options=['fast','balanced','detail','custom'].map(quality=>new El({quality}));
get('qualitySettings').hidden=true;
get('customQualityPanel').hidden=true;
const memory=new Map();
const ctx=vm.createContext({Math,Set,Map,W:4096,TILE:256,state:{quality:'fast',dirtyTex:false,needsRender:false},
 dirtyTiles:new Set(),patchCanvas:{width:0,height:0},requestView(){},
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
 $:get,
 document:{querySelectorAll(s){return s==='.quality-option'?options:[]},createElement(){return{width:0,height:0,getContext(){return{}}};}}});
vm.runInContext(source.slice(start,end),ctx);
ctx.setupQualityControls();
assert.equal(ctx.state.quality,'fast');
assert.equal(typeof get('previewQualityBtn').listeners.click==='function',true,'top button opens dialog');
get('qualityOpen').click();
assert.equal(get('qualitySettings').hidden,false,'settings available from viewport');
options[3].click();
assert.equal(ctx.state.quality,'custom');
assert.equal(get('customQualityPanel').hidden,false,'custom controls visible');
assert.equal(options.filter(o=>o.attrs['aria-pressed']==='true').length,1);
get('customTexture').input(512);get('customPixels').input(450000);get('customPaintFps').input(75);
get('customOrbitFps').input(85);get('customDpr').input(1.8);
let profile=vm.runInContext('renderProfiles.custom',ctx);
assert.equal(profile.textureSize,512);
assert.equal(profile.maxPixels,450000);
assert.equal(profile.paintFps,75);
assert.equal(profile.orbitFps,85);
assert.equal(profile.maxDpr,1.8);
assert.equal(vm.runInContext('previewSize',ctx),512,'GPU preview changes resolution');
assert.match(get('qualitySummary').textContent,/75 paint FPS/);
assert.ok(memory.has('SnowyStudio_quality'),'custom settings saved');
assert.equal(memory.get('SnowyStudio_quality_mode'),'custom','mode saved');
get('qualityDone').click();assert.equal(get('qualitySettings').hidden,true);
options[2].click();assert.equal(ctx.state.quality,'detail');
options[3].click();assert.equal(vm.runInContext('previewSize',ctx),512,'custom settings survive preset changes');
get('previewQualityBtn').click();assert.equal(get('qualitySettings').hidden,false);
get('qualityClose').click();assert.equal(get('qualitySettings').hidden,true);
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
for(const id of ['qualityOpen','qualitySettings','customTexture','customPixels','customPaintFps','customOrbitFps','customDpr'])
 assert.ok(html.includes('id="'+id+'"'),'missing quality UI control '+id);
console.log('PASS: custom renderer settings, 4 presets, responsive entry point, live preview resizing and preference persistence.');

