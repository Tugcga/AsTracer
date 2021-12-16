import { hittable, hit_record } from "./hittable";
import { vec3, add, subtract, dot, divide } from "./vec3";
import { ray } from "./ray";
import { material } from "./material";
import { aabb } from "./aabb";
import { pi, infinity } from "./utilities";
import { onb } from "./onb";
import { random_to_sphere } from "./pdf";

export class sphere extends hittable {
    private center: vec3;
    private radius: f64;
    private mat_ptr: material;

    constructor(cen: vec3, r: f64, m: material) {
        super();
        this.center = cen;
        this.radius = r;
        this.mat_ptr = m;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        const oc = subtract(r.origin(), this.center);
        const a = r.direction().length_squared();
        const half_b = dot(oc, r.direction());
        const c = oc.length_squared() - this.radius * this.radius;
        const discriminant = half_b * half_b - a * c;

        if(discriminant < 0.0){
            return false;
        }

        const sqrtd = Math.sqrt(discriminant);
        let root = (-half_b - sqrtd) / a;
        if(root < t_min || t_max < root){
            root = (-half_b + sqrtd) / a;
            if(root < t_min || t_max < root){
                return false;
            }
        }

        rec.t = root;
        rec.p = r.at(rec.t);
        const outward_normal: vec3 = divide(this.radius, subtract(rec.p, this.center))
        rec.set_face_normal(r, outward_normal);
        let uvs = sphere.get_sphere_uv(outward_normal);
        rec.u = uvs.x(); rec.v = uvs.y();
        rec.mat_ptr = this.mat_ptr;
        return true;
    }

    bounding_box(output_box: aabb): bool{
        let box = new aabb(subtract(this.center, new vec3(this.radius, this.radius, this.radius)),
                           add(this.center, new vec3(this.radius, this.radius, this.radius)));
        output_box.clone_from(box);

        return true;
    }

    pdf_value(o: vec3, v: vec3): f64{
        let rec = new hit_record();
        if(!this.hit(new ray(o, v), 0.001, infinity, rec)){
            return 0.0;
        }

        const cos_theta_max = Math.sqrt(1.0 - this.radius * this.radius / subtract(this.center, o).length_squared());
        const solid_angle = 2*pi*(1 - cos_theta_max);

        return 1.0 / solid_angle;
    }

    random(o: vec3): vec3{
        let direction = subtract(this.center, o);
        const distance_squared = direction.length_squared();
        let uvw = new onb();
        uvw.build_from_w(direction);

        let rts = random_to_sphere(this.radius, distance_squared);
        return uvw.local(rts.x(), rts.y(), rts.z());
    }

    static get_sphere_uv(p: vec3): vec3{
        const theta = Math.acos(-p.y());
        const phi = Math.atan2(-p.z(), p.x()) + pi;

        return new vec3(phi / (2*pi), theta / pi, 0.0);
    }
}