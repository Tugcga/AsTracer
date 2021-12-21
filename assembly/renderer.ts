import { hittable_list } from "./hittable_list";
import { hit_record, hittable } from "./hittable";
import { bvh_node } from "./bvh";
import { light, point_light, directional_light } from "./light";
import { camera } from "./camera";
import { vec3, add, subtract, scale, mult, unit_vector } from "./vec3";
import { texture, solid_color, gradient_texture, checker_texture, checker_texture_2d, noise_texture, noise_texture_2d, uv_texture, image_texture, image_texture_hdr } from "./texture";
import { sphere } from "./sphere";
import { xy_rect, xz_rect, yz_rect } from "./aarect";
import { box } from "./box";
import { material, scatter_record, lambertian, metal, dielectric, simple_combined, diffuse_light } from "./material";
import { ray } from "./ray";
import { random_double, random_double_range, infinity, clamp, clamp_i32, log_message, delta } from "./utilities";
import { hittable_pdf, mixture_pdf } from "./pdf";
import { triangle, triangle_2d } from "./triangle";
import { linear_to_srgb, value_linear_to_srgb } from "./color";

declare function start_prepare(): void;
declare function finish_prepare(): void;
declare function start_render(): void;
declare function finish_render(): void;
declare function render_process(row: i32, scanline: Float64Array): void;

export const Float64Array_ID = idof<Float64Array>()
export const Uint8Array_ID = idof<Uint8Array>()

const enum CallbackType {
    start_prepare = 1,
    finish_prepare = 2,
    start_render = 3,
    finish_render = 4,
    render_process = 5
};

export class renderer{
    private m_aspect_ratio: f64;
    private m_image_width: i32;
    private m_image_height: i32;
    private m_max_depth: i32;
    private m_samples: i32;
    private m_objects: hittable_list = new hittable_list();
    private m_lights: Array<light> = new Array<light>(0);
    private m_lights_count: i32 = 0;
    private m_sample_attractor: hittable_list = new hittable_list();
    private m_look_from: vec3 = new vec3();
    private m_look_to: vec3 = new vec3();
    private m_fov: f64;
    private m_aperture: f64;
    private m_background: texture = solid_color.mono(0.0);
    private m_render_buffer: Float64Array = new Float64Array(0);
    private m_camera: camera;
    private m_bake_triangles: Array<hittable> = new Array<hittable>(0);
    private m_bake_triangles_count: i32;
    private m_array: Array<light> = new Array<light>(0);
    private m_bake_padding: f64 = 0.1;

    constructor() {
        this.m_lights = new Array<light>(10);
        this.m_bake_triangles = new Array<hittable>(10);
        this.m_camera = new camera(this.m_look_from, this.m_look_to, new vec3(0.0, 1.0, 0.0), this.m_fov, this.m_aspect_ratio, this.m_aperture, 0.0);
        this.reset();
    }

    reset(): void{
        this.m_aspect_ratio = 1.0;
        this.m_image_width = 0;
        this.m_image_height = 0;
        this.m_max_depth = 1;
        this.m_samples = 1;
        this.m_look_from = new vec3();
        this.m_look_to = new vec3();
        this.m_fov = 45.0;
        this.m_aperture = 0.0;
        this.m_background = solid_color.mono(0.0);
        this.m_render_buffer = new Float64Array(0);
        this.m_objects.clear();
        this.m_sample_attractor.clear();
        this.m_lights_count = 0;
        this.m_bake_triangles_count = 0;
        this.m_bake_padding = 0.1;
    }

    get_objects_count(): i32{
        return this.m_objects.get_count();
    }

    set_bake_padding(value: f64): void{
        this.m_bake_padding = value;
    }

    get_bake_padding(): f64{
        return this.m_bake_padding;
    }

    get_aspect_ratio(): f64{
        return this.m_aspect_ratio;
    }

    get_fov(): f64{
        return this.m_fov;
    }

    get_aperture(): f64{
        return this.m_aperture;
    }

