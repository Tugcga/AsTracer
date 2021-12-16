import { hittable, hit_record } from "./hittable";
import { hittable_list } from "./hittable_list";
import { ray } from "./ray";
import { aabb, surrounding_box } from "./aabb";
import { random_int, log_message } from "./utilities";
import { vec3 } from "./vec3";

class empty_hittable extends hittable {
    
    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        return false;
    }

    bounding_box(output_box: aabb): bool{
        return false
    }
}

export class bvh_node extends hittable{
    private left: hittable = new empty_hittable();
    private right: hittable = new empty_hittable();
    private box: aabb = new aabb();
    private is_leaf: bool;  // when true, then consider only left node, because the right node is the same

    constructor(src_objects: Array<hittable>, object_count: i32) {
        super();

        if(object_count == 0){
            this.is_leaf = true;
        }
        else{
            this.is_leaf = false;
        
            if(object_count == 1){
                this.left = unchecked(src_objects[0]);
                this.right = unchecked(src_objects[0]);
                this.is_leaf = true;
            }
            else{
                let median = new vec3();
                let boxes = new Array<aabb>(object_count);
                for(let i = 0; i < object_count; i++){
                    let object = unchecked(src_objects[i]);
                    let box = new aabb();
                    object.bounding_box(box);
                    median.add_inplace(box.center());
                    unchecked(boxes[i] = box);
                }
                median.divide_inplace(<f64>object_count);
                //next split all object by left and right parts
                //by all three directions
                let left_objects_x = new Array<hittable>(object_count); let right_objects_x = new Array<hittable>(object_count);
                let x_left_count = 0; let x_right_count = 0;
                let left_objects_y = new Array<hittable>(object_count); let right_objects_y = new Array<hittable>(object_count);
                let y_left_count = 0; let y_right_count = 0;
                let left_objects_z = new Array<hittable>(object_count); let right_objects_z = new Array<hittable>(object_count);
                let z_left_count = 0; let z_right_count = 0;
                for(let i = 0; i < object_count; i++){
                    let object = unchecked(src_objects[i]);
                    let box = unchecked(boxes[i]);
                    if(box.center().get(0) < median.get(0)){ unchecked(left_objects_x[x_left_count] = object); x_left_count++; } else{ unchecked(right_objects_x[x_right_count] = object); x_right_count++; }
                    if(box.center().get(1) < median.get(1)){ unchecked(left_objects_y[y_left_count] = object); y_left_count++; } else{ unchecked(right_objects_y[y_right_count] = object); y_right_count++; }
                    if(box.center().get(2) < median.get(2)){ unchecked(left_objects_z[z_left_count] = object); z_left_count++; } else{ unchecked(right_objects_z[z_right_count] = object); z_right_count++; }
                }

                //chose direction with minimal difference between left and right parts
                const x_span = Math.abs(x_left_count - x_right_count);
                const y_span = Math.abs(y_left_count - y_right_count);
                const z_span = Math.abs(z_left_count - z_right_count);
                if(x_span <= y_span && x_span <= z_span){
                    this.build_left_and_right(left_objects_x, x_left_count, right_objects_x, x_right_count);
                }
                else if(y_span <= x_span && y_span <= z_span){
                    this.build_left_and_right(left_objects_y, y_left_count, right_objects_y, y_right_count);
                }
                else{
                    this.build_left_and_right(left_objects_z, z_left_count, right_objects_z, z_right_count);
                }
            }

            let box_left = new aabb();
            let box_right = new aabb();

            if(!this.left.bounding_box(box_left) || !this.right.bounding_box(box_right)){
                //something wrong, error is here
            }

            this.box = surrounding_box(box_left, box_right);
        }
    }

    @inline
    build_left_and_right(left_objects: Array<hittable>, left_count: i32, right_objects: Array<hittable>, right_count: i32): void{
        if(left_count == 0){
            unchecked(left_objects[0] = right_objects[right_count - 1]);
            right_count--;
            left_count = 1;
        }
        if(right_count == 0){
            unchecked(right_objects[0] = left_objects[left_count - 1]);
            left_count--;
            right_count = 1;
        }

        //create left and right nodes
        this.left = new bvh_node(left_objects, left_count);
        this.right = new bvh_node(right_objects, right_count);
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        if(!this.box.hit(r, t_min, t_max)){
            return false;
        }

        const hit_left = this.left.hit(r, t_min, t_max, rec);
        let hit_right: bool = false;
        if(!this.is_leaf){
            hit_right = this.right.hit(r, t_min, hit_left ? rec.t : t_max, rec);
        }

        return hit_left || hit_right;
    }

    bounding_box(output_box: aabb): bool{
        output_box.clone_from(this.box);
        return true;
    }
}
