import { vec3, cross, dot, unit_vector, subtract, add, scale, distance } from "./vec3";
import { hit_record, hittable } from "./hittable";
import { aabb } from "./aabb";
import { ray } from "./ray";
import { material } from "./material";
import { delta, infinity, random_double, log_message } from "./utilities";

export class triangle extends hittable {
    private culling: boolean;
    private p0: vec3;
    private p1: vec3;
    private p2: vec3;
    private n0: vec3;
    private n1: vec3;
    private n2: vec3;
    private u0: f64; private v0: f64;
    private u1: f64; private v1: f64;
    private u2: f64; private v2: f64;
    private face_normal: vec3; // global face normal
    private use_normals: boolean;  // if thrue, then we shoulduse vertex normals, if false - then global face normal
    private mat_ptr: material;
    private area: f64;

    private m_ab: vec3 = new vec3();  // input points are A, B and C
    private m_ac: vec3 = new vec3();  // these vectors are AB and AC, we will use baricentric coordinates with respect to these vectors

    private bake_u0: f64; private bake_v0: f64;
    private bake_u1: f64; private bake_v1: f64;
    private bake_u2: f64; private bake_v2: f64;
    private bake_vector_a: vec3 = new vec3();
    private bake_vector_b: vec3 = new vec3();
    private bake_vector_c: vec3 = new vec3();  // c is b - a
    private bake_vector_a_normalized: vec3 = new vec3();  // normalized 2d-vectors along edges of the uv-triangle
    private bake_vector_b_normalized: vec3 = new vec3();  // use only x and z coordinates, y = 0.0
    private bake_vector_c_normalized: vec3 = new vec3();
    private is_bake: boolean = false;

    /*input paramters are:
        positions - array of the length 9, coordinates of the first point, next of the second and last of the third
        uvs - array of the length 6, 2 coordinates per vertex
        normals - array of the length 9
    if uvs are zero-lengh array, then we set all uvs = (0, 0)
    the same for normals, if there are no normals, then we use face normal with flat shading
    */
    constructor(positions: Float64Array, uvs: Float64Array, normals: Float64Array, _material: material, _culling: boolean = false) {
        super();

        this.p0 = new vec3(unchecked(positions[0]), unchecked(positions[1]), unchecked(positions[2]));
        this.p1 = new vec3(unchecked(positions[3]), unchecked(positions[4]), unchecked(positions[5]));
        this.p2 = new vec3(unchecked(positions[6]), unchecked(positions[7]), unchecked(positions[8]));
        this.culling = _culling;

        this.mat_ptr = _material;

        this.m_ab = subtract(this.p1, this.p0);
        this.m_ac = subtract(this.p2, this.p0);

        let cross_vector = cross(this.m_ab, this.m_ac);
        this.area = cross_vector.length() / 2.0;
        this.face_normal = unit_vector(cross_vector).negate();

        //save uvs
        if(uvs.length == 6){
            this.u0 = unchecked(uvs[0]); this.v0 = unchecked(uvs[1]);
            this.u1 = unchecked(uvs[2]); this.v1 = unchecked(uvs[3]);
            this.u2 = unchecked(uvs[4]); this.v2 = unchecked(uvs[5]);
        }
        else{
            this.u0 = 0.0; this.v0 = 0.0;
            this.u1 = 0.0; this.v1 = 0.0;
            this.u2 = 0.0; this.v2 = 0.0;
        }
        if(normals.length == 9){
            this.n0 = unit_vector(new vec3(unchecked(normals[0]), unchecked(normals[1]), unchecked(normals[2])));
            this.n1 = unit_vector(new vec3(unchecked(normals[3]), unchecked(normals[4]), unchecked(normals[5])));
            this.n2 = unit_vector(new vec3(unchecked(normals[6]), unchecked(normals[7]), unchecked(normals[8])));
            this.use_normals = true;
        }
        else{
            this.n0 = this.face_normal;
            this.n1 = this.face_normal;
            this.n2 = this.face_normal;
            this.use_normals = false;
        }
    }

    set_bake_uv(uvs: Float64Array): void{
        if(uvs.length == 6){
            this.is_bake = true;
            this.bake_u0 = unchecked(uvs[0]); this.bake_v0 = unchecked(uvs[1]);
            this.bake_u1 = unchecked(uvs[2]); this.bake_v1 = unchecked(uvs[3]);
            this.bake_u2 = unchecked(uvs[4]); this.bake_v2 = unchecked(uvs[5]);

            this.bake_vector_a = new vec3(this.bake_u1 - this.bake_u0, 0.0, this.bake_v1 - this.bake_v0);
            this.bake_vector_b = new vec3(this.bake_u2 - this.bake_u0, 0.0, this.bake_v2 - this.bake_v0);
            this.bake_vector_c = new vec3(this.bake_u2 - this.bake_u1, 0.0, this.bake_v2 - this.bake_v1);
            this.bake_vector_a_normalized = unit_vector(this.bake_vector_a);
            this.bake_vector_b_normalized = unit_vector(this.bake_vector_b);
            this.bake_vector_c_normalized = unit_vector(this.bake_vector_c);
        }
    }

