import { material } from "./material";
import { vec3, dot, subtract } from "./vec3";
import { hittable, hit_record } from "./hittable";
import { aabb } from "./aabb";
import { ray } from "./ray";
import { infinity, random_double_range } from "./utilities";

export class xy_rect extends hittable {
    private x0: f64;
    private x1: f64;
    private y0: f64;
    private y1: f64;
    private k: f64;
    private mp: material;

    constructor(_x0: f64, _x1: f64, _y0: f64, _y1: f64, _k: f64, mat: material) {
        super();
        this.x0 = _x0; this.x1 = _x1; this.y0 = _y0; this.y1 = _y1; this.k = _k;
        this.mp = mat;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        const t = (this.k - r.origin().z()) / r.direction().z();
        if(t < t_min || t > t_max){
            return false;
        }

        const x = r.origin().x() + t * r.direction().x();
        const y = r.origin().y() + t * r.direction().y();
        if(x < this.x0 || x > this.x1 || y < this.y0 || y > this.y1){
            return false;
        }

        rec.u = (x - this.x0) / (this.x1 - this.x0);
        rec.v = (y - this.y0) / (this.y1 - this.y0);
        rec.t = t;

        let outward_normal = new vec3(0.0, 0.0, 1.0);
        rec.set_face_normal(r, outward_normal);
        rec.mat_ptr = this.mp;
        rec.p = r.at(t);

        return true;
    }

    bounding_box(output_box: aabb): bool{
        output_box.clone_from(new aabb(new vec3(this.x0, this.y0, this.k-0.0001), 
                                       new vec3(this.x1, this.y1, this.k+0.0001)));
        return true;
    }

    pdf_value(o: vec3, v: vec3): f64{
        let rec = new hit_record();
        if(!this.hit(new ray(o, v), 0.001, infinity, rec)){
            return 0.0;
        }

        const area = (this.x1 - this.x0) * (this.y1 - this.y0);
        const distance_suqared = rec.t * rec.t * v.length_squared();
        const cosine = Math.abs(dot(v, rec.normal)) / v.length();

        return distance_suqared / (cosine * area);
    }

    random(o: vec3): vec3{
        let random_point = new vec3(random_double_range(this.x0, this.x1), random_double_range(this.y0, this.y1), this.k);
        return subtract(random_point, o);
    }
}

export class xz_rect extends hittable {
    private x0: f64;
    private x1: f64;
    private z0: f64;
    private z1: f64;
    private k: f64;
    private mp: material;

    constructor(_x0: f64, _x1: f64, _z0: f64, _z1: f64, _k: f64, mat: material) {
        super();
        this.x0 = _x0; this.x1 = _x1; this.z0 = _z0; this.z1 = _z1; this.k = _k;
        this.mp = mat;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        const t = (this.k - r.origin().y()) / r.direction().y();
        if(t < t_min || t > t_max){
            return false;
        }

        const x = r.origin().x() + t * r.direction().x();
        const z = r.origin().z() + t * r.direction().z();
        if(x < this.x0 || x > this.x1 || z < this.z0 || z > this.z1){
            return false;
        }

        rec.u = (x - this.x0) / (this.x1 - this.x0);
        rec.v = (z - this.z0) / (this.z1 - this.z0);
        rec.t = t;

        let outward_normal = new vec3(0.0, 1.0, 0.0);
        rec.set_face_normal(r, outward_normal);
        rec.mat_ptr = this.mp;
        rec.p = r.at(t);

        return true;
    }

    bounding_box(output_box: aabb): bool{
        output_box.clone_from(new aabb(new vec3(this.x0, this.k-0.0001, this.z0), 
                                       new vec3(this.x1, this.k+0.0001, this.z1)));
        return true;
    }

    pdf_value(o: vec3, v: vec3): f64{
        let rec = new hit_record();
        if(!this.hit(new ray(o, v), 0.001, infinity, rec)){
            return 0.0;
        }

        const area = (this.x1 - this.x0) * (this.z1 - this.z0);
        const distance_suqared = rec.t * rec.t * v.length_squared();
        const cosine = Math.abs(dot(v, rec.normal)) / v.length();

        return distance_suqared / (cosine * area);
    }

    random(o: vec3): vec3{
        let random_point = new vec3(random_double_range(this.x0, this.x1), this.k, random_double_range(this.z0, this.z1));
        return subtract(random_point, o);
    }
}

export class yz_rect extends hittable {
    private y0: f64;
    private y1: f64;
    private z0: f64;
    private z1: f64;
    private k: f64;
    private mp: material;

    constructor(_y0: f64, _y1: f64, _z0: f64, _z1: f64, _k: f64, mat: material) {
        super();
        this.y0 = _y0; this.y1 = _y1; this.z0 = _z0; this.z1 = _z1; this.k = _k;
        this.mp = mat;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        const t = (this.k - r.origin().x()) / r.direction().x();
        if(t < t_min || t > t_max){
            return false;
        }

        const y = r.origin().y() + t * r.direction().y();
        const z = r.origin().z() + t * r.direction().z();
        if(y < this.y0 || y > this.y1 || z < this.z0 || z > this.z1){
            return false;
        }

        rec.u = (y - this.y0) / (this.y1 - this.y0);
        rec.v = (z - this.z0) / (this.z1 - this.z0);
        rec.t = t;

        let outward_normal = new vec3(1.0, 0.0, 0.0);
        rec.set_face_normal(r, outward_normal);
        rec.mat_ptr = this.mp;
        rec.p = r.at(t);

        return true;
    }

    bounding_box(output_box: aabb): bool{
        output_box.clone_from(new aabb(new vec3(this.k-0.0001, this.y0, this.z0), 
                                       new vec3(this.k+0.0001, this.y1, this.z1)));
        return true;
    }

    pdf_value(o: vec3, v: vec3): f64{
        let rec = new hit_record();
        if(!this.hit(new ray(o, v), 0.001, infinity, rec)){
            return 0.0;
        }

        const area = (this.y1 - this.y0) * (this.z1 - this.z0);
        const distance_suqared = rec.t * rec.t * v.length_squared();
        const cosine = Math.abs(dot(v, rec.normal)) / v.length();

        return distance_suqared / (cosine * area);
    }

    random(o: vec3): vec3{
        let random_point = new vec3(this.k, random_double_range(this.y0, this.y1), random_double_range(this.z0, this.z1));
        return subtract(random_point, o);
    }
}