/*
Hand-written driver, used as a baseline: if the trained network can't beat
a few simple rules, it hasn't learned much.

It gets exactly the same input as the network (the 5 ray readings, left to right,
0 = nothing seen, close to 1 = obstacle very close), so the comparison is fair.
The thresholds were tuned on random layouts with seeds 1001-1100, which are NOT
the layouts tools/evaluate.js reports on (seeds 1-100), and the chosen values sit
in the middle of a range where the result barely changes.
*/
function ruleDriver(readings){
    const [farLeft,left,front,right,farRight]=readings;
    const controls={forward:true,reverse:false,left:false,right:false};

    // something ahead: go left unless the right side is clearly emptier.
    // Without the 0.1 margin, two equal sides make the car steer right, then left,
    // then right... it wobbles in place behind the traffic car and never overtakes.
    if(front>0.3 || left>0.5 || right>0.5){
        if(farLeft+left>right+farRight+0.1){
            controls.right=true;
        }else{
            controls.left=true;
        }
    }

    // stay away from the road edges
    if(farLeft>0.7){
        controls.left=false;
        controls.right=true;
    }
    if(farRight>0.7){
        controls.right=false;
        controls.left=true;
    }

    // very close: stop accelerating
    if(front>0.7){
        controls.forward=false;
    }
    return controls;
}
