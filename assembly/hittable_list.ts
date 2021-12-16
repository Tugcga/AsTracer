import { hittable, hit_record } from "./hittable";
import { ray } from "./ray";
import { aabb, surrounding_box } from "./aabb";
import { vec3 } from "./vec3";
import { random_int, log_message } from "./utilities";

export class hittable_list extends hittable {
    private objects: Array<hittable>;
    private objects_count: i32;

    constructor() {
        super();
        this.objects_count = 0;
        this.objects = new Array<hittable>(10);
    }

    @inline
    clear(): void{
        this.objects_count = 0;
    }

    @inline
    get_count(): i32{
        return this.objects_count;
    }

    @inline
    get_objects(): Array<hittable>{
        return this.objects;
    }

    add(object: hittable): void{
        if(!(this.objects_count < this.objects.length)){
            //recreate the array
            let new_array = new Array<hittable>(this.objects_count + this.objects_count / 2);
            //copy values
            for(let i = 0; i < this.objects.length; i++){
                unchecked(new_array[i] = this.objects[i]);
            }
            this.objects = new_array;
        }
        unchecked(this.objects[this.objects_count] = object);
        this.objects_count++;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        let temp_rec = new hit_record();
        let hit_anything: bool = false;
        let closest_so_far: f64 = t_max;

        for(let i = 0, len = this.objects_count; i < len; i++){
            let object: hittable = unchecked(this.objects[i]);
            if(object.hit(r, t_min, closest_so_far, temp_rec)){
                hit_anything = true;
                closest_so_far = temp_rec.t;
                rec.clone_from(temp_rec);
            }
        }

        return hit_anything;
    }

    bounding_box(output_box: aabb): bool{
        if(this.objects_count == 0){ return false; }

        let temp_box = new aabb();
        let first_box = true;

        for(let i = 0, len = this.objects_count; i < len; i++){
            let object = unchecked(this.objects[i]);
            if(!object.bounding_box(temp_box)){
                return false;
            }

            output_box.clone_from(first_box ? temp_box : surrounding_box(output_box, temp_box));
            first_box = false;
        }
        return true;
    }

    pdf_value(o: vec3, v: vec3): f64{
        if(this.objects_count == 0){
            return 1.0;
        }
        const weight: f64 = 1.0 / this.objects_count;
        let sum: f64 = 0.0;

        for(let i = 0, len = this.objects_count; i < len; i++){
            let obj = unchecked(this.objects[i]);
            sum += weight * obj.pdf_value(o, v);
        }
        return sum;
    }

    random(o: vec3): vec3{
        if(this.objects_count == 0){
            return new vec3(0.0, 1.0, 0.0);
        }
        let obj = unchecked(this.objects[random_int(0, this.objects_count - 1)]);
        return obj.random(o);
    }
}