    @inline
    get_bake_origin(): vec3{
        return new vec3(this.bake_u0, 0.0, this.bake_v0);
    }

    //x and z are coordinates of the point (not the vector)
    //return only coefficient
    @inline
    get_bake_a_projection(x: f64, z: f64): f64{
        return this.bake_vector_a_normalized.x() * (x - this.bake_u0) + this.bake_vector_a_normalized.z() * (z - this.bake_v0);
    }

    @inline
    get_bake_b_projection(x: f64, z: f64): f64{
        return this.bake_vector_b_normalized.x() * (x - this.bake_u0) + this.bake_vector_b_normalized.z() * (z - this.bake_v0);
    }

    @inline
    get_bake_c_projection(x: f64, z: f64): f64{
        return this.bake_vector_c_normalized.x() * (x - this.bake_u1) + this.bake_vector_c_normalized.z() * (z - this.bake_v1);
    }

    @inline
    get_bake_a(): vec3{
        return this.bake_vector_a;
    }

    @inline
    get_bake_a_normalized(): vec3{
        return this.bake_vector_a_normalized;
    }

    @inline
    get_bake_b(): vec3{
        return this.bake_vector_b;
    }

    @inline
    get_bake_b_normalized(): vec3{
        return this.bake_vector_b_normalized;
    }

    @inline
    get_bake_c(): vec3{
        return this.bake_vector_c;
    }

    @inline
    get_bake_c_normalized(): vec3{
        return this.bake_vector_c_normalized;
    }

    //return baricentric coordinate with index of the point (x, 0.0, z) in the triangle
    //if index = 0, then return first coordinate, if index = 1 - second coordinate
    //coordinate is simply dot product of the vector_a (or vector_b) with vector to the point
    @inline
    get_bake_baricentric_coordinate(x: f64, z: f64, index: i32): f64{
        const p_x = x - this.bake_u0;
        const p_z = z - this.bake_v0;
        const d = this.bake_vector_b.z() * this.bake_vector_a.x() - this.bake_vector_b.x() * this.bake_vector_a.z();
        if(index == 0){
            return (this.bake_vector_b.z() * p_x - this.bake_vector_b.x() * p_z) / d;
        }
        else{
            return (this.bake_vector_a.x() * p_z - this.bake_vector_a.z() * p_x) / d;
        }
    }

    //return position on the 2d-plane with given baricentric coordinates
    @inline
    get_bake_point(baricentric_a: f64, baricentric_b: f64): vec3{
        return new vec3(this.bake_vector_a.x() * baricentric_a + this.bake_vector_b.x() * baricentric_b + this.bake_u0, 
                        0.0,
                        this.bake_vector_a.z() * baricentric_a + this.bake_vector_b.z() * baricentric_b + this.bake_v0);
    }

    //inputs are coefficient for the point in secondary uv space
    @inline
    get_position_from_bake_baricentric(baricentric_a: f64, baricentric_b: f64): vec3{
        //we should simply return position in the real triangle with the same baricentric coordinates
        let value_01 = scale(baricentric_a, this.m_ab);
        let value_02 = scale(baricentric_b, this.m_ac);
        let value_03 = add(this.p0, value_01);
        return add(value_03, value_02);
    }

    @inline
    get_normal_from_bake_baricentric(baricentric_a: f64, baricentric_b: f64): vec3{
        //we should simply return position in the real triangle with the same baricentric coordinates
        if(this.use_normals){
            const baricentric_c = 1.0 - baricentric_a - baricentric_b;
            return unit_vector(new vec3(
                                        baricentric_a * this.n1.x() + baricentric_b * this.n2.x() + baricentric_c * this.n0.x(),
                                        baricentric_a * this.n1.y() + baricentric_b * this.n2.y() + baricentric_c * this.n0.y(),
                                        baricentric_a * this.n1.z() + baricentric_b * this.n2.z() + baricentric_c * this.n0.z(),
                                        ));
        }
        else{
            return this.face_normal;
        }
    }

    @inline
    set_uv_from_bake_baricentric(baricentric_a: f64, baricentric_b: f64, rec: hit_record): void{
        const baricentric_c = 1.0 - baricentric_a - baricentric_b;
        rec.u = baricentric_c * this.u0 + baricentric_a * this.u1 + baricentric_b * this.u2;
        rec.v = baricentric_c * this.v0 + baricentric_a * this.v1 + baricentric_b * this.v2;
    }