    set_image_size(width: i32, height: i32): void{
        this.m_image_width = width < 1 ? 1 : width;
        this.m_image_height = height < 1 ? 1 : height;

        //update the camera
        this.m_aspect_ratio = <f64>this.m_image_width / <f64>this.m_image_height;
        this.m_camera = new camera(this.m_look_from, 
                                   this.m_look_to, 
                                   new vec3(0.0, 1.0, 0.0), 
                                   this.m_fov, 
                                   this.m_aspect_ratio, 
                                   this.m_aperture, 
                                   subtract(this.m_look_to, this.m_look_from).length());
    }

    get_image_size(): Int32Array{
        let to_return = new Int32Array(2);
        to_return[0] = this.m_image_width;
        to_return[1] = this.m_image_height;
        return to_return
    }

    set_camera_short(from_x: f64, from_y: f64, from_z: f64,
                     to_x: f64, to_y: f64, to_z: f64,
                     fov: f64 = 45.0, aperture: f64 = 0.0): void{
        this.set_camera(from_x, from_y, from_z, to_x, to_y, to_z, fov, aperture);
    }

    set_camera(from_x: f64, from_y: f64, from_z: f64,
               to_x: f64, to_y: f64, to_z: f64,
               fov: f64, aperture: f64): void{  // wasmer for Python, for example, can not use values by default, so, we should set all parameters
        this.m_aspect_ratio = <f64>this.m_image_width / <f64>this.m_image_height;
        this.m_look_from = new vec3(from_x, from_y, from_z);
        this.m_look_to = new vec3(to_x, to_y, to_z);
        this.m_fov = fov;
        this.m_aperture = aperture;

        this.m_camera = new camera(this.m_look_from, 
                                   this.m_look_to, 
                                   new vec3(0.0, 1.0, 0.0), 
                                   this.m_fov, 
                                   this.m_aspect_ratio, 
                                   this.m_aperture, 
                                   subtract(this.m_look_to, this.m_look_from).length());
    }

    set_background(back_texture: texture): void{
        this.m_background = back_texture;
    }

    private add_sample_attractor(object: hittable): void{
        this.m_sample_attractor.add(object);
    }

    @inline
    private add_light(l: light): void{
        if(!(this.m_lights_count < this.m_lights.length)){
            let new_array = new Array<light>(this.m_lights_count + this.m_lights_count / 2);
            for(let i = 0; i < this.m_lights.length; i++){
                unchecked(new_array[i] = this.m_lights[i]);
            }
            this.m_lights = new_array;
        }
        unchecked(this.m_lights[this.m_lights_count] = l);
        this.m_lights_count++;
        //this.m_lights.push(l);
    }

    add_point_light(x: f64, y: f64, z: f64,
                    r: f64, g: f64, b: f64): void{
        this.add_light(new point_light(new vec3(r, g, b), new vec3(x, y, z)));
    }

    add_directional_light(x: f64, y: f64, z: f64,
                          dir_x: f64, dir_y: f64, dir_z: f64,
                          r: f64, g: f64, b: f64): void{
        this.add_light(new directional_light(new vec3(r, g, b), new vec3(x, y, z), new vec3(dir_x, dir_y, dir_z)));
    }

    add_sphere(center_x: f64, center_y: f64, center_z: f64, radius: f64, material: material, is_attractor: bool): void{
        let new_object = new sphere(new vec3(center_x, center_y, center_z), radius, material)
        this.m_objects.add(new_object);
        if(is_attractor){
            this.add_sample_attractor(new_object);
        }
    }

    add_x_plane(min_y: f64, min_z: f64, max_y: f64, max_z: f64, x: f64, material: material, is_attractor: bool): void{
        let new_object = new yz_rect(min_y, max_y, min_z, max_z, x, material)
        this.m_objects.add(new_object);
        if(is_attractor){
            this.add_sample_attractor(new_object);
        }
    }

    add_y_plane(min_x: f64, min_z: f64, max_x: f64, max_z: f64, y: f64, material: material, is_attractor: bool): void{
        let new_object = new xz_rect(min_x, max_x, min_z, max_z, y, material);
        this.m_objects.add(new_object);
        if(is_attractor){
            this.add_sample_attractor(new_object);
        }
    }

