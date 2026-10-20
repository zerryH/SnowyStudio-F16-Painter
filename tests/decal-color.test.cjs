'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
function cut(a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return src.slice(i,j);}
const glCalls=[],ui={selectedDecalArt:{src:''},selectedDecalName:{textContent:''},decalHint:{textContent:''}};
const canvasContexts=[];
class Canvas{
 constructor(){this.width=0;this.height=0;this.ops=[];}
 getContext(){const c={drawImage:(...args)=>this.ops.push(['drawImage',...args]),fillRect:(...args)=>this.ops.push(['fillRect',...args]),globalCompositeOperation:'source-over',fillStyle:''};canvasContexts.push(c);return c;}
 toDataURL(){return 'data:image/png;base64,tinted';}
}
const original={naturalWidth:1200,naturalHeight:600,src:'blob:original'};
const state={color:'#ff2050',image:original,decalTint:false,decalRenderSource:null};
const ctx=vm.createContext({state,HTMLCanvasElement:Canvas,document:{createElement(t){assert.equal(t,'canvas');return new Canvas();}},
 gl:{TEXTURE1:1,TEXTURE0:0,TEXTURE_2D:2,UNPACK_FLIP_Y_WEBGL:3,RGBA:4,UNSIGNED_BYTE:5,
 activeTexture(){},bindTexture(){},pixelStorei(){},texImage2D(...args){glCalls.push(args);}},
 decalTex:{},$:id=>ui[id],Math,console,requestView(){}});
vm.runInContext(cut('let decalTintDelay=','function decalPreviewUniforms()'),ctx);
ctx.updateDecalRender();
assert.equal(state.decalRenderSource,original,'original uploaded decal should remain unchanged when tint is off');
assert.equal(ui.selectedDecalArt.src,original.src);
state.decalTint=true;
ctx.updateDecalRender();
assert.ok(state.decalRenderSource instanceof Canvas,'tinted decal is a new intermediate canvas');
assert.equal(state.decalRenderSource.width,1024,'resize large tinted graphics to prevent huge GPU uploads');
assert.equal(state.decalRenderSource.height,512);
assert.equal(ui.selectedDecalArt.src,'data:image/png;base64,tinted');
assert.deepEqual(state.decalRenderSource.ops.map(x=>x[0]),['drawImage','fillRect'],'source image and tint composited');
assert.equal(canvasContexts.at(-1).globalCompositeOperation,'source-over','context reset');
assert.equal(glCalls.at(-1).at(-1),state.decalRenderSource,'GPU preview receives tinted source');
assert.match(src,/paint\.drawImage\(state\.decalRenderSource\|\|state\.image/,'stamp uses the same preview source');
assert.match(src,/paint\.globalAlpha=state\.decalOpacity/,'independent decal opacity');
console.log('PASS: original decals unmodified, transparent tint rendered separately, preview and stamping use same image, independent opacity.');

