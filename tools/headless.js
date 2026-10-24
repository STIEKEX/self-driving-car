// Runs the simulation's browser scripts in Node (no browser, no drawing),
// for offline training and evaluation. Used by train.js and evaluate.js.
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");

// script files in the order index.html loads them
function pageScripts(){
    const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
    return [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
}

// minimal stand-ins for the browser objects the scripts touch
function installBrowserStubs(storage={}){
    const noop=()=>{};
    const fakeContext=canvas=>new Proxy({canvas},{
        get:(target,key)=>key in target?target[key]:noop,
        set:(target,key,value)=>{target[key]=value;return true;}
    });
    const elements={};
    globalThis.window={innerHeight:800};
    globalThis.location={search:""};
    globalThis.document={
        getElementById:id=>elements[id]||(elements[id]={
            width:0,height:0,textContent:"",
            getContext(){return fakeContext(this);}
        }),
        addEventListener:noop
    };
    globalThis.localStorage={
        getItem:key=>key in storage?storage[key]:null,
        setItem:(key,value)=>{storage[key]=String(value);},
        removeItem:key=>{delete storage[key];}
    };
    globalThis.requestAnimationFrame=noop;
    return storage;
}

// loads the scripts into the global scope, like <script> tags do
function loadScripts(files){
    for(const file of files){
        const code=fs.readFileSync(path.resolve(ROOT,file),"utf8").replace(/^﻿/,"");
        vm.runInThisContext(code,{filename:file});
    }
}

// makes Math.random reproducible, so the same seed gives the same run
function seedMathRandom(seed){
    let a=seed>>>0;
    Math.random=function(){
        a=(a+0x6D2B79F5)>>>0;
        let t=a;
        t=Math.imul(t^(t>>>15),t|1);
        t^=t+Math.imul(t^(t>>>7),t|61);
        return ((t^(t>>>14))>>>0)/4294967296;
    };
}

// reads a global declared by the page scripts (const/let/class are not on globalThis)
function pageGlobal(name){
    return vm.runInThisContext(name);
}

module.exports={ROOT,pageScripts,installBrowserStubs,loadScripts,seedMathRandom,pageGlobal};
