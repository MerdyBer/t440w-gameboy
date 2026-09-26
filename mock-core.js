"use strict";
(function(){
function GameBoyCore(canvas,rom){this.canvas=canvas;this.rom=rom;this.name="MOCK";this.stopEmulator=0;this.cBATT=true;this.cTIMER=true;this.audioHandle={changeVolume:function(v){window.__mockVolume=v}};this.events=[];}
GameBoyCore.prototype.start=function(){window.__mockStarted=(window.__mockStarted||0)+1;this.draw();};
GameBoyCore.prototype.draw=function(){var c=this.canvas.getContext("2d");c.fillStyle="#d9e7b0";c.fillRect(0,0,160,144);c.fillStyle="#17220f";c.font="12px monospace";c.fillText("T440W TEST CORE",22,68);};
GameBoyCore.prototype.run=function(){window.__mockRuns=(window.__mockRuns||0)+1;};
GameBoyCore.prototype.JoyPadEvent=function(i,d){this.events.push([i,d]);window.__mockJoy=this.events.slice();};
GameBoyCore.prototype.saveState=function(){return ["mock-state",this.name,this.events.length];};
GameBoyCore.prototype.returnFromState=function(s){window.__mockReturned=s;this.draw();};
GameBoyCore.prototype.saveSRAMState=function(){return new Array(32768).fill(90);};
GameBoyCore.prototype.saveRTCState=function(){return [1,2,3,4,5];};
window.GameBoyCore=GameBoyCore;
})();
