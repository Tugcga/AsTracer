import { xy_rect, yz_rect, xz_rect } from "./aarect";
import { vec3 } from "./vec3";
import { hittable_list } from "./hittable_list";
import { hittable, hit_record } from "./hittable";
import { ray } from "./ray";
import { material } from "./material";
import { aabb } from "./aabb";
import { bvh_node } from "./bvh";

export class box extends  hittable{
    private box_min: vec3;
    private box_max: vec3;
    //private sides: hittable_list;
    private sides: bvh_node;

    constructor(p0: vec3, p1: vec3, ptr: material) {
        super();
        this.box_min = p0;
        this.box_max = p1;
        let objects = new Array<hittable>(6);
        unchecked(objects[0] = new xy_rect(p0.x(), p1.x(), p0.y(), p1.y(), p1.z(), ptr));
        unchecked(objects[1] = new xy_rect(p0.x(), p1.x(), p0.y(), p1.y(), p0.z(), ptr));

        unchecked(objects[2] = new xz_rect(p0.x(), p1.x(), p0.z(), p1.z(), p1.y(), ptr));
        unchecked(objects[3] = new xz_rect(p0.x(), p1.x(), p0.z(), p1.z(), p0.y(), ptr));

        unchecked(objects[4] = new yz_rect(p0.y(), p1.y(), p0.z(), p1.z(), p1.x(), ptr));
        unchecked(objects[5] = new yz_rect(p0.y(), p1.y(), p0.z(), p1.z(), p0.x(), ptr));

        this.sides = new bvh_node(objects, 6);
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        return this.sides.hit(r, t_min, t_max, rec);
    }

    bounding_box(output_box: aabb): bool{
        output_box.clone_from(new aabb(this.box_min, this.box_max));
        return true;
    }
}