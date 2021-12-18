import { vec3, dot, scale, subtract, add } from "./vec3";
import { ray } from "./ray";
import { material } from "./material";
import { aabb } from "./aabb";
import { degrees_to_radians, infinity, log_message } from "./utilities";

export class hit_record{
    p: vec3 = new vec3();
    normal: vec3 = new vec3();
    mat_ptr: material = new material();
    t: f64 = 0.0;
    u: f64 = 0.0;
    v: f64 = 0.0;
    front_face: bool = true;

    set_face_normal(r: ray, outward_normal: vec3): void{
        this.front_face = dot(r.direction(), outward_normal) < 0.0;
        this.normal = this.front_face ? outward_normal : scale(-1.0, outward_normal);
    }

    clone_from(other: hit_record): void{
        this.p = other.p;
        this.normal = other.normal;
        this.mat_ptr = other.mat_ptr;
        this.t = other.t;
        this.u = other.u;
        this.v = other.v;
        this.front_face = other.front_face;
    }

    toString(): string{
        return "{p: " + this.p.toString() + 
              ", n: " + this.normal.toString() + 
              ", t: " + this.t.toString() +
              ", u: " + this.u.toString() + 
              ", v: " + this.v.toString() +
              ", f: " + this.front_face.toString() +
              "}";
    }
}

export abstract class hittable{
    abstract hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool;
    abstract bounding_box(output_box: aabb): bool;

    pdf_value(o: vec3, v: vec3): f64{
        return 1.0;
    }

    random(o: vec3): vec3{
        return new vec3(1.0, 0.0, 0.0);
    }

    get_count(): i32{
        return 0;
    }

    toString(): string{
        return "abstract hittable";
    }
}

/*export class translate extends hittable {
    private ptr: hittable;
    private offset: vec3;

    constructor(p: hittable, disp: vec3) {
        super();
        this.ptr = p;
        this.offset = disp;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        let moved_r = new ray(subtract(r.origin(), this.offset), r.direction());
        if(!this.ptr.hit(moved_r, t_min, t_max, rec)){
            return false;
        }

        rec.p.add_inplace(this.offset);
        rec.set_face_normal(moved_r, rec.normal);
        return true;
    }

    bounding_box(output_box: aabb): bool{
        if(!this.ptr.bounding_box(output_box)){
            return false;
        }

        output_box.clone_from(new aabb(add(output_box.min(), this.offset), add(output_box.max(), this.offset)));
        return true;
    }
}

export class rotate_y extends hittable {
    ptr: hittable;
    sin_theta: f64;
    cos_theta: f64;
    hasbox: bool;
    bbox: aabb;

    constructor(p: hittable, angle: f64) {
        super();

        this.ptr = p;

        const radians = degrees_to_radians(angle);
        this.sin_theta = Math.sin(radians);
        this.cos_theta = Math.cos(radians);
        this.bbox = new aabb();
        this.hasbox = this.ptr.bounding_box(this.bbox);

        let min = new vec3(infinity, infinity, infinity);
        let max = new vec3(-infinity, -infinity, -infinity);

        for(let i = 0; i < 2; i++){
            for(let j = 0; j < 2; j++){
                for(let k = 0; k < 2; k++){
                    const x = i*this.bbox.max().x() + (1-i)*this.bbox.min().x();
                    const y = j*this.bbox.max().y() + (1-j)*this.bbox.min().y();
                    const z = k*this.bbox.max().z() + (1-k)*this.bbox.min().z();

                    const newx = this.cos_theta*x + this.sin_theta*z;
                    const newz = -this.sin_theta*x + this.cos_theta*z;

                    let tester = new vec3(newx, y, newz);
                    for(let c = 0; c < 3; c++){
                        min.set(c, Math.min(min.get(c), tester.get(c)));
                        max.set(c, Math.max(max.get(c), tester.get(c)));
                    }
                }
            }
        }

        this.bbox = new aabb(min, max);
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        let origin = new vec3(); origin.clone_from(r.origin());
        let direction = new vec3(); direction.clone_from(r.direction());

        origin.set(0, this.cos_theta*r.origin().get(0) - this.sin_theta*r.origin().get(2));
        origin.set(2, this.sin_theta*r.origin().get(0) + this.cos_theta*r.origin().get(2));

        direction.set(0, this.cos_theta*r.direction().get(0) - this.sin_theta*r.direction().get(2));
        direction.set(2, this.sin_theta*r.direction().get(0) + this.cos_theta*r.direction().get(2));

        let rotated_r = new ray(origin, direction);

        if(!this.ptr.hit(rotated_r, t_min, t_max, rec)){
            return false;
        }

        let p = new vec3(); p.clone_from(rec.p);
        let normal = new vec3(); normal.clone_from(rec.normal);

        p.set(0, this.cos_theta*rec.p.get(0) + this.sin_theta*rec.p.get(2));
        p.set(2, -this.sin_theta*rec.p.get(0) + this.cos_theta*rec.p.get(2));

        normal.set(0, this.cos_theta*rec.normal.get(0) + this.sin_theta*rec.normal.get(2));
        normal.set(2, -this.sin_theta*rec.normal.get(0) + this.cos_theta*rec.normal.get(2));

        rec.p = p;
        rec.set_face_normal(rotated_r, normal);
        return true;
    }

    bounding_box(output_box: aabb): bool{
        output_box.clone_from(this.bbox);
        return this.hasbox;
    }
}

export class flip_face extends hittable {
    ptr: hittable;

    constructor(p: hittable) {
        super();
        this.ptr = p;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        if(!this.ptr.hit(r, t_min, t_max, rec)){
            return false;
        }
        rec.front_face = !rec.front_face;
        return true;
    }

    bounding_box(output_box: aabb): bool{
        return this.ptr.bounding_box(output_box);
    }
}*/