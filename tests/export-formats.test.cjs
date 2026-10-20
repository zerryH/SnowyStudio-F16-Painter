'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../app.js','utf8');
function cut(a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return src.slice(i,j);}
const ctx=vm.createContext({W:4096,H:4096,Uint8Array,Math,console});
vm.runInContext(cut('function tgaRGBA(','async function exportSkin()'),ctx);
const img={data:new Uint8Array([255,0,0,120,0,255,0,130,0,0,255,210,255,255,255,230])}; // top red/green, bottom blue/white
const encoded=ctx.tgaRGBA(img,null,2,2);
assert.equal(encoded.length,34);
assert.equal(encoded[2],2);assert.equal(encoded[12],2);assert.equal(encoded[14],2);assert.equal(encoded[16],32);
assert.deepEqual(Array.from(encoded.slice(18,22)),[255,0,0,210],'TGA bottom row first pixel B,G,R,A');
const hdr=new Uint8Array(18);hdr[2]=2;hdr[12]=2;hdr[14]=2;hdr[16]=32;
const box={exportNormalBtn:{},clearNormalBtn:{},normalFileName:{}};
const normalCtx=vm.createContext({$:id=>box[id],normalTGA:null,normalSourceName:'',Uint8Array,console,Math,makeDownload(){},message(){},tgaRGBA:ctx.tgaRGBA,URL:{},imageFrom(){}});
vm.runInContext(cut('let normalTGA=','function importBase(f)'),normalCtx);
const info=normalCtx.validateTGAHeader(hdr);
assert.equal(info.width,2);assert.equal(info.height,2);
const rle=new Uint8Array(hdr);rle[2]=10;assert.equal(normalCtx.validateTGAHeader(rle).depth,32);
const invalid=new Uint8Array(hdr);invalid[16]=16;assert.throws(()=>normalCtx.validateTGAHeader(invalid));
const a=src.indexOf(' const blk=[',src.indexOf('async function exportSkin()'));
const b=src.indexOf(' const readme=',a);
assert(a>=0&&b>a);
const expr=src.slice(a,b)+'\nthis.generated=blk;';
function blk(normalTGA){
 const sandbox=vm.createContext({normalTGA});
 vm.runInContext(expr,sandbox);return sandbox.generated;
}
let plain=blk(null);
assert.match(plain,/from:t="f_16a_block_20_mlu_c\*"/);
assert.doesNotMatch(plain,/_n\*/,'no dangling missing normal map ref');
let full=blk(hdr);
assert.match(full,/from:t="f_16a_block_20_mlu_n\*"/);
assert.match(full,/to:t="f_16a_block_20_mlu_n\.tga"/);
assert.ok(full.includes('\nreplace_tex{'),'valid BLK newlines');
assert.match(src,/if\(normalTGA\)files\.push/,'ZIP only includes normal file when provided');
console.log('PASS: TGA channel ordering, alpha, dimensions, normal TGA validation and optional matching BLK/ZIP rules.');