    @inline
    get_material(): material{
        return this.mat_ptr;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        let pvec = scale(-1.0, cross(r.direction(), this.m_ac));
        const det = dot(this.m_ab, pvec);
        if(this.culling){
            if (det < delta){
                 return false;
            }
        }
        else{
            if (Math.abs(det) < delta){
                 return false;
            }
        }
        const inv_det = 1 / det; 
        let tvec = subtract(r.origin(), this.p0);
        const u = dot(tvec, pvec) * inv_det;
        if (u < 0 || u > 1){
            return false;
        }
        let qvec = scale(-1.0, cross(tvec, this.m_ab));
        const v = dot(r.direction(), qvec) * inv_det;
        if (v < 0 || u + v > 1){
            return false;
        }
        const t = dot(this.m_ac, qvec) * inv_det;

        //finally we find intersection point
        //on the ray it has parameter t
        //on the triangle barictentric coordinates (u, v)
        if(t < t_min || t > t_max){
            return false;
        }
        rec.t = t;
        rec.p = r.at(rec.t);
        //calculate normal
        if(this.use_normals){
            //use simple interpolation between vertex normals
            rec.set_face_normal(r, unit_vector(new vec3(
                u * this.n1.x() + v * this.n2.x() + (1 - u - v) * this.n0.x(),
                u * this.n1.y() + v * this.n2.y() + (1 - u - v) * this.n0.y(),
                u * this.n1.z() + v * this.n2.z() + (1 - u - v) * this.n0.z(),
                )));
        }
        else{
            rec.set_face_normal(r, this.face_normal);
        }
        rec.u = this.u0 + u * this.u1 + v * this.u2;
        rec.v = this.v0 + u * this.v1 + v * this.v2;
        rec.mat_ptr = this.mat_ptr;
        return true;
    }

    bounding_box(output_box: aabb): bool{
        const mix = Math.min(this.p0.x(), this.p1.x());
        const miy = Math.min(this.p0.y(), this.p1.y());
        const miz = Math.min(this.p0.z(), this.p1.z());
        const x_min = Math.min(mix, this.p2.x()) - 0.001;
        const y_min = Math.min(miy, this.p2.y()) - 0.001;
        const z_min = Math.min(miz, this.p2.z()) - 0.001;

        const max = Math.max(this.p0.x(), this.p1.x());
        const may = Math.max(this.p0.y(), this.p1.y());
        const maz = Math.max(this.p0.z(), this.p1.z());
        const x_max = Math.max(max, this.p2.x()) + 0.001;
        const y_max = Math.max(may, this.p2.y()) + 0.001;
        const z_max = Math.max(maz, this.p2.z()) + 0.001;
        let new_box = new aabb(new vec3(x_min, y_min, z_min),
                               new vec3(x_max, y_max, z_max));
        output_box.clone_from(new_box);
        return true;
    }

    bake_uv_bounding_box(output_box: aabb, padding: f64): bool{
        if(!this.is_bake){
            return false;
        }
        const u_min_temp = Math.min(this.bake_u0, this.bake_u1);
        const u_min = Math.min(u_min_temp, this.bake_u2);
        const v_min_temp = Math.min(this.bake_v0, this.bake_v1);
        const v_min = Math.min(v_min_temp, this.bake_v2);

        const u_max_temp = Math.max(this.bake_u0, this.bake_u1);
        const u_max = Math.max(u_max_temp, this.bake_u2);
        const v_max_temp = Math.max(this.bake_v0, this.bake_v1);
        const v_max = Math.max(v_max_temp, this.bake_v2);
        output_box.clone_from(new aabb(new vec3(u_min - padding, -padding, v_min - padding),
                                       new vec3(u_max + padding, padding, v_max + padding)));
        return true;
    }

    pdf_value(o: vec3, v: vec3): f64{
        let rec = new hit_record();
        if(!this.hit(new ray(o, v), 0.001, infinity, rec)){
            return 0.0;
        }

        const distance_suqared = rec.t * rec.t * v.length_squared();
        const cosine = Math.abs(dot(v, rec.normal)) / v.length();

        return distance_suqared / (cosine * this.area);
    }

    random(o: vec3): vec3{
        let random_vector = add(scale(random_double(), this.m_ab), scale(random_double(), this.m_ac));
        let random_point = add(this.p0, random_vector);
        return subtract(random_point, o);
    }

    toString(): string{
        return "<" + this.p0.toString() + "-" + this.p1.toString() + "-" + this.p2.toString() + ">";
    }

    second_uv_toString(): string{
        return "<(" + this.bake_u0.toString() + ", " + this.bake_v0.toString() + ") - (" + 
                      this.bake_u1.toString() + ", " + this.bake_v1.toString() + ") - (" + 
                      this.bake_u2.toString() + ", " + this.bake_v2.toString() + ")>";
    }
}

