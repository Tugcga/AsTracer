import { vec3 } from "./vec3";
import { ray } from "./ray";

export class aabb{
    private minimum: vec3;
    private maximum: vec3;

    constructor(a: vec3 = new vec3(), b: vec3 = new vec3()) {
        this.minimum = a;
        this.maximum = b;
    }

    @inline
    clone_from(other: aabb):void{
        this.minimum.clone_from(other.min());
        this.maximum.clone_from(other.max());
    }

    @inline
    min(): vec3 { return this.minimum; }

    @inline
    max(): vec3 { return this.maximum; }

    hit(r: ray, t_min:f64, t_max: f64): bool{
        for (let a = 0; a < 3; a++) {
            const min_a = this.minimum.get(a);
            const max_a = this.maximum.get(a);
            const r_a = r.origin().get(a);
            const dir_a = r.direction().get(a);
            const t0 = Math.min((min_a - r_a) / dir_a,
                                (max_a - r_a) / dir_a);
            const t1 = Math.max((min_a - r_a) / dir_a,
                                (max_a - r_a) / dir_a);
            t_min = Math.max(t0, t_min);
            t_max = Math.min(t1, t_max);
            if (t_max <= t_min)
                return false;
        }
        return true;
    }

    @inline
    center(): vec3{
        return new vec3((this.minimum.x() + this.maximum.x()) / 2.0, 
                        (this.minimum.y() + this.maximum.y()) / 2.0,
                        (this.minimum.z() + this.maximum.z()) / 2.0);
    }

    toString(): string{
        return "[" + this.minimum.toString() + " - " + this.maximum.toString() + "]";
    }
}

export function surrounding_box(box0: aabb, box1: aabb): aabb {
    let small = new vec3(Math.min(box0.min().x(), box1.min().x()),
                         Math.min(box0.min().y(), box1.min().y()),
                         Math.min(box0.min().z(), box1.min().z()));
    let big = new vec3(Math.max(box0.max().x(), box1.max().x()),
                       Math.max(box0.max().y(), box1.max().y()),
                       Math.max(box0.max().z(), box1.max().z()));

    return new aabb(small, big);
}
