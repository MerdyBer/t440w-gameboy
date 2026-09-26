"use strict";
/* TCL T440W KaiOS 4 GB/GBC wrapper v0.7 - GitHub Pages ready */
(function(){
var PROD_STARTUP_MS=10000;
var TEST_MODE=/[?&]test=1(?:&|$)/.test(location.search);
var STARTUP_MS=TEST_MODE?120:PROD_STARTUP_MS;
var settings=[
 true,                    // 0 sound enabled
 false,                   // 1 skip boot ROM
 false,                   // 2 prefer GB mode
 [39,37,38,40,88,90,16,13], // 3 legacy keyboard map expected by core
 true,                    // 4 colorize original GB games
 false,                   // 5 allow typed arrays
 4,                       // 6 emulator loop interval in ms
 15,                      // 7 audio buffer minimum
 30,                      // 8 audio buffer maximum
 false,                   // 9 MBC1 override
 false,                   // 10 RAM override
 false,                   // 11 use GB boot ROM
 false,                   // 12 browser scales canvas
 0x10,                    // 13 audio pre-interpolation factor
 1                        // 14 volume
];
// GameBoy-Online is a classic script and reads these as globals.
window.settings=settings;
window.GameBoyWindow=window;
 var t440wAudioContexts=[];
window.__T440WAudioContexts=t440wAudioContexts;

(function(){
  var NativeAC=window.AudioContext||window.webkitAudioContext;
  if(!NativeAC)return;

  if(!NativeAC.prototype.createJavaScriptNode &&
     NativeAC.prototype.createScriptProcessor){
    NativeAC.prototype.createJavaScriptNode=
      NativeAC.prototype.createScriptProcessor;
  }

  var sourceProto=
    window.AudioBufferSourceNode &&
    window.AudioBufferSourceNode.prototype;

  if(sourceProto && !sourceProto.noteOn && sourceProto.start){
    sourceProto.noteOn=sourceProto.start;
  }

  window.GameBoyAudioContext=function(){
    var ctx=new NativeAC();
    t440wAudioContexts.push(ctx);
    return ctx;
  };
})();
 // Compatibility layer for the old GameBoy-Online audio engine.
(function(){
  try{
    if(!window.AudioContext && window.webkitAudioContext){
      window.AudioContext=window.webkitAudioContext;
    }

    var AC=window.AudioContext;
    if(AC && AC.prototype &&
       !AC.prototype.createJavaScriptNode &&
       AC.prototype.createScriptProcessor){
      AC.prototype.createJavaScriptNode=AC.prototype.createScriptProcessor;
    }

    var sourceProto=window.AudioBufferSourceNode &&
                    window.AudioBufferSourceNode.prototype;

    if(sourceProto && !sourceProto.noteOn && sourceProto.start){
      sourceProto.noteOn=sourceProto.start;
    }
  }catch(e){}
})();
var canvas=document.getElementById("mainCanvas"), statusEl=document.getElementById("status"), overlay=document.getElementById("overlay"), panel=document.getElementById("panel"), startup=document.getElementById("startup"), countdown=document.getElementById("countdown"), startupFooter=document.getElementById("startupFooter"), startupLoad=document.getElementById("startupLoad"), fileInput=document.getElementById("romFile");
var gameboy=null,gbRunInterval=null,currentRomBytes=null,currentRomId="",currentRomName="",muted=false,ffHeld=false,resetTimer=null,pressed=Object.create(null),overlayMode=null,selection=0,coreReady=false,coreFailed=false,startupDone=false,deviceRoms=[],deviceScanBusy=false,coreMode="loading",coreError="";
var batteryCache={};

function cout(msg,level){if(level>=1&&window.console)console.log("T440W GB:",msg);} window.cout=cout;
function status(msg,ms){statusEl.textContent=msg||"";clearTimeout(status._t);if(ms)status._t=setTimeout(function(){statusEl.textContent="";},ms);}
function unlockAudio(){
  var list=window.__T440WAudioContexts||[];

  for(var i=0;i<list.length;i++){
    try{
      if(list[i] &&
         typeof list[i].resume==="function" &&
         list[i].state!=="running"){
        list[i].resume();
      }
    }catch(e){}
  }

  try{
    if(window.audioContextHandle &&
       typeof window.audioContextHandle.resume==="function" &&
       window.audioContextHandle.state==="suspended"){
      window.audioContextHandle.resume();
    }
  }catch(e){}

  try{
    var h=gameboy&&gameboy.audioHandle;
    if(h&&h.audioContext&&
       typeof h.audioContext.resume==="function" &&
       h.audioContext.state==="suspended"){
      h.audioContext.resume();
    }
  }catch(e){}
}
function initNewCanvas(){canvas.width=160;canvas.height=144;} window.initNewCanvas=initNewCanvas; window.initNewCanvasSize=initNewCanvas;
function pause(){if(gameboy)gameboy.stopEmulator|=2;if(gbRunInterval){clearInterval(gbRunInterval);gbRunInterval=null;}}
function binaryString(bytes){var out="",chunk=0x4000;for(var i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));return out;}
function b64ToBytes(s){var bin=atob(s),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}
function bytesToB64(a){var u=a instanceof Uint8Array?a:new Uint8Array(a),s="",chunk=0x4000;for(var i=0;i<u.length;i+=chunk)s+=String.fromCharCode.apply(null,u.subarray(i,Math.min(i+chunk,u.length)));return btoa(s);}
function safeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){status("Storage unavailable",1200);return false;}}
function safeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function fnv1a(bytes){var h=0x811c9dc5;for(var i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,"0");}
function romTitle(bytes){var s="";for(var i=0x134;i<=0x143&&i<bytes.length;i++){var c=bytes[i];if(!c)break;if(c>=32&&c<127)s+=String.fromCharCode(c);}return s.trim()||"Untitled ROM";}
function validRomName(name){return /\.(gb|gbc)$/i.test(name||"");}
function validateRom(bytes,name){if(!bytes||bytes.length<0x150)return "File is too small to be a Game Boy ROM";if(name&&!validRomName(name))return "Choose a .gb or .gbc file";var cart=bytes[0x147];if(cart===undefined)return "Invalid ROM header";return "";}
function romIdentity(bytes,name){return fnv1a(bytes)+"-"+bytes.length.toString(16)+"-"+(name||"rom").replace(/[^a-z0-9._-]+/gi,"_").slice(-48);}
function storageKey(kind,id){return "T440W_"+kind+"_"+id;}
function openSRAM(){var r=batteryCache[currentRomId];return r&&r.sram?r.sram.slice():[];}
function openRTC(){var r=batteryCache[currentRomId];return r&&r.rtc?r.rtc.slice?r.rtc.slice():r.rtc:[];}
function preloadBattery(id){var s=safeGet(storageKey("SRAM",id)),r=safeGet(storageKey("RTC",id));batteryCache[id]={sram:[],rtc:[]};try{if(s)batteryCache[id].sram=Array.prototype.slice.call(b64ToBytes(s));}catch(e){}try{if(r)batteryCache[id].rtc=JSON.parse(r)||[];}catch(e){}}
function saveBattery(){if(!gameboy||!currentRomId)return;try{var rec=batteryCache[currentRomId]||(batteryCache[currentRomId]={sram:[],rtc:[]});if(gameboy.cBATT&&typeof gameboy.saveSRAMState==="function"){var s=gameboy.saveSRAMState();if(s&&s.length){rec.sram=Array.prototype.slice.call(s);safeSet(storageKey("SRAM",currentRomId),bytesToB64(new Uint8Array(s)));}}if(gameboy.cTIMER&&typeof gameboy.saveRTCState==="function"){var rtc=gameboy.saveRTCState();rec.rtc=rtc;safeSet(storageKey("RTC",currentRomId),JSON.stringify(rtc));}}catch(e){cout("battery save: "+e.message,1);}}
function attachPersistence(g){g.openMBC=openSRAM;g.openRTC=openRTC;}
function runLoop(){
 if(gbRunInterval)clearInterval(gbRunInterval);
 if(!gameboy)return;
 gameboy.stopEmulator&=1;
 gbRunInterval=setInterval(function(){
   if(document.hidden||!gameboy)return;
   // GameBoy-Online has no setSpeed() API. Fast-forward is implemented by
   // executing three normal core slices per wall-clock interval.
   var bursts=ffHeld?3:1;
   for(var i=0;i<bursts;i++)gameboy.run();
 },settings[6]);
}

