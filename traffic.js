// lanes blocked in each row of the fixed (training) layout; every row leaves at least one lane free
const FIXED_LAYOUT=[[1],[0,2],[0,1],[1,2],[0],[1,2]];
const ROW_GAP=200;

// random: null -> the fixed layout, or a function returning numbers in [0,1) -> a random layout
function generateTraffic(road,random=null,rows=FIXED_LAYOUT.length){
    const traffic=[];
    for(let row=0;row<rows;row++){
        const lanes=random?randomRow(random,road.laneCount):FIXED_LAYOUT[row];
        for(let i=0;i<lanes.length;i++){
            traffic.push(new Car(road.getLaneCenter(lanes[i]),-100-row*ROW_GAP,30,50,"DUMMY",2));
        }
    }
    return traffic;
}

// blocks 1 to laneCount-1 random lanes, so a row is never completely closed
function randomRow(random,laneCount){
    const lanes=[];
    for(let lane=0;lane<laneCount;lane++){
        lanes.push(lane);
    }
    for(let i=lanes.length-1;i>0;i--){
        const j=Math.floor(random()*(i+1));
        [lanes[i],lanes[j]]=[lanes[j],lanes[i]];
    }
    const blocked=1+Math.floor(random()*(laneCount-1));
    return lanes.slice(0,blocked);
}

// traffic cars that are completely behind this car (overtaken)
function countPassed(car,traffic){
    let count=0;
    for(let i=0;i<traffic.length;i++){
        if(traffic[i].y-car.y>car.height){
            count++;
        }
    }
    return count;
}