    add_z_plane(min_x: f64, min_y: f64, max_x: f64, max_y: f64, z: f64, material: material, is_attractor: bool): void{
        let new_object = new xy_rect(min_x, max_x, min_y, max_y, z, material);
        this.m_objects.add(new_object);
        if(is_attractor){
            this.add_sample_attractor(new_object);
        }
    }

    add_cube(min_x: f64, min_y: f64, min_z: f64,
             max_x: f64, max_y: f64, max_z: f64,
             material: material, is_attractor: bool): void{
        this.m_objects.add(new box(new vec3(min_x, min_y, min_z), new vec3(max_x, max_y, max_z), material));
    }

    @inline
    private add_bake_triangle(t: triangle_2d): void{
        if(!(this.m_bake_triangles_count < this.m_bake_triangles.length)){
            let new_array = new Array<hittable>(this.m_bake_triangles_count + this.m_bake_triangles_count / 2);
            for(let i = 0; i < this.m_bake_triangles.length; i++){
                unchecked(new_array[i] = this.m_bake_triangles[i]);
            }
            this.m_bake_triangles = new_array;
        }
        unchecked(this.m_bake_triangles[this.m_bake_triangles_count] = t);
        this.m_bake_triangles_count++;
    }

    /*
    the number of vertices values should be 3x
    if uvs or normals are ampty or contains incorrect vaues count, then ignore it
    */
    add_polygonmesh_short(vertices: Float64Array,
                    material: material,
                    normals: Float64Array = new Float64Array(0),
                    uvs: Float64Array = new Float64Array(0),
                    uvs_second: Float64Array = new Float64Array(0),
                    is_bake: bool = false,
                    culling: bool = false,
                    is_attractor: bool = false): void{
        this.add_polygonmesh(vertices, normals, uvs, material, culling, is_attractor, is_bake, uvs_second);
    }
    
    add_polygonmesh(vertices: Float64Array,
                    normals: Float64Array,
                    uvs: Float64Array,
                    material: material,
                    culling: bool,
                    is_attractor: bool,
                    is_bake: bool,
                    uvs_second: Float64Array): void{
        const points_count = vertices.length / 3;
        const triangles_count = points_count / 3;
        const use_uvs = uvs.length == triangles_count * 6;
        const use_normals = normals.length == triangles_count * 9;

        let empty_array = new Float64Array(0);
        if(is_bake && uvs_second.length != triangles_count * 6){
            is_bake = false;
            log_message("fail to use object as bake source, because there are no second uvs");
        }
        for(let i = 0; i < triangles_count; i++){
            let t = new triangle(vertices.slice(9*i, 9*(i + 1)),
                                 use_uvs ? uvs.slice(6*i, 6*(i+1)) : empty_array,
                                 use_normals ? normals.slice(9*i, 9*(i+1)) : empty_array,
                                 material, culling);
            if(is_attractor){
                this.add_sample_attractor(t);
            }
            this.m_objects.add(t);
            if(is_bake){
                t.set_bake_uv(uvs_second.slice(6*i, 6*(i+1)));
                this.add_bake_triangle(new triangle_2d(t, this.m_bake_padding));
            }
        }
    }

