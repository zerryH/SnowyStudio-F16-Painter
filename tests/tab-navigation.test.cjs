'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const panes=['paint','decals','camo','layers'];
const makeEl=(dataset={})=>{
 const classes=new Set();
 return {dataset,hidden:false,tabIndex:0,attrs:{},listeners:{},classList:{
  toggle(c,on){if(on)classes.add(c);else classes.delete(c);},
  contains(c){return classes.has(c)}
 },setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},click(){this.listeners.click?.();}};
};
const sections=panes.map(p=>makeEl({pane:p}));
const tabs=panes.map(p=>makeEl({paneTarget:p}));
const tools=['brush','spray','mountain','decal','erase','orbit'].map(t=>makeEl({tool:t}));
const palette=['brush','spray','mountain','erase','line','rectangle','ellipse','square','circle'].map(t=>makeEl({paintTool:t}));
const config=['brush','spray','mountain','erase','rectangle ellipse square circle','line'].map(t=>makeEl({toolConfig:t}));
const map={'toolHeading':{textContent:''},'toolSubtitle':{textContent:''},'brushHUD':{textContent:''},'shapeFilled':makeEl()};
const document={
 querySelectorAll(s){
  if(s==='.panel.left > .section[data-pane]')return sections;
  if(s==='[data-tool-config]')return config;
  if(s==='[data-paint-tool]')return palette;
  if(s==='.sidebar-tab')return tabs;
  if(s==='.rail-button[data-tool]')return tools;
  throw Error('Unexpected selector: '+s);
 }
};
const state={tool:'brush',pane:'paint',lastPaintTool:'brush',size:.24,decalSize:1.4,previewHit:null,previewInside:false};
const styleTitles={brush:['Paintbrush','Draw'],spray:['Spray','Draw'],mountain:['Mountain','Draw'],decal:['Decals','Preview'],erase:['Eraser','Erase'],line:['Line','Draw'],rectangle:['Rectangle','Draw'],ellipse:['Ellipse','Draw'],square:['Square','Draw'],circle:['Circle','Draw'],orbit:['Camera','Orbit']};
const context=vm.createContext({state,styleTitles,document,$:id=>map[id],view:{style:{}},clearGhostStroke(){},requestView(){}});
function extract(startMarker,endMarker){
 const start=source.indexOf(startMarker);assert.ok(start!==-1, 'missing '+startMarker);
 const end=source.indexOf(endMarker,start+startMarker.length);assert.ok(end!==-1,'missing '+endMarker);
 return source.slice(start,end);
}
vm.runInContext(extract('const paintTools=','function selectCamo('),context);
vm.runInContext(extract(" for(const e of document.querySelectorAll('.sidebar-tab'))e.addEventListener",' const drawer='),context);
vm.runInContext(extract(" for(const b of document.querySelectorAll('.rail-button[data-tool]'))b.addEventListener",' for(const b of document.querySelectorAll(\'.segbtn\'))'),context);
function expect(pane,tool){
 assert.equal(state.pane,pane,'pane selected');
 assert.equal(state.tool,tool,'active tool');
 assert.equal(sections.filter(x=>!x.hidden).length,1,'exactly one visible panel');
 assert.equal(sections.find(x=>!x.hidden).dataset.pane,pane,'visible panel matches pane');
 assert.equal(tabs.filter(x=>x.classList.contains('active')).length,1,'one selected sidebar tab');
 assert.equal(tabs.find(x=>x.classList.contains('active')).dataset.paneTarget,pane,'sidebar tab matches pane');
 const rail=tools.find(x=>x.classList.contains('active'));
 if(['line','rectangle','ellipse','square','circle'].includes(tool))assert.equal(rail,undefined,'shape does not falsely select rail');
 else assert.equal(rail?.dataset.tool,tool,'rail matches tool');
 const choice=palette.find(x=>x.classList.contains('active'));
 if(pane==='paint'&&['brush','spray','mountain','erase','line','rectangle','ellipse','square','circle'].includes(tool))
  assert.equal(choice?.dataset.paintTool,tool,'paint tool grid matches active tool');
 if(pane!=='paint'||tool==='orbit')assert.equal(choice,undefined,'no stale palette highlight');
 for(const el of config){
  assert.equal(el.hidden,!el.dataset.toolConfig.split(' ').includes(tool),'tool-specific controls are gated');
 }
 for(const s of sections)assert.equal(s.attrs['aria-hidden'],String(s.dataset.pane!==pane),'aria hidden synchronized');
}
tabs[1].click();expect('decals','decal');
tabs[2].click();expect('camo','orbit');
tabs[3].click();expect('layers','orbit');
tabs[0].click();expect('paint','brush');
tools[2].click();expect('paint','mountain');
tabs[1].click();expect('decals','decal');
tabs[0].click();expect('paint','mountain');
tools[4].click();expect('paint','erase');
tools[3].click();expect('decals','decal');
tabs[2].click();expect('camo','orbit');
vm.runInContext("setTool('decal')",context);expect('decals','decal');
vm.runInContext("setTool('orbit')",context);expect('paint','orbit');
vm.runInContext("setTool('brush')",context);expect('paint','brush');
for(const p of panes){
 assert.match(html,new RegExp('role="tab"[^>]+data-pane-target="'+p+'"'),'tab semantics '+p);
 assert.match(html,new RegExp('role="tabpanel"[^>]+data-pane="'+p+'"'),'panel semantics '+p);
}
assert.ok(html.includes('.panel.left>.section[hidden]{display:none!important}'),'strictly hide inactive panels');
console.log('PASS: sidebar tabs, rail tools, hidden panel gating, navigation mode, keyboard targets and ARIA state');

// Clicking each visible choice must update rail, panel, tool settings and tool state.
for(const target of ['spray','mountain','line','rectangle','ellipse','square','circle','erase','brush']){
 palette.find(x=>x.dataset.paintTool===target).click();expect('paint',target);
 tabs[1].click();expect('decals','decal');
 tabs[0].click();expect('paint',target);
}
// Shape controls cannot leak into Decals, Camo, or Layers.
palette.find(x=>x.dataset.paintTool==='rectangle').click();expect('paint','rectangle');
tabs[2].click();expect('camo','orbit');
tabs[3].click();expect('layers','orbit');
tabs[0].click();expect('paint','rectangle');
console.log('PASS: shape toolbar, 9 paint-tool gates, and roundtrips across every editor pane.');
