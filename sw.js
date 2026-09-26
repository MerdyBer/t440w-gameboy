"use strict";
var CACHE="t440w-gb-v0.7.3-audio";
var SHELL=[
 "./","./index.html","./style.css","./app.js",
 "./manifest.webmanifest","./manifest.en-US.webmanifest",
 "./mock-core.js",
 "./icons/icon-56.png","./icons/icon-112.png","./icons/icon-192.png"
];

self.addEventListener("install",function(e){
 e.waitUntil(
   caches.open(CACHE)
     .then(function(c){return c.addAll(SHELL);})
     .then(function(){return self.skipWaiting();})
 );
});

self.addEventListener("activate",function(e){
 e.waitUntil(
   caches.keys()
     .then(function(keys){
       return Promise.all(keys.map(function(k){
         if(k!==CACHE)return caches.delete(k);
       }));
     })
     .then(function(){return self.clients.claim();})
 );
});

self.addEventListener("fetch",function(e){
 if(e.request.method!=="GET")return;

 e.respondWith(
   caches.match(e.request).then(function(hit){
     if(hit)return hit;

     return fetch(e.request).then(function(res){
       if(res&&(res.ok||res.type==="opaque")){
         var copy=res.clone();
         caches.open(CACHE).then(function(c){c.put(e.request,copy);});
       }
       return res;
     }).catch(function(){
       // Only navigation requests should fall back to the app shell.
       // Returning HTML for a missing JS/CSS/core request causes misleading
       // syntax errors, so subresources fail normally instead.
       if(e.request.mode==="navigate"){
         return caches.match("./index.html");
       }
       return Response.error();
     });
   })
 );
});