    private ray_color_process(
              rec: hit_record,
              r: ray, 
              world: hittable,
              depth: i32,
              ignore_direct: bool = false): vec3{
        const branches = rec.mat_ptr.get_branches_count();
        let branch_colors = new Array<vec3>(branches);
        let branch_coefficients = new Array<f64>(branches);
        for(let b_index = 0; b_index < branches; b_index++){
            const b_coefficient = rec.mat_ptr.get_branch_coefficient(rec.u, rec.v, rec.p, b_index);
            branch_coefficients[b_index] = b_coefficient;
            if(b_coefficient > delta){
                let srec = new scatter_record();
                let emitted = rec.mat_ptr.emitted(r, rec, rec.u, rec.v, rec.p, b_index);
                if(!rec.mat_ptr.scatter(r, rec, srec, b_index)){
                    branch_colors[b_index] = emitted;
                }
                else{
                    //check shadows
                    let light_rec = new hit_record();
                    let light_attenuation = new vec3();
                    if(!ignore_direct){
                        for(let i = 0, len = this.m_lights_count; i < len; i++){
                            //create ray to the light
                            let light = unchecked(this.m_lights[i]);
                            let to_light_direction = light.get_to_light(rec.p);
                            let to_light_ray = new ray(rec.p, to_light_direction);
                            const to_light_distance = light.get_distance(rec.p);
                            if(world.hit(to_light_ray, 0.001, to_light_distance, light_rec)){
                                //the sample in the shadow of the light
                                //nothing to do
                            }
                            else{
                                //the sample visible from the light
                                //increase light attenuation
                                light_attenuation.add_inplace(scale(light.get_attenuation(rec.normal, rec.p), light.get_color()));
                            }
                        }
                    }

                    let sample_light_attenuation = mult(srec.attenuation, light_attenuation);  // this is zero for ignore direct light mode

                    if(srec.is_specular){
                        let spec_color = mult(srec.attenuation, this.ray_color(srec.specular_ray, world, depth - 1));
                        branch_colors[b_index] = spec_color;
                        //return mult(srec.attenuation, this.ray_color(srec.specular_ray, world, depth - 1));
                    }
                    else{
                        let attractor_pdf = new hittable_pdf(this.m_sample_attractor, rec.p);
                        let p = this.m_sample_attractor.get_count() > 0 ? new mixture_pdf(attractor_pdf, srec.pdf_ptr) : srec.pdf_ptr;

                        let scattered = new ray(rec.p, p.generate());
                        const pdf_value = p.value(scattered.direction());

                        let next_color = this.ray_color(scattered, world, depth - 1);
                        if(ignore_direct){
                            branch_colors[b_index] = next_color;
                            //return next_color;
                        }
                        else{
                            const scale_coefficient = rec.mat_ptr.scattering_pdf(r, rec, scattered, b_index);
                        
                            const value_01 = scale(scale_coefficient, next_color);
                            const value_02 = add(emitted, scale(1.0 / pdf_value, mult(srec.attenuation, value_01)));
                            let out_color = add(sample_light_attenuation, value_02);
                            branch_colors[b_index] = out_color;
                            //return add(sample_light_attenuation, value_02);
                        }
                    }
                }
            }
            else{
                branch_colors[b_index] = new vec3();
            }
        }
        let to_return = new vec3();
        for(let i = 0; i < branches; i++){
            let color = branch_colors[i];
            const c = branch_coefficients[i];
            to_return.add_inplace_values(color.x() * c, color.y() * c, color.z() * c);
        }
        return to_return;
    }

    private ray_color(r: ray, 
              world: hittable,
              depth: i32): vec3{
        let rec: hit_record = new hit_record();

        if(depth <= 0){
            return new vec3(0.0, 0.0, 0.0);
        }

        if(!world.hit(r, 0.001, infinity, rec)){
            //return background;
            let r_unit = unit_vector(r.direction());
            let uvw = sphere.get_sphere_uv(r_unit);
            return this.m_background.value(uvw.x(), uvw.y(), new vec3());
        }

        return this.ray_color_process(rec, r, world, depth);
    }

    private fire_callback(callback_type: i32, value: i32 = 0): void{
        if(callback_type == CallbackType.start_prepare){
            start_prepare();
        }
        else if(callback_type == CallbackType.finish_prepare){
            finish_prepare();
        }
        else if(callback_type == CallbackType.start_render){
            start_render();
        }
        else if(callback_type == CallbackType.finish_render){
            finish_render();
        }
        else if(callback_type == CallbackType.render_process){
            render_process(value, this.m_render_buffer.slice(value * this.m_image_width * 3, (value + 1) * this.m_image_width * 3));
        }
        else{
            //unknown callback, ignore it
        }
    }

    //bounds = 0 - only direct illumination
    render_short(samples: i32, bounds: i32 = 0): void{
        this.render(samples, bounds);
    }

