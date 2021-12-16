import { vec3, subtract, add, divide, scale, unit_vector, cross, random_in_unit_disk } from "./vec3";
import { ray } from "./ray";
import { degrees_to_radians, random_double_range } from "./utilities";

export class camera{
    private origin: vec3 = new vec3();
    private lower_left_corner: vec3;
    private horizontal: vec3;
    private vertical: vec3;
    private u: vec3;
    private v: vec3;
    private w: vec3;
    private lens_radius: f64;

    constructor(lookfrom: vec3, 
                lookat: vec3, 
                vup: vec3, 
                vfov: f64, 
                aspect_ration: f64, 
                aperture: f64, 
                focus_dist: f64) {
        const theta = degrees_to_radians(vfov);
        const h = Math.tan(theta / 2.0);

        const viewport_height = 2.0 * h;
        const viewport_width = aspect_ration * viewport_height;

        this.w = unit_vector(subtract(lookfrom, lookat));
        this.u = unit_vector(cross(vup, this.w));
        this.v = cross(this.w, this.u);

        this.origin.clone_from(lookfrom);
        this.horizontal = scale(viewport_width * focus_dist, this.u);
        this.vertical = scale(viewport_height * focus_dist, this.v);
        const value_01 = add(divide(2.0, this.horizontal), divide(2.0, this.vertical));
        this.lower_left_corner = subtract(this.origin, add(value_01, scale(focus_dist, this.w)));

        this.lens_radius = aperture / 2.0;
    }

    get_ray(s: f64, t: f64): ray{
        let rd = this.lens_radius > 0.0001 ? scale(this.lens_radius, random_in_unit_disk()) : new vec3();
        let offset = add(scale(rd.x(), this.u), scale(rd.y(), this.v));

        const value_01 = add(this.lower_left_corner, scale(s, this.horizontal));
        const value_02 = add(value_01, scale(t, this.vertical));
        const value_03 = add(this.origin, offset);
        return new ray(value_03, subtract(value_02, add(this.origin, offset)));
    }
}