function idbOpen(){return new Promise(function(resolve,reject){if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return;}var req=indexedDB.open("T440W_GB",1);req.onupgradeneeded=function(){var db=req.result;if(!db.objectStoreNames.contains("states"))db.createObjectStore("states");};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error("IndexedDB open failed"));};});}
function statePut(id,val){return idbOpen().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction("states","readwrite");tx.objectStore("states").put(val,id);tx.oncomplete=function(){db.close();resolve();};tx.onerror=function(){db.close();reject(tx.error);};});});}
function stateGet(id){return idbOpen().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction("states","readonly"),req=tx.objectStore("states").get(id);req.onsuccess=function(){db.close();resolve(req.result);};req.onerror=function(){db.close();reject(req.error);};});});}

function startRom(bytes,name){bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);var err=validateRom(bytes,name);if(err){status(err,2400);return false;}if(!coreReady){status(coreFailed?"Emulator core unavailable":"Emulator still loading",1800);return false;}saveBattery();pause();currentRomBytes=new Uint8Array(bytes);currentRomName=name||romTitle(bytes);currentRomId=romIdentity(bytes,currentRomName);preloadBattery(currentRomId);safeSet("T440W_LAST_ROM_NAME",currentRomName);try{gameboy=new GameBoyCore(canvas,binaryString(currentRomBytes));attachPersistence(gameboy);gameboy.start();if(muted&&gameboy.audioHandle&&typeof gameboy.audioHandle.changeVolume==="function")gameboy.audioHandle.changeVolume(0);runLoop();closeOverlay();status(romTitle(bytes),1400);return true;}catch(e){console.error(e);status("ROM error: "+e.message,3000);return false;}}
function resetGame(){if(currentRomBytes){status("Reset",600);startRom(currentRomBytes,currentRomName);}}
function saveStateSlot(){if(!gameboy||!currentRomId){status("No game running",900);return;}try{var st=gameboy.saveState();statePut(currentRomId,st).then(function(){status("State saved",900);},function(){try{var ok=safeSet(storageKey("STATE",currentRomId),JSON.stringify(st));status(ok?"State saved":"State save failed",ok?900:1500);}catch(e){status("State save failed",1500);}});}catch(e){status("Save state failed",1100);}}
function loadStateSlot(){if(!currentRomId){status("No game running",900);return;}function restore(st){if(!st){status("No saved state",900);return;}try{pause();gameboy=new GameBoyCore(canvas,"");attachPersistence(gameboy);gameboy.returnFromState(st);runLoop();status("State loaded",900);}catch(e){console.error(e);status("Load state failed",1200);}}stateGet(currentRomId).then(restore,function(){var raw=safeGet(storageKey("STATE",currentRomId));try{restore(raw?JSON.parse(raw):null);}catch(e){restore(null);}});}
function setFast(on){if(!gameboy)return;ffHeld=!!on;status(on?"Fast-forward 3×":"",on?0:250);}
function toggleMute(){muted=!muted;if(gameboy){try{if(gameboy.audioHandle&&typeof gameboy.audioHandle.changeVolume==="function")gameboy.audioHandle.changeVolume(muted?0:settings[14]);}catch(e){}}status(muted?"Muted":"Sound on",700);}
function toggleFullscreen(){var el=document.documentElement,req=el.requestFullscreen||el.mozRequestFullScreen||el.webkitRequestFullscreen;var full=document.fullscreenElement||document.mozFullScreenElement||document.webkitFullscreenElement;if(!full&&req){try{var p=req.call(el);if(p&&p.catch)p.catch(function(){document.body.classList.toggle("immersive");});}catch(e){document.body.classList.toggle("immersive");}}else{var ex=document.exitFullscreen||document.mozCancelFullScreen||document.webkitExitFullscreen;if(ex){try{ex.call(document);}catch(e){}}else document.body.classList.toggle("immersive");}status("Fullscreen",450);}