    render(samples: i32, bounds: i32): void{
        this.m_samples = samples;
        this.m_max_depth = bounds + 1;
        this.fire_callback(CallbackType.start_prepare);
        let world = new bvh_node(this.m_objects.get_objects(), this.m_objects.get_count());
        let pixel_index = 0;
        let color_scale = 1.0 / <f64>this.m_samples;
        this.m_render_buffer = new Float64Array(this.m_image_width * this.m_image_height * 3);
        this.fire_callback(CallbackType.finish_prepare);
        this.fire_callback(CallbackType.start_render);
        let row_index = 0;
        for(let j = this.m_image_height - 1; j >= 0; j--){
        //for(let j = 160; j >= 160; j--){
            for(let i = 0; i < this.m_image_width; i++){
            //for(let i = 120; i < 121; i++){
                let pixel_color = new vec3(0.0, 0.0, 0.0);
                for(let s = 0; s < this.m_samples; s++){
                    const u = (i + random_double()) / (this.m_image_width - 1);
                    const v = (j + random_double()) / (this.m_image_height - 1);

                    const r: ray = this.m_camera.get_ray(u, v);
                    pixel_color.add_inplace(this.ray_color(r, world, this.m_max_depth));
                }
                unchecked(this.m_render_buffer[3*pixel_index] = pixel_color.x() * color_scale);
                unchecked(this.m_render_buffer[3*pixel_index + 1] = pixel_color.y() * color_scale);
                unchecked(this.m_render_buffer[3*pixel_index + 2] = pixel_color.z() * color_scale);
                pixel_index++;
            }
            this.fire_callback(CallbackType.render_process, row_index);
            row_index++;
        }
        this.fire_callback(CallbackType.finish_render);
    }

    bake_short(samples: i32, bounds: i32 = 0, ignore_direct_lighting: bool =false): void{
        this.bake(samples, bounds, ignore_direct_lighting);
    }

    bake(samples: i32, bounds: i32, ignore_direct_lighting: bool): void{
        this.m_render_buffer = new Float64Array(this.m_image_width * this.m_image_height * 3);
        this.m_samples = samples;
        this.m_max_depth = bounds + 1;
        this.fire_callback(CallbackType.start_prepare);
        let bake_bvh = new bvh_node(this.m_bake_triangles, this.m_bake_triangles_count);
        let world = new bvh_node(this.m_objects.get_objects(), this.m_objects.get_count());
        const x_pixel = 1.0 / this.m_image_width;
        const y_pixel = 1.0 / this.m_image_height;
        let color_scale = 1.0 / <f64>this.m_samples;

        let pixel_index = 0;
        let row_index = 0;
        this.fire_callback(CallbackType.finish_prepare);
        this.fire_callback(CallbackType.start_render);
        for(let j = this.m_image_height - 1; j >= 0; j--){
            for(let i = 0; i < this.m_image_width; i++){
                let pixel_color = new vec3(0.0, 0.0, 0.0);
                for(let s = 0; s < this.m_samples; s++){
                    const u = random_double_range(0.0, x_pixel) + <f64>i / (this.m_image_width);
                    const v = random_double_range(0.0, y_pixel) + <f64>j / (this.m_image_height);

                    //take initial sample from uv
                    let bake_sample = new hit_record();
                    bake_sample.t = infinity;
                    let r = new ray(new vec3(u, 2.0 * this.m_bake_padding, v), new vec3(0.0, -1.0, 0.0));
                    let is_hit = bake_bvh.hit(r, 0.0, infinity, bake_sample);
                    if(is_hit){
                        pixel_color.add_inplace(this.ray_color_process(bake_sample, r, world, this.m_max_depth, ignore_direct_lighting));
                    }
                    else{
                        //no sample, fill by the black color
                    }
                }
                unchecked(this.m_render_buffer[3*pixel_index] = pixel_color.x() * color_scale);
                unchecked(this.m_render_buffer[3*pixel_index + 1] = pixel_color.y() * color_scale);
                unchecked(this.m_render_buffer[3*pixel_index + 2] = pixel_color.z() * color_scale);
                pixel_index++;
            }
            //ignore this callback for baking process, because we shouldnot update result during the bake process
            //this.fire_callback(CallbackType.render_process, row_index);
            row_index++;
        }
        this.fire_callback(CallbackType.finish_render);
    }

