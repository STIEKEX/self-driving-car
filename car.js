class Car{
    // controlType: "KEYS" (arrow keys), "AI" (neural network), "RULE" (hand-written baseline), "DUMMY" (traffic)
    constructor(x,y,width,height , controlType , maxSpeed =3){
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;

        this.speed=0;
        this.acceleration=0.2;
        this.maxSpeed=maxSpeed;
        this.friction=0.05;
        this.angle=0;
        this.damage=false;
        // a car must have a shape as soon as it exists, so it can be drawn before its first update
        this.polygon=this.#createPolygon();

        this.controlType=controlType;
        this.useBrain=controlType=="AI";
        if(controlType!="DUMMY"){
            this.sensor=new Sensor(this);
            this.brain=new NeuralNetwork(
                [this.sensor.rayCount , 6 , 4]
            );
        }
        this.controls=new Controls(controlType);
    }

    update(roadBorders , traffic){
        // a crashed car stays where it is, so it has nothing left to compute
        if(this.damage){
            return;
        }
        this.#move();
        this.polygon=this.#createPolygon();
        this.damage=this.#assessDamage(roadBorders , traffic);

        if(this.sensor){
            this.sensor.update(roadBorders , traffic);
            // close obstacle -> value near 1, nothing seen -> 0
            const offsets=this.sensor.readings.map(s=>s==null?0:1-s.offset);
            const outputs=NeuralNetwork.feedForward(offsets , this.brain);
            if(this.useBrain){
                this.controls.forward=outputs[0]>0.5;
                this.controls.reverse=outputs[1]>0.5;
                this.controls.left=outputs[2]>0.5;
                this.controls.right=outputs[3]>0.5;
            }
            if(this.controlType=="RULE"){
                Object.assign(this.controls , ruleDriver(offsets));
            }
        }
    }

    #assessDamage(roadBorders , traffic){
        for(let i=0;i<roadBorders.length;i++){
            if(polysIntersect(this.polygon,roadBorders[i])){
                return true;
            }
        }
        for(let i=0;i<traffic.length;i++){
            if(polysIntersect(this.polygon,traffic[i].polygon)){
                return true;
            }
        }
        return false;
    }


    #createPolygon(){
        const points = [] ; 
        const rad=Math.hypot(this.width,this.height)/2;
        const theta=Math.atan2(this.width,this.height);

        points.push({
            x:this.x-Math.sin(this.angle-theta)*rad,
            y:this.y-Math.cos(this.angle-theta)*rad
        });
        points.push({
            x:this.x-Math.sin(this.angle+theta)*rad,
            y:this.y-Math.cos(this.angle+theta)*rad
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle-theta)*rad,
            y:this.y-Math.cos(Math.PI+this.angle-theta)*rad
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle+theta)*rad,
            y:this.y-Math.cos(Math.PI+this.angle+theta)*rad
        });
        return points;
    }

    #move(){
        if(this.controls.forward){
            this.speed+=this.acceleration;
        }
        if(this.controls.reverse){
            this.speed-=this.acceleration;
        }

        if(this.speed>this.maxSpeed){
            this.speed=this.maxSpeed;
        }
        if(this.speed<-this.maxSpeed/2){
            this.speed=-this.maxSpeed/2;
        }

        if(this.speed>0){
            this.speed-=this.friction;
        }
        if(this.speed<0){
            this.speed+=this.friction;
        }
        if(Math.abs(this.speed)<this.friction){
            this.speed=0;
        }

        if(this.speed!=0){
            const flip=this.speed>0?1:-1;
            if(this.controls.left){
                this.angle+=0.03*flip;
            }
            if(this.controls.right){
                this.angle-=0.03*flip;
            }
        }

        this.x-=Math.sin(this.angle)*this.speed;
        this.y-=Math.cos(this.angle)*this.speed;
    }

    draw(ctx, color, drawSensor=false){
        if(this.damage){
            ctx.fillStyle="gray";
        }else{
            ctx.fillStyle=color;
        }
        ctx.beginPath();
        ctx.moveTo(this.polygon[0].x,this.polygon[0].y);
        for(let i=1;i<this.polygon.length;i++){
            ctx.lineTo(this.polygon[i].x,this.polygon[i].y);
        }
        ctx.closePath();
        ctx.fill();
        if(this.sensor && drawSensor){
            this.sensor.draw(ctx);
        }
    }
}