function chooseFile(){closeOverlay();setTimeout(function(){try{fileInput.value="";fileInput.click();}catch(e){status("File picker unavailable",1600);}},0);}
function loadFile(file){if(!file)return;var errName=validRomName(file.name)?"":"Choose a .gb or .gbc file";if(errName){status(errName,1800);return;}var reader=new FileReader();reader.onerror=function(){status("Could not read ROM",1600);};reader.onload=function(){var bytes=new Uint8Array(reader.result),err=validateRom(bytes,file.name);if(err){status(err,2000);return;}startRom(bytes,file.name);};reader.readAsArrayBuffer(file);}
fileInput.addEventListener("change",function(){if(fileInput.files&&fileInput.files[0])loadFile(fileInput.files[0]);});

function hasDeviceStorage(){return typeof navigator.getDeviceStorage==="function";}
function scanDeviceStorage(){if(!hasDeviceStorage()){status("Use Choose ROM file on this build",1800);return;}if(deviceScanBusy)return;deviceScanBusy=true;deviceRoms=[];openOverlay("scan");renderOverlay();try{var store=navigator.getDeviceStorage("sdcard"),cursor=store.enumerate();cursor.onsuccess=function(){var f=this.result;if(f){if(f.name&&validRomName(f.name))deviceRoms.push(f);this.continue();}else{deviceScanBusy=false;openOverlay("device");}};cursor.onerror=function(){deviceScanBusy=false;status("Storage access denied",1800);openOverlay("games");};}catch(e){deviceScanBusy=false;status("Storage browser unavailable",1800);openOverlay("games");}}
function loadDeviceFile(index){var f=deviceRoms[index];if(!f)return;loadFile(f);}

