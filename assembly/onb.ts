import { vec3, add, scale, unit_vector, cross } from "./vec3";

export class onb{
    private axis_0: vec3;
    private axis_1: vec3;
    private axis_2: vec3;

    constructor() {
        this.axis_0 = new vec3(1.0, 0.0, 0.0);
        this.axis_1 = new vec3(0.0, 1.0, 0.0);
        this.axis_2 = new vec3(0.0, 0.0, 1.0);
    }

    u(): vec3{ return this.axis_0; }
    v(): vec3{ return this.axis_1; }
    w(): vec3{ return this.axis_2; }

    get(i: i32): vec3{
        if(i == 0){
            return this. axis_0;
        }
        else if(i == 1){
            return this.axis_1;
        }
        else{
            return this.axis_2;
        }
    }

    local(a: f64, b: f64, c: f64): vec3{
        const value_01 = scale(a, this.u());
        const value_02 = scale(b, this.v());
        const value_03 = add(value_01, value_02);
        return add(value_03, scale(c, this.w()));
    }

    build_from_w(n: vec3): void{
        this.axis_2 = unit_vector(n);
        let a: vec3 = (Math.abs(this.w().x()) > 0.9) ? new vec3(0.0, 1.0, 0.0) : new vec3(1.0, 0.0, 0.0);
        this.axis_1 = unit_vector(cross(this.w(), a));
        this.axis_0 = cross(this.w(), this.v());
    }
}