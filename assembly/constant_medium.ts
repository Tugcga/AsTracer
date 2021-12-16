/*import { hittable, hit_record } from "./hittable";
import { material, isotropic } from "./material";
import { ray } from "./ray";
import { texture } from "./texture";
import { aabb } from "./aabb";
import { infinity, random_double } from "./utilities";
import { vec3 } from "./vec3";

export class constant_medium extends hittable {
    private boundary: hittable;
    private phase_function: material;
    private neg_inv_density: f64;

    constructor(b: hittable, d: f64, a: texture) {
        super();

        this.boundary = b;
        this.neg_inv_density = -1.0 / d;
        this.phase_function = new isotropic(a);
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        let rec1 = new hit_record();
        let rec2 = new hit_record();

        if(!this.boundary.hit(r, -infinity, infinity, rec1)){
            return false;
        }

        if(!this.boundary.hit(r, rec1.t+0.0001, infinity, rec2)){
            return false;
        }

        if(rec1.t < t_min){ rec1.t = t_min; }
        if(rec2.t > t_max){ rec2.t = t_max; }

        if(rec1.t >= rec2.t){
            return false;
        }

        if(rec1.t < 0.0){ rec1.t = 0.0; }

        const ray_length = r.direction().length();
        const distance_inside_boundary = (rec2.t - rec1.t) * ray_length;
        const hit_distance = this.neg_inv_density * Math.log(random_double());

        if(hit_distance > distance_inside_boundary){
            return false;
        }

        rec.t = rec1.t + hit_distance / ray_length;
        rec.p = r.at(rec.t);

        rec.normal = new vec3(1.0, 0.0, 0.0);
        rec.front_face = true;
        rec.mat_ptr = this.phase_function;

        return true;
    }

    bounding_box(output_box: aabb): bool{
        return this.boundary.bounding_box(output_box);
    }
}*/