var joy={ArrowRight:0,ArrowLeft:1,ArrowUp:2,ArrowDown:3,SoftRight:4,SoftLeft:5,"1":6,"2":7};
function joyDown(k){if(gameboy&&joy[k]!==undefined)gameboy.JoyPadEvent(joy[k],true);}
function joyUp(k){if(gameboy&&joy[k]!==undefined)gameboy.JoyPadEvent(joy[k],false);}
function normalizeKey(k){
  if(k==="Multiply"||k==="NumpadMultiply")return "*";
  if(k==="z"||k==="Z")return "SoftLeft";
  if(k==="x"||k==="X")return "SoftRight";
  return k;
}

function menuRows(mode){
 if(mode==="games"){var g=["Choose ROM file"];if(hasDeviceStorage())g.push("Browse phone storage");if(currentRomBytes)g.push("Resume: "+currentRomName);return g;}
 if(mode==="device"){var a=deviceRoms.map(function(f){return f.name.split("/").pop();});if(!a.length)a=["No .gb/.gbc files found","Back"];else a.push("Back");return a;}
 if(mode==="scan")return ["Scanning storage…"];
 return ["Resume","Game selection","Save state","Load state","Mute / unmute","Reset game","About"];
}
function renderOverlay(){var rows=menuRows(overlayMode),title=overlayMode==="games"?"Game Selection":overlayMode==="device"?"ROMs on Phone":overlayMode==="scan"?"Game Selection":"Emulator Menu";if(selection>=rows.length)selection=0;var html="<h1>"+title+"</h1>";for(var i=0;i<rows.length;i++)html+='<div class="row '+(i===selection?'selected':'')+'">'+escapeHtml(rows[i])+"</div>";if(overlayMode==="games")html+='<div class="meta">Pick any .gb or .gbc file from Downloads or another folder.</div>';html+='<div class="hint">↑↓ choose · OK select · * back</div>';panel.innerHTML=html;}
function escapeHtml(s){return String(s).replace(/[&<>\"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function openOverlay(mode){overlayMode=mode;selection=0;overlay.classList.remove("hidden");renderOverlay();}
function closeOverlay(){overlayMode=null;overlay.classList.add("hidden");}
function overlayActivate(){unlockAudio();var rows=menuRows(overlayMode),r=rows[selection];if(overlayMode==="scan")return;if(overlayMode==="games"){if(r==="Choose ROM file")chooseFile();else if(r==="Browse phone storage")scanDeviceStorage();else closeOverlay();return;}if(overlayMode==="device"){if(r==="Back"||r==="No .gb/.gbc files found"){openOverlay("games");return;}loadDeviceFile(selection);return;}switch(r){case"Resume":closeOverlay();break;case"Game selection":openOverlay("games");break;case"Save state":saveStateSlot();closeOverlay();break;case"Load state":loadStateSlot();closeOverlay();break;case"Mute / unmute":toggleMute();renderOverlay();break;case"Reset game":closeOverlay();status("Hold 6 to reset during play",1200);break;case"About":closeOverlay();status("v0.7 · core: "+coreMode,1800);break;}}

function keydown(e){unlockAudio();var k=normalizeKey(e.key||"");var captured=(k in joy)||["3","4","6","7","8","9","*","Enter"].indexOf(k)>=0;if(captured){e.preventDefault();e.stopPropagation();}if(!startupDone)return;if(overlayMode){var rows=menuRows(overlayMode);if(k==="ArrowUp"){selection=(selection-1+rows.length)%rows.length;renderOverlay();}else if(k==="ArrowDown"){selection=(selection+1)%rows.length;renderOverlay();}else if(k==="Enter"||k==="SoftRight"){overlayActivate();}else if(k==="*"||k==="SoftLeft"){if(overlayMode==="device"||overlayMode==="scan")openOverlay("games");else closeOverlay();}return;}if(pressed[k])return;pressed[k]=true;if(k in joy){joyDown(k);return;}if(k==="3"){setFast(true);return;}if(k==="4"){toggleMute();return;}if(k==="6"){status("Hold 6 to reset",0);resetTimer=setTimeout(function(){resetTimer=null;resetGame();},700);return;}if(k==="7"){loadStateSlot();return;}if(k==="8"){openOverlay("games");return;}if(k==="9"){saveStateSlot();return;}if(k==="Enter"){toggleFullscreen();return;}if(k==="*"){openOverlay("menu");return;}}
function keyup(e){var k=normalizeKey(e.key||"");var captured=(k in joy)||["3","4","6","7","8","9","*","Enter"].indexOf(k)>=0;if(captured){e.preventDefault();e.stopPropagation();}pressed[k]=false;if(!startupDone)return;if(k in joy)joyUp(k);if(k==="3"&&ffHeld)setFast(false);if(k==="6"&&resetTimer){clearTimeout(resetTimer);resetTimer=null;if(statusEl.textContent.indexOf("Hold 6")===0)status("",50);}}
window.addEventListener("keydown",keydown,true);window.addEventListener("keyup",keyup,true);window.addEventListener("blur",function(){for(var k in pressed){if(pressed[k]&&k in joy)joyUp(k);pressed[k]=false;}if(ffHeld)setFast(false);});window.addEventListener("pagehide",saveBattery);document.addEventListener("visibilitychange",function(){if(document.hidden)saveBattery();});setInterval(saveBattery,15000);

function loadScript(src){return new Promise(function(resolve,reject){var s=document.createElement("script");s.src=src;s.onload=function(){resolve(src);};s.onerror=function(){s.remove();reject(new Error("Could not load "+src));};document.head.appendChild(s);});}
function loadSequence(files){var chain=Promise.resolve();files.forEach(function(src){chain=chain.then(function(){return loadScript(src);});});return chain;}
var CORE_COMPONENTS=["js/other/resampler.js","js/other/XAudioServer.js","js/GameBoyCore.js"];
var CORE_SOURCES=[
 {name:"local",base:"vendor/",local:true,map:function(path){return path.replace(/^js\/other\//,"").replace(/^js\//,"");}},
 {name:"jsDelivr",base:"https://cdn.jsdelivr.net/gh/taisel/GameBoy-Online@master/"},
 {name:"GitHub Pages",base:"https://taisel.github.io/GameBoy-Online/"}
];
var REMOTE_CORE_SETS=[
 CORE_COMPONENTS.map(function(path){return CORE_SOURCES[1].base+path;}),
 CORE_COMPONENTS.map(function(path){return CORE_SOURCES[2].base+path;})
];
var offlineCoreReady=false;
Promise.all(REMOTE_CORE_SETS.map(function(urls){return remoteCoreCached(urls);})).then(function(results){
 offlineCoreReady=results.some(function(ok){return ok;});
 if(offlineCoreReady&&startupLoad&&coreMode==="loading")setCoreStatus("Offline core cached");
});
function coreUrl(source,path){return source.local?source.base+source.map(path):source.base+path;}
function setCoreStatus(text){if(startupLoad)startupLoad.textContent=text;}
function cacheOneOpaqueSafe(cache,url){
 var req=new Request(url,{mode:"no-cors",cache:"no-store"});
 return fetch(req).then(function(res){if(!res)throw new Error("Empty core response");return cache.put(req,res.clone()).then(function(){return true;});}).catch(function(){
   return cache.add(req).then(function(){return true;}).catch(function(){return false;});
 });
}
function cacheUrls(urls){if(!window.caches)return Promise.resolve(false);return caches.open("t440w-gb-v0.7").then(function(c){return Promise.all(urls.map(function(url){return cacheOneOpaqueSafe(c,url);}));}).then(function(results){return results.every(Boolean);}).catch(function(){return false;});}
function remoteCoreCached(urls){if(!window.caches)return Promise.resolve(false);return Promise.all(urls.map(function(url){return caches.match(url).then(function(hit){return !!hit;}).catch(function(){return false;});})).then(function(a){return a.every(Boolean);});}
function tryCoreSource(source){var urls=CORE_COMPONENTS.map(function(path){return coreUrl(source,path);});setCoreStatus("Core: "+source.name+"…");return loadSequence(urls).then(function(){if(typeof GameBoyCore!=="function")throw new Error("Core constructor missing");coreMode=source.name;coreReady=true;if(!source.local){cacheUrls(urls).then(function(ok){if(ok){offlineCoreReady=true;status("Offline core cached",900);}});}return true;});}
function loadCore(){
 if(TEST_MODE){coreMode="mock";setCoreStatus("Core: test…");return loadScript("mock-core.js").then(function(){coreReady=typeof GameBoyCore==="function";if(!coreReady)throw new Error("Mock core constructor missing");});}
 var i=0,lastError=null;
 function next(){if(i>=CORE_SOURCES.length){throw lastError||new Error("No emulator core source available");}var source=CORE_SOURCES[i++];return tryCoreSource(source).catch(function(e){lastError=e;return next();});}
 return next();
}

function finishStartup(){if(startupDone)return;startupDone=true;startup.classList.add("hidden");if(coreReady){setCoreStatus("Core ready");status("Choose a ROM",1000);openOverlay("games");}else if(coreFailed){setCoreStatus("Core unavailable");status("Core unavailable. Connect to Wi-Fi and relaunch.",3000);openOverlay("games");}else{status("Finishing emulator load…");}}
function startupClock(){var started=Date.now();function tick(){var left=Math.max(0,Math.ceil((STARTUP_MS-(Date.now()-started))/1000));countdown.textContent=String(left);if(left<=0){finishStartup();return;}setTimeout(tick,100);}tick();}
loadCore().then(function(){coreReady=true;if(startupDone){status("Emulator ready",700);openOverlay("games");}}).catch(function(e){console.error(e);coreFailed=true;coreMode="unavailable";coreError=e&&e.message?e.message:String(e);setCoreStatus("Core unavailable");if(startupDone)status("Core unavailable. Connect to Wi-Fi and relaunch.",3600);});startupClock();

if("serviceWorker" in navigator&&location.protocol.indexOf("http")==0)navigator.serviceWorker.register("sw.js").catch(function(){});
window.__T440W={version:"0.7",productionStartupMs:PROD_STARTUP_MS,startRom:startRom,loadFile:loadFile,chooseFile:chooseFile,scanDeviceStorage:scanDeviceStorage,resetGame:resetGame,saveState:saveStateSlot,loadState:loadStateSlot,toggleMute:toggleMute,setFast:setFast,openOverlay:openOverlay,closeOverlay:closeOverlay,getState:function(){return{coreReady:coreReady,coreFailed:coreFailed,startupDone:startupDone,muted:muted,ffHeld:ffHeld,overlayMode:overlayMode,selection:selection,currentRomId:currentRomId,currentRomName:currentRomName,romSize:currentRomBytes?currentRomBytes.length:0,deviceRomCount:deviceRoms.length,hasDeviceStorage:hasDeviceStorage(),coreMode:coreMode,coreError:coreError,offlineCoreReady:offlineCoreReady};}};
})();
