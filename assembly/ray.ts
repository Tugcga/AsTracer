import { vec3, add, scale } from "./vec3";

export class ray{
    private orig: vec3;
    private dir: vec3;

    constructor(origin: vec3 = new vec3(), direction: vec3 = new vec3()) {
        this.orig = origin;
        this.dir = direction;
    }

    origin(): vec3{ return this.orig; }
    direction(): vec3{ return this.dir; }

    at(t: f64): vec3{
        return add(this.orig, scale(t, this.dir));
    }

    clone_from(other: ray): void{
        this.orig.clone_from(other.origin());
        this.dir.clone_from(other.direction());
    }
}