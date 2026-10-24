/*
main.js - sets up the road, the cars and the traffic, and runs the animation loop.

Training (neuroevolution, a simple genetic algorithm):
- Every generation, N cars drive through the same traffic. Car 0 gets the saved
  brain unchanged, the others get mutated copies of it.
- The best car is the one that overtook the most traffic cars without crashing;
  distance only breaks ties. Ranking by distance alone rewards tailgating: a car
  that stays behind a traffic car never crashes, so it always looks "furthest".
- When a generation ends, its best brain is saved (if it overtook anything)
  and the next generation starts from it.

URL options:  ?traffic=random  a new, unseen traffic layout every generation
              ?mode=keys       drive yourself with the arrow keys
              ?mode=rule       watch the hand-written baseline driver (baseline.js)
*/
const params=new URLSearchParams(location.search);
const MODE=params.get("mode")=="keys"?"KEYS":params.get("mode")=="rule"?"RULE":"AI";
const RANDOM_TRAFFIC=params.get("traffic")=="random";
const N=MODE=="AI"?100:1;
const MUTATION=0.1;
const START_Y=100;
const MAX_STEPS=4000;     // a generation never lasts longer than this
const STALL_STEPS=1500;   // ...or this long without any new overtake

const carCanvas=document.getElementById("carCanvas");
carCanvas.width=200;
const networkCanvas=document.getElementById("networkCanvas");
networkCanvas.width=300;
const chartCanvas=document.getElementById("chartCanvas");
chartCanvas.width=200;
chartCanvas.height=60;
const statsText=document.getElementById("stats");

const carCtx=carCanvas.getContext("2d");
const networkCtx=networkCanvas.getContext("2d");
const chartCtx=chartCanvas.getContext("2d");
const road=new Road(carCanvas.width/2,carCanvas.width*0.9);

let generation=Number(storageGet("generation"))||1;
let history=loadHistory();
let autoTrain=false;
let speed=1;
let cars,traffic,bestCar,viewCar,step,lastProgressStep,bestPassed;

startGeneration();
updateButtons();
requestAnimationFrame(animate);

function startGeneration(){
    const random=RANDOM_TRAFFIC?createRandom(Math.floor(Math.random()*4294967296)):null;
    traffic=generateTraffic(road,random);
    cars=generateCars(N);

    const brain=MODE=="AI"?loadBrain(cars[0].brain):null;
    if(brain){
        for(let i=0;i<cars.length;i++){
            cars[i].brain=JSON.parse(JSON.stringify(brain));
            if(i!=0){
                NeuralNetwork.mutate(cars[i].brain,MUTATION);
            }
        }
    }

    bestCar=cars[0];
    viewCar=cars[0];
    step=0;
    lastProgressStep=0;
    bestPassed=0;
}

function generateCars(N){
    const cars=[];
    for(let i=1;i<=N;i++){
        const car=new Car(road.getLaneCenter(1),START_Y,30,50,MODE);
        car.passed=0;   // most traffic cars overtaken while still undamaged
        cars.push(car);
    }
    return cars;
}

// fitness: overtakes first, distance (smaller y = further up the road) only as a tie-breaker
function isBetter(a,b){
    if(a.passed!=b.passed){
        return a.passed>b.passed;
    }
    return a.y<b.y;
}

function simulationStep(){
    for(let i=0;i<traffic.length;i++){
        traffic[i].update(road.borders,[]);
    }
    for(let i=0;i<cars.length;i++){
        cars[i].update(road.borders,traffic);
        if(!cars[i].damage){
            cars[i].passed=Math.max(cars[i].passed,countPassed(cars[i],traffic));
        }
    }

    bestCar=cars.reduce((best,c)=>isBetter(c,best)?c:best);
    // the camera follows the best car that is still driving: the best car overall may
    // have crashed, and watching a wreck makes it look like the cars stopped trying
    const driving=cars.filter(c=>!c.damage);
    viewCar=driving.length?driving.reduce((best,c)=>isBetter(c,best)?c:best):bestCar;
    if(bestCar.passed>bestPassed){
        bestPassed=bestCar.passed;
        lastProgressStep=step;
    }
    step++;

    if(autoTrain && generationOver()){
        nextGeneration();
    }
}

function generationOver(){
    return cars.every(c=>c.damage) ||
        bestPassed==traffic.length ||
        step>=MAX_STEPS ||
        step-lastProgressStep>=STALL_STEPS;
}

// records this generation, keeps its best brain and starts the next one
function nextGeneration(){
    if(MODE=="AI"){
        history.push({
            generation:generation,
            passed:bestCar.passed,
            total:traffic.length,
            crashed:bestCar.damage
        });
        storageSet("history",JSON.stringify(history.slice(-200)));
        // a brain that overtook nothing is probably just tailgating: not worth keeping
        if(bestCar.passed>0){
            save();
        }
        generation++;
        storageSet("generation",generation);
    }
    startGeneration();
}

function save(){
    storageSet("bestBrain",JSON.stringify(bestCar.brain));
}