    get_render_buffer_short(is_linear: bool = true): Float64Array{
        return this.get_render_buffer(is_linear);
    }

    get_render_buffer(is_linear: bool): Float64Array{
        if(is_linear){
            //return raw buffer, it contains linear color
            return this.m_render_buffer;
        }
        else{
            let b = this.m_render_buffer;
            let srgb_buffer = new Float64Array(this.m_render_buffer.length);
            for(let i = 0, len = srgb_buffer.length; i < len; i++){
                unchecked(srgb_buffer[i] = value_linear_to_srgb(b[i]));
            }
            return srgb_buffer;
        }
    }
}

export function create_renderer(): renderer{
    return new renderer();
}

export function create_vector(x: f64, y: f64, z: f64): vec3{
    return new vec3(x, y, z);
}

export function float_colors_to_int8_colors(array: Float64Array): Int32Array{
    let to_return = new Int32Array(array.length);
    for(let i = 0, len = array.length; i < len; i++){
        to_return[i] = <i32>(clamp(array[i], 0.0, 0.99) * 256);
    }
    return to_return;
}

//--------------------------------------------------------
//create textures
//--------------------------------------------------------
//solid color
export function create_sold_color(r: f64, g: f64, b: f64): solid_color{
    return new solid_color(new vec3(r, g, b));
}

//checker texture
export function create_checker_texture(color_01: texture, color_02: texture, squares_u: f64, squares_v: f64, squares_w: f64): checker_texture{
    return new checker_texture(color_01, color_02, new vec3(squares_u, squares_v, squares_w));
}

//checker texture 2d
export function create_checker_2d_texture(color_01: texture, color_02: texture, squares_u: f64, squares_v: f64): checker_texture_2d{
    return new checker_texture_2d(color_01, color_02, squares_u, squares_v);
}

//noise texture
export function create_noise_texture(color_01: texture, color_02: texture, scale_u: f64, scale_v: f64, scale_w: f64): noise_texture{
    return new noise_texture(color_01, color_02, new vec3(scale_u, scale_v, scale_w));
}

//noise texture 2d
export function create_noise_2d_texture(color_01: texture, color_02: texture, scale_u: f64, scale_v: f64, scale_w: f64, z_slice: f64): noise_texture_2d{
    return new noise_texture_2d(color_01, color_02, new vec3(scale_u, scale_v, scale_w), z_slice);
}

//gradient texture
export function create_gradient_texture(color_01: texture, color_02: texture): gradient_texture{
    return new gradient_texture(color_01, color_02);
}

//uv texture
export function create_uv_texture(): uv_texture{
    return new uv_texture();
}

//image texture
export function create_image_texture(pixels: Uint8Array, width: i32, height: i32): image_texture{
    return new image_texture(pixels, width, height);
}

//image texture hdr
export function create_image_hdr_texture(pixels: Float64Array, width: i32, height: i32): image_texture_hdr{
    return new image_texture_hdr(pixels, width, height);
}

//--------------------------------------------------------
//create materials
//--------------------------------------------------------
//lambertian
export function create_lambertian_material(albedo: texture): lambertian{
    return new lambertian(albedo);
}

//metal
export function create_metal_material(albedo: texture, roughness: texture): metal{
    return new metal(albedo, roughness);
}

//dielectric
export function create_glass_material(ior: f64): dielectric{
    return new dielectric(ior);
}

//emission
export function create_emission_material(albedo: texture): diffuse_light{
    return new diffuse_light(albedo);
}

//simple combined
export function create_combined_material(albedo: texture, roughness: texture, emission: texture, emission_mask: texture, metal_mask: texture): simple_combined{
    return new simple_combined(albedo, roughness, emission, emission_mask, metal_mask);
}