//this class is used only for triangles on uv-space for baking process
export class triangle_2d extends hittable {
    private source_triangle: triangle;
    private padding: f64;

    //padding in uv-coordinates (from 0.0 to 1.0)
    constructor(src: triangle, padding: f64 = 0.1) {
        super();
        this.source_triangle = src;
        this.padding = padding;
    }

    hit(r: ray, t_min: f64, t_max: f64, rec: hit_record): bool{
        //we should find the point in the triangle, close to the given sample
        //if this point outside of the triangle, return false
        //if inside, then we should set to t in the hit_record the distance to the point
        //as a result we retrun the closest point
        let o = r.origin();
        let baricentric_u = this.source_triangle.get_bake_baricentric_coordinate(o.x(), o.z(), 0);
        let baricentric_v = this.source_triangle.get_bake_baricentric_coordinate(o.x(), o.z(), 1);
        let baricentric_w = 1.0 - baricentric_u - baricentric_v;
        if(!(baricentric_u >= 0.0 && baricentric_u <= 1.0 &&
           baricentric_v >= 0.0 && baricentric_v <= 1.0 &&
           baricentric_w >=0.0 && baricentric_w <= 1.0)){
            //we should recalculate new baricentric coordinates to obtain the closest point in the triangle
            //our triangle is ABC, where C is start point
            if(baricentric_u >= 0.0 && baricentric_v <= 0.0 && baricentric_w <= 0.0){
                //closest is A
                baricentric_u = 1.0;
                baricentric_v = 0.0;
                baricentric_w = 0.0;
            }
            else if(baricentric_u <= 0.0 && baricentric_v >= 0.0 && baricentric_w <= 0.0){
                //closest is B
                baricentric_u = 0.0;
                baricentric_v = 1.0;
                baricentric_w = 0.0;
            }
            else if(baricentric_u <= 0.0 && baricentric_v <= 0.0 && baricentric_w >= 0.0){
                //closest is C
                baricentric_u = 0.0;
                baricentric_v = 0.0;
                baricentric_w = 1.0;
            }
            else if(baricentric_u <= 0.0 && baricentric_v >= 0.0 && baricentric_w >= 0.0){
                //close on BC
                baricentric_u = 0.0;
                const c = this.source_triangle.get_bake_b_projection(o.x(), o.z());
                let p = add(this.source_triangle.get_bake_origin(), scale(c, this.source_triangle.get_bake_b_normalized()));
                baricentric_v = this.source_triangle.get_bake_baricentric_coordinate(p.x(), p.z(), 1);
                baricentric_w = 1.0 - baricentric_v;
            }
            else if(baricentric_u >= 0.0 && baricentric_v <= 0.0 && baricentric_w >= 0.0){
                //close on AC
                const c = this.source_triangle.get_bake_a_projection(o.x(), o.z());
                let p = add(this.source_triangle.get_bake_origin(), scale(c, this.source_triangle.get_bake_a_normalized()));
                baricentric_u = this.source_triangle.get_bake_baricentric_coordinate(p.x(), p.z(), 0);
                baricentric_v = 0.0;
                baricentric_w = 1.0 - baricentric_u;
            }
            else if(baricentric_u >= 0.0 && baricentric_v >= 0.0 && baricentric_w <= 0.0){
                //close on AB
                const c = this.source_triangle.get_bake_c_projection(o.x(), o.z());
                let temp_p = add(this.source_triangle.get_bake_origin(), this.source_triangle.get_bake_a());
                let p = add(temp_p, scale(c, this.source_triangle.get_bake_c_normalized()));
                baricentric_u = this.source_triangle.get_bake_baricentric_coordinate(p.x(), p.z(), 0);
                baricentric_v = this.source_triangle.get_bake_baricentric_coordinate(p.x(), p.z(), 1);
                baricentric_w = 1.0 - baricentric_u - baricentric_v;
            }
            else{
                //impossible case
                return false;
            }
        }
        else{
            
        }
        let final_point = this.source_triangle.get_bake_point(baricentric_u, baricentric_v);
        //point inside triangle
        //we should return point in the 3d-space, material, normal and so on
        const d = distance(o, final_point);
        if(d >= t_min && d <= t_max){
            rec.t = distance(o, final_point);
            rec.p = this.source_triangle.get_position_from_bake_baricentric(baricentric_u, baricentric_v);
            rec.normal = this.source_triangle.get_normal_from_bake_baricentric(baricentric_u, baricentric_v);
            rec.front_face = true;
            //also we should calculate first uv-coordinates
            this.source_triangle.set_uv_from_bake_baricentric(baricentric_u, baricentric_v, rec);
            rec.mat_ptr = this.source_triangle.get_material();
            return true;
        }
        else{
            return false;
        }
    }

    bounding_box(output_box: aabb): bool{
        return this.source_triangle.bake_uv_bounding_box(output_box, this.padding);
    }
}