// forget the saved brain and the history, and start again from random brains
function discard(){
    storageSet("bestBrain","");
    resetHistory();
    startGeneration();
}

// start again from the brain trained offline (pretrained.js)
function loadTrained(){
    storageRemove("bestBrain");
    resetHistory();
    startGeneration();
}

function resetHistory(){
    history=[];
    generation=1;
    storageRemove("history");
    storageRemove("generation");
}

function toggleAutoTrain(){
    autoTrain=!autoTrain;
    updateButtons();
}

function toggleSpeed(){
    speed=speed==1?10:speed==10?50:1;
    updateButtons();
}

function updateButtons(){
    document.getElementById("autoButton").textContent="Auto-train: "+(autoTrain?"ON":"OFF");
    document.getElementById("speedButton").textContent="Speed: x"+speed;
}

/*
Which brain the generation starts from:
- nothing stored yet (first visit) -> the brain trained offline (pretrained.js)
- "" (after Discard)               -> random brains
- anything else                    -> the saved brain, if it is valid
*/
function loadBrain(reference){
    const saved=storageGet("bestBrain");
    if(saved===null){
        const trained=typeof PRETRAINED_BRAIN=="undefined"?null:PRETRAINED_BRAIN;
        return isValidBrain(trained,reference)?trained:null;
    }
    if(saved==""){
        return null;
    }
    try{
        const brain=JSON.parse(saved);
        if(isValidBrain(brain,reference)){
            return brain;
        }
    }catch(e){}
    console.warn("Saved brain is corrupt or has the wrong shape - starting from random brains.");
    return null;
}

// same layer sizes as the reference network, and only real numbers inside
function isValidBrain(brain,reference){
    try{
        return brain.levels.length==reference.levels.length &&
            brain.levels.every((level,i)=>
                level.inputs.length==reference.levels[i].inputs.length &&
                level.outputs.length==reference.levels[i].outputs.length &&
                level.biases.length==level.outputs.length &&
                level.biases.every(Number.isFinite) &&
                level.weights.length==level.inputs.length &&
                level.weights.every(row=>
                    row.length==level.outputs.length && row.every(Number.isFinite)
                )
            );
    }catch(e){
        return false;
    }
}

function loadHistory(){
    try{
        const saved=JSON.parse(storageGet("history"));
        return Array.isArray(saved)?saved:[];
    }catch(e){
        return [];
    }
}

// localStorage can throw (private windows, blocked storage), so every access is guarded
function storageGet(key){
    try{
        return localStorage.getItem(key);
    }catch(e){
        return null;
    }
}

function storageSet(key,value){
    try{
        localStorage.setItem(key,value);
    }catch(e){}
}

function storageRemove(key){
    try{
        localStorage.removeItem(key);
    }catch(e){}
}

function animate(time){
    for(let i=0;i<speed;i++){
        simulationStep();
    }

    carCanvas.height=window.innerHeight;
    networkCanvas.height=window.innerHeight;

    carCtx.save();
    carCtx.translate(0,-viewCar.y+carCanvas.height*0.7);

    road.draw(carCtx);
    for(let i=0;i<traffic.length;i++){
        traffic[i].draw(carCtx,"red");
    }
    carCtx.globalAlpha=0.2;
    for(let i=0;i<cars.length;i++){
        cars[i].draw(carCtx,"blue");
    }
    carCtx.globalAlpha=1;
    viewCar.draw(carCtx,"blue",true);

    carCtx.restore();

    networkCtx.lineDashOffset=-time/50;
    Visualizer.drawNetwork(networkCtx,viewCar.brain);

    drawStats();
    drawChart();
    requestAnimationFrame(animate);
}

function drawStats(){
    const alive=cars.filter(c=>!c.damage).length;
    const driver=MODE=="AI"?"Generation "+generation:
        MODE=="KEYS"?"Driver: you (arrow keys)":"Driver: rule-based baseline";
    const lines=[
        driver,
        "Traffic: "+(RANDOM_TRAFFIC?"random layout":"fixed layout"),
        "Alive: "+alive+"/"+cars.length,
        "Best car: overtook "+bestCar.passed+"/"+traffic.length+(bestCar.damage?" (crashed)":""),
        "Distance: "+Math.round(START_Y-bestCar.y)
    ];
    if(viewCar!=bestCar){
        lines.push("Camera: best car still driving ("+viewCar.passed+"/"+traffic.length+")");
    }
    if(alive==0 && !autoTrain){
        lines.push("All cars crashed - press Next gen");
    }
    statsText.textContent=lines.join("\n");
}

// one bar per generation: share of the traffic its best car overtook
function drawChart(){
    const maxBars=40;
    const barWidth=chartCanvas.width/maxBars;
    const recent=history.slice(-maxBars);
    chartCtx.clearRect(0,0,chartCanvas.width,chartCanvas.height);
    for(let i=0;i<recent.length;i++){
        const height=recent[i].passed/recent[i].total*chartCanvas.height;
        chartCtx.fillStyle=recent[i].crashed?"orange":"limegreen";
        chartCtx.fillRect(i*barWidth,chartCanvas.height-height,barWidth-1,height);
    }
}
