// Measures how well each driver gets through traffic:
//   - on the fixed layout the network was trained on
//   - on random layouts it has never seen (does it generalise, or did it memorise the road?)
//
// Usage: node tools/evaluate.js [randomLayouts=100] [brainFile=pretrained.js]
const {pageScripts,installBrowserStubs,loadScripts,seedMathRandom,pageGlobal}=require("./headless");

const layouts=Number(process.argv[2])||100;
const brainFile=process.argv[3]||"pretrained.js";
const MAX_STEPS=4000;

installBrowserStubs();
// everything except the page's own setup and drawing; the brain comes from brainFile
loadScripts(pageScripts().filter(f=>f!="main.js" && f!="visualizer.js" && f!="pretrained.js"));
loadScripts([brainFile]);
const Road=pageGlobal("Road");
const Car=pageGlobal("Car");
const generateTraffic=pageGlobal("generateTraffic");
const countPassed=pageGlobal("countPassed");
const createRandom=pageGlobal("createRandom");
const PRETRAINED_BRAIN=pageGlobal("PRETRAINED_BRAIN");

// one car drives until it crashes, overtakes everything, or runs out of time
function runEpisode(controlType,brain,layoutSeed){
    const road=new Road(100,180);
    const traffic=generateTraffic(road,layoutSeed==null?null:createRandom(layoutSeed));
    const car=new Car(road.getLaneCenter(1),100,30,50,controlType);
    if(brain){
        car.brain=JSON.parse(JSON.stringify(brain));
    }
    let passed=0;
    for(let step=0;step<MAX_STEPS && !car.damage && passed<traffic.length;step++){
        for(const t of traffic){
            t.update(road.borders,[]);
        }
        car.update(road.borders,traffic);
        if(!car.damage){
            passed=Math.max(passed,countPassed(car,traffic));
        }
    }
    return {share:passed/traffic.length,cleared:passed==traffic.length,crashed:car.damage};
}

function summarise(results){
    const mean=key=>results.reduce((sum,r)=>sum+Number(r[key]),0)/results.length;
    return {
        overtaken:(mean("share")*100).toFixed(0)+"%",
        cleared:(mean("cleared")*100).toFixed(0)+"%",
        crashed:(mean("crashed")*100).toFixed(0)+"%"
    };
}

function evaluate(name,controlType,brainFor){
    seedMathRandom(12345);   // same random brains on every run of this script
    const fixed=[];
    const random=[];
    const fixedRuns=brainFor==null?1:layouts;   // a fixed brain on a fixed layout always drives the same way
    for(let i=0;i<fixedRuns;i++){
        fixed.push(runEpisode(controlType,brainFor&&brainFor(),null));
    }
    for(let seed=1;seed<=layouts;seed++){
        random.push(runEpisode(controlType,brainFor&&brainFor(),seed));
    }
    return {name,fixed:summarise(fixed),random:summarise(random)};
}

const rows=[
    evaluate("Random brain (untrained)","AI",()=>null),
    evaluate("Rule-based baseline","RULE",null)
];
if(PRETRAINED_BRAIN){
    rows.push(evaluate("Trained brain ("+brainFile.split(/[\\/]/).pop()+")","AI",()=>PRETRAINED_BRAIN));
}else{
    console.log("pretrained.js has no brain yet - run: node tools/train.js");
}

console.log("\nTraffic overtaken (mean) / runs that cleared all traffic / runs that crashed");
console.log("Random layouts: "+layouts+" unseen layouts, seeds 1-"+layouts+".\n");
console.log("| Driver | Fixed layout (trained on) | Random layouts (never seen) |");
console.log("|---|---|---|");
for(const r of rows){
    const cell=s=>s.overtaken+" / "+s.cleared+" / "+s.crashed;
    console.log("| "+r.name+" | "+cell(r.fixed)+" | "+cell(r.random)+" |");
}
