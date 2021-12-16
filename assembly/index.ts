import "wasi";
import { process } from "process";
import { Console, FileSystem, Descriptor } from "as-wasi";
import { vec3, add, scale, subtract, divide, mult, unit_vector, dot, random_in_hemisphere } from "./vec3";
import { color_string } from "./color"
import { ray } from "./ray";
import { sphere } from "./sphere";
import { hittable, hit_record } from "./hittable";
import { infinity, pi, random_double, random_double_range, /*gradient_img_texture, gradient_img_texture_hdr,*/ log_message, clamp } from "./utilities";
import { hittable_list } from "./hittable_list";
import { camera } from "./camera";
import { scatter_record, lambertian, metal, dielectric, diffuse_light, simple_combined } from "./material";
import { aabb } from "./aabb";
import { bvh_node } from "./bvh";
import { texture, solid_color, checker_texture, noise_texture, image_texture, gradient_texture, uv_texture, checker_texture_2d, image_texture_hdr, noise_texture_2d } from "./texture";
import { perlin } from "./perlin";
import { xy_rect, xz_rect, yz_rect } from "./aarect";
import { box } from "./box";
import { cosine_pdf, hittable_pdf, mixture_pdf } from "./pdf";
import { light, directional_light, point_light } from "./light";
import { triangle } from "./triangle";
import { renderer } from "./renderer";

function ray_color(r: ray, 
                   background: texture, 
                   world: hittable,
                   lights: Array<light>,
                   importance: hittable, 
                   depth: i32): vec3{
    let rec: hit_record = new hit_record();

    if(depth <= 0){
        return new vec3(0.0, 0.0, 0.0);
    }

    if(!world.hit(r, 0.001, infinity, rec)){
        //return background;
        let r_unit = unit_vector(r.direction());
        let uvw = sphere.get_sphere_uv(r_unit);
        return background.value(uvw.x(), uvw.y(), new vec3());
    }

    let srec = new scatter_record();
    let emitted = rec.mat_ptr.emitted(r, rec, rec.u, rec.v, rec.p);
    if(!rec.mat_ptr.scatter(r, rec, srec)){
        return emitted;
    }

    //check shadows
    let light_rec = new hit_record();
    let light_attenuation = new vec3();
    for(let i = 0, len = lights.length; i < len; i++){
        //create ray to the light
        let light = lights[i];
        let to_light_ray = new ray(rec.p, subtract(light.get_position(), rec.p));
        if(world.hit(to_light_ray, 0.001, 0.999, light_rec)){
            //the sample in the shadow of the light
            //nothing to do
        }
        else{
            //the sample visible from the light
            //increase light attenuation
            light_attenuation.add_inplace(scale(light.get_attenuation(rec.normal, rec.p), light.get_color()));
        }
    }

    let sample_light_attenuation = mult(srec.attenuation, light_attenuation);

    if(srec.is_specular){
        return mult(srec.attenuation, ray_color(srec.specular_ray, background, world, lights, importance, depth - 1));
    }
    let importance_pdf = new hittable_pdf(importance, rec.p);
    let p = importance.count() > 0 ? new mixture_pdf(importance_pdf, srec.pdf_ptr) : srec.pdf_ptr;

    let scattered = new ray(rec.p, p.generate());
    const pdf_value = p.value(scattered.direction());

    const value_01 = scale(rec.mat_ptr.scattering_pdf(r, rec, scattered), ray_color(scattered, background, world, lights, importance, depth - 1));
    const value_02 = add(emitted, scale(1.0 / pdf_value, mult(srec.attenuation, value_01)));
    return add(sample_light_attenuation, value_02);
}

function build_three_spheres(): hittable_list {
    let objects = new hittable_list();

    let checker = new checker_texture(new solid_color(new vec3(0.2, 0.3, 0.1)),
                                      new solid_color(new vec3(0.9, 0.9, 0.9)));
    const material_ground = new lambertian(checker);
    const material_center = new lambertian(new solid_color(new vec3(0.1, 0.2, 0.5)));
    const material_left = new dielectric(1.5);
    const material_right = new metal(solid_color.rgb(0.8, 0.6, 0.2), solid_color.mono(0.0));

    objects.add(new sphere(new vec3(0.0, -100.5, -1.0), 100.0, material_ground));
    objects.add(new sphere(new vec3(0.0, 0.0, -1.0), 0.5, material_center));
    objects.add(new sphere(new vec3(-1.0, 0.0, -1.0), 0.5, material_left));
    objects.add(new sphere(new vec3(-1.0, 0.0, -1.0), -0.45, material_left));
    //world.add(new sphere(new vec3(1.0, 0.0, -1.0), 0.5, material_right));
    objects.add(new moving_sphere(new vec3(1.0, 0.0, -1.0),
                                new vec3(1.0, 0.5, -1.0),
                                0.0, 1.0,
                                0.5, material_right));
    return objects;
}

function build_quad_spheres(count: i32, quad_size: f64): hittable_list {
    let objects = new hittable_list();

    let mat_ground = new lambertian(new solid_color(new vec3(0.8, 0.8, 0.0)));
    let mat_sphere_01 = new lambertian(new solid_color(new vec3(0.1, 0.2, 0.5)));
    let mat_sphere_02 = new metal(solid_color.rgb(0.7, 0.1, 0.3), solid_color.mono(0.1));

    const r: f64 = quad_size / <f64>(2.0 * (count - 1));

    //objects.add(new sphere(new vec3(0.0, -100.5, -1.0), 100.0, mat_ground));
    objects.add(new xz_rect(-2.0*quad_size, 2.0*quad_size, -2.0*quad_size, 2.0*quad_size, -0.5, mat_ground));
    for(let i = 0; i < count; i++){
        for(let j = 0; j < count; j++){
            let p = new vec3(-quad_size/2.0 + j*2.0*r, r - 0.5, -quad_size/2.0 + i*2.0*r);
            if(Math.random() > 0.5){
                objects.add(new sphere(p, r, mat_sphere_01));
            }
            else{
                objects.add(new sphere(p, r, mat_sphere_01));
            }
        }
    }
    return objects;
}

function build_two_spheres(): hittable_list{
    let objects = new hittable_list();

    let checker = new checker_texture(new solid_color(new vec3(0.2, 0.3, 0.1)),
                                      new solid_color(new vec3(0.9, 0.9, 0.9)));
    objects.add(new sphere(new vec3(0.0, -10.0, 0.0), 10.0, new lambertian(checker)));
    objects.add(new sphere(new vec3(0.0, 10.0, 0.0), 10.0, new lambertian(checker)));

    return objects;
}

function build_two_perlin_spheres(): hittable_list {
    let objects = new hittable_list();

    let pertext = new noise_texture(solid_color.rgb(1.0, 1.0, 1.0));
    objects.add(new sphere(new vec3(0.0, -1000.0, 0.0), 1000.0, new lambertian(pertext)));
    objects.add(new sphere(new vec3(0.0, 2.0, 0.0), 2.0, new lambertian(pertext)));

    return objects;
}

function build_texture_sphere(): hittable_list {
    let objects = new hittable_list;
    let pixels = new Uint8Array(gradient_img_texture.length);
    for(let i = 0, len = gradient_img_texture.length; i < len; i++){
        pixels[i] = gradient_img_texture[i];
    }
    let texture = new image_texture(pixels, 32, 32);
    objects.add(new sphere(new vec3(0.0, 0.0, 0.0), 2.0, new lambertian(texture)));

    return objects;
}

function build_simple_light(): hittable_list {
    let objects = new hittable_list;

    let pertext = new noise_texture(4);
    objects.add(new sphere(new vec3(0.0, -1000.0, 0.0), 1000.0, new lambertian(pertext)));
    objects.add(new sphere(new vec3(0.0, 2.0, 0.0), 2.0, new lambertian(pertext)));

    let difflight = new diffuse_light(new solid_color(new vec3(4.0, 4.0, 4.0)));
    objects.add(new xy_rect(3.0, 5.0, 1.0, 3.0, -2.0, difflight));
    objects.add(new sphere(new vec3(0.0, 7.0, 0.0), 2.0, difflight));

    return objects;
}

function build_cornell_box(): hittable_list {
    let objects = new hittable_list();

    let red = new lambertian(new solid_color(new vec3(0.65, 0.05, 0.05)));
    let white = new lambertian(new solid_color(new vec3(0.73, 0.73, 0.73)));
    let green = new lambertian(new solid_color(new vec3(0.12, 0.45, 0.15)));
    let light = new diffuse_light(new solid_color(new vec3(15.0, 15.0, 15.0)));

    objects.add(new yz_rect(0.0, 555.0, 0.0, 555.0, 555.0, green));  // left
    objects.add(new yz_rect(0.0, 555.0, 0.0, 555.0, 0.0, red));  // right
    objects.add(new flip_face(new xz_rect(213.0, 343.0, 227.0, 332.0, 554.0, light)));  // light
    objects.add(new xz_rect(0.0, 555.0, 0.0, 555.0, 0.0, white));  // bottom
    objects.add(new xz_rect(0.0, 555.0, 0.0, 555.0, 555.0, white));  // top
    objects.add(new xy_rect(0.0, 555.0, 0.0, 555.0, 555.0, white));  // back

    let aluminum = new metal(solid_color.rgb(0.8, 0.85, 0.88), solid_color.mono(0.0));
    objects.add(new translate(new rotate_y(new box(new vec3(0.0, 0.0, 0.0), new vec3(165.0, 330.0, 165.0), aluminum), 15.0), new vec3(265.0, 0.0, 295.0)));

    let glass = new dielectric(1.5);
    //objects.add(new translate(new rotate_y(new box(new vec3(0.0, 0.0, 0.0), new vec3(165.0, 165.0, 165.0), white), -18.0), new vec3(130.0, 0.0, 65.0)));
    objects.add(new sphere(new vec3(190.0, 90.0, 190.0), 90.0, glass));

    return objects;
}

function build_cornell_smoke(): hittable_list {
    let objects = new hittable_list();

    let red = new lambertian(new solid_color(new vec3(0.65, 0.05, 0.05)));
    let white = new lambertian(new solid_color(new vec3(0.73, 0.73, 0.73)));
    let green = new lambertian(new solid_color(new vec3(0.12, 0.45, 0.15)));
    let light = new diffuse_light(new solid_color(new vec3(7.0, 7.0, 7.0)));

    objects.add(new yz_rect(0.0, 555.0, 0.0, 555.0, 555.0, green));  // left
    objects.add(new yz_rect(0.0, 555.0, 0.0, 555.0, 0.0, red));  // right
    objects.add(new xz_rect(113.0, 443.0, 127.0, 432.0, 554.0, light));  // light
    objects.add(new xz_rect(0.0, 555.0, 0.0, 555.0, 0.0, white));  // bottom
    objects.add(new xz_rect(0.0, 555.0, 0.0, 555.0, 555.0, white));  // top
    objects.add(new xy_rect(0.0, 555.0, 0.0, 555.0, 555.0, white));  // back


    let box1 = new translate(new rotate_y(new box(new vec3(0.0, 0.0, 0.0), new vec3(165.0, 330.0, 165.0), white),15.0), new vec3(265.0, 0.0, 295.0));
    let box2 = new translate(new rotate_y(new box(new vec3(0.0, 0.0, 0.0), new vec3(165.0, 165.0, 165.0), white), -18.0), new vec3(130.0, 0.0, 65.0));

    objects.add(new constant_medium(box1, 0.01, new solid_color(new vec3(0.0, 0.0, 0.0))));
    objects.add(new constant_medium(box2, 0.01, new solid_color(new vec3(1.0, 1.0, 1.0))));

    return objects;
}

function build_boxes(): hittable_list{
    let objects = new hittable_list();

    let ground_mtl = new lambertian(new solid_color(new vec3(0.2, 0.4, 0.6)));
    let pixels = new Uint8Array(gradient_img_texture.length);
    for(let i = 0, len = gradient_img_texture.length; i < len; i++){
        pixels[i] = gradient_img_texture[i];
    }
    let pixels_hdr = new Float64Array(gradient_img_texture_hdr.length);
    for(let i = 0, len = gradient_img_texture_hdr.length; i < len; i++){
        pixels_hdr[i] = gradient_img_texture_hdr[i];
    }

    let img_texture = new image_texture(pixels, 32, 32);
    let mrb_texture = new noise_texture_2d(new solid_color(new vec3(0.0, 0.0, 0.0)), new solid_color(new vec3(1.0, 1.0, 1.0)), new vec3(1.0, 1.0, 1.0));
    let grd_texture = new gradient_texture(img_texture);
    let chk_texture = new checker_texture_2d(solid_color.mono(0.1), solid_color.mono(0.9), 4.0);
    let hdr_texture = new image_texture_hdr(pixels_hdr, 32, 32);
    let box_mtl = new lambertian(solid_color.mono(1.0));
    let box_metal = new metal(solid_color.mono(), chk_texture);
    objects.add(new xz_rect(-4.0, 4.0, -4.0, 4.0, 0.0, ground_mtl));
    //objects.add(new box(new vec3(-1.0, 0.0, -1.0), new vec3(1.0, 2.0, 1.0), box_metal));
    //objects.add(new sphere(new vec3(0.0, 1.0, 0.0), 1.0, box_mtl));
    objects.add(new yz_rect(0.0, 2.0, -1.0, 1.0, 0.0, box_metal));

    return objects;
}

function build_triangle(): hittable_list{
    let objects = new hittable_list();

    let ground_mtl = new lambertian(new solid_color(new vec3(0.8, 0.8, 0.8)));
    objects.add(new xz_rect(-4.0, 4.0, -4.0, 4.0, 0.0, ground_mtl));
    let m = new lambertian(solid_color.rgb(0.5, 1.0, 0.5));
    //let m = new lambertian(new uv_texture());
    let ps = new Float64Array(9);
    ps[0] = 0.0; ps[1] = 0.0; ps[2] = 2.0;
    ps[3] = 0.0; ps[4] = 0.0; ps[5] = -2.0;
    ps[6] = 0.0; ps[7] = 2.0; ps[8] = 0.0;
    let uvs = new Float64Array(6);
    uvs[0] = 0.0; uvs[1] = 0.0;
    uvs[2] = 0.0; uvs[3] = 1.0;
    uvs[4] = 1.0; uvs[5] = 0.0;
    let nms = new Float64Array(9);
    nms[0] = 1.0; nms[1] = 0.0; nms[2] = 0.0;
    nms[3] = 1.0; nms[4] = 0.0; nms[5] = 0.0;
    nms[6] = 1.0; nms[7] = 0.0; nms[8] = 0.0;
    let t = new triangle(ps, uvs, nms, m);
    objects.add(t);

    //let r = new ray(new vec3(1.0, 1.0, 0.0), new vec3(-1.0, 0.0, 0.0));
    //let rec = new hit_record();
    //const is_hit = t.hit(r, 0.0, 10.0, rec);
    //log_message(is_hit.toString() + "," + rec.toString());
    //log_message(t.toString());
    return objects;
}

function build_random_triangles(count: i32 = 0): hittable_list{
    let objects = new hittable_list();
    let ground_mtl = new lambertian(new solid_color(new vec3(0.8, 0.8, 0.8)));
    objects.add(new xz_rect(-4.0, 4.0, -4.0, 4.0, 0.0, ground_mtl));

    for(let i = 0; i < count; i++){
        let ps = new Float64Array(9);
        ps[0] = random_double_range(-2.0, 2.0); ps[1] = random_double_range(0.0, 2.0); ps[2] = random_double_range(-2.0, 2.0);
        ps[3] = random_double_range(-2.0, 2.0); ps[4] = random_double_range(0.0, 2.0); ps[5] = random_double_range(-2.0, 2.0);
        ps[6] = random_double_range(-2.0, 2.0); ps[7] = random_double_range(0.0, 2.0); ps[8] = random_double_range(-2.0, 2.0);
        objects.add(new triangle(ps, new Float64Array(0), new Float64Array(0), new lambertian(solid_color.mono(1.0))));
    }
    return objects;
}

function main_local(args: string[]): void{
    //const aspect_ration: f32 = 16.0 / 9.0;
    const aspect_ration: f32 = 1.0;
    const image_width = 200;
    const image_height = <i32>(<f32>image_width / aspect_ration);
    const samples_per_pixel = 1;
    const max_depth = 5;

    //let objects = build_three_spheres();
    //let objects = build_quad_spheres(4, 3.0);
    //let objects = build_two_spheres();
    let objects = build_two_perlin_spheres();
    //let objects = build_texture_sphere();
    //let objects = build_simple_light();
    //let objects = build_cornell_box();
    //let objects = build_cornell_smoke();
    //let objects = build_boxes();
    //let objects = build_triangle();
    //let objects = build_random_triangles(5);
    let lights = new Array<light>(0);
    //lights.push(new point_light(vec3.mono(5.0), new vec3(2.0, 1.0, 0.0)));
    lights.push(new directional_light(vec3.mono(0.35), new vec3(5.0, 5.0, -2.0), new vec3(-5.0, -5.0, 2.0)));
    //lights.push(new directional_light(vec3.mono(1.0), new vec3(0.0, 5.0, 0.0), new vec3(0.0, -5.0, 0.0)));

    let importance = new hittable_list();
    /*importance.add(new xz_rect(213.0, 343.0, 227.0, 332.0, 554.0, new diffuse_light(new solid_color(new vec3()))));
    importance.add(new sphere(new vec3(190.0, 90.0, 190.0), 90.0, new diffuse_light(new solid_color(new vec3()))));*/
    let world = new hittable_list();
    world.add(new bvh_node(objects.objects, objects.objects.length));

    const lookfrom = new vec3(4.0, 3.0, 4.0);  // two checker spheres
    //const lookfrom = new vec3(26.0, 3.0, 6.0);  // rect light
    //const lookfrom = new vec3(275.0, 278.0, -800.0);  // cornell box
    const lookto = new vec3(0.0, 1.0, 0.0);
    //const lookto = new vec3(278.0, 278.0, 0.0);  // cornell box
    const cam: camera = new camera(lookfrom,  //from
                                   lookto,  // to
                                   new vec3(0.0, 1.0, 0.0),  // up vector
                                   40.0, // vertical fov
                                   aspect_ration,
                                   0.0,  // aperture size
                                   subtract(lookfrom, lookto).length(),  // focus distance
                                   );
    //let background = new vec3(0.7, 0.8, 1.0);
    let background = new gradient_texture(new solid_color(new vec3(1.0, 1.0, 1.0)), new solid_color(new vec3(0.5, 0.7, 1.0)));
    //let background = solid_color.mono(0.0);
    //let background = new vec3(0.0, 0.0, 0.0);  // disable background

    let file_path: string = "build/image.ppm";
    let file_or_null: Descriptor | null = FileSystem.open(file_path, "w+");
    if (file_or_null == null) {
        throw new Error("Could not open the file " + file_path);
    }
    let file = changetype<Descriptor>(file_or_null);

    let image_buffer = new Array<vec3>(image_width * image_height);
    let pixel_index = 0;

    //let box = new aabb(new vec3(-2.0, -1.0, -2.0), new vec3(2.0, 1.0, 2.0));
    //let r2 = new ray(new vec3(5.0, 5.0, 5.0), new vec3(-1.0, -0.0, -0.0));
    //Console.log(box.hit(r2, 0.001, infinity).toString() + "\n");  // the method for hiting bounding box is wrong

    file.writeString("P3\n" + image_width.toString() + " " + image_height.toString() + "\n255\n");
    const start_time: i64 = process.time();
    for(let j = image_height - 1; j >= 0; j--){
        for(let i = 0; i < image_width; i++){
            let pixel_color = new vec3(0.0, 0.0, 0.0);
            for(let s = 0; s < samples_per_pixel; s++){
                const u = (i + random_double()) / (image_width - 1);
                const v = (j + random_double()) / (image_height - 1);

                const r: ray = cam.get_ray(u, v);
                pixel_color.add_inplace(ray_color(r, background, world, lights, importance, max_depth));
            }
            image_buffer[pixel_index] = pixel_color;
            pixel_index++;
        }
    }
    const render_time: i64 = process.time();
    Console.log("Render time: " + ((<f32>(render_time - start_time)) / 1000.0).toString() + " seconds\n");

    //output pixels
    for(let i = 0; i < pixel_index; i++){
        file.writeString(color_string(image_buffer[i], samples_per_pixel));
    }

    const finish_time: i64 = process.time();
    Console.log("Write output time: " + ((<f32>(finish_time - render_time)) / 1000.0).toString() + " seconds\n");
    
}

function main(args: string[]): void{
    let render = new renderer();
    render.set_camera(320, 240, 0.0, 3.0, 4.0, 0.0, 1.0, 0.0, 45.0, 0.0);
    const light_intensity = 0.5;
    render.add_directional_light(5.0, 5.0, 5.0, -5.0, -5.0, -5.0, light_intensity, light_intensity, light_intensity);
    //const light_intensity = 1.0;
    //render.add_directional_light(0.0, 5.0, 0.0, 0.0, -5.0, 0.0, light_intensity, light_intensity, light_intensity);
    render.set_background(new gradient_texture(new solid_color(new vec3(1.0, 1.0, 1.0)), new solid_color(new vec3(0.5, 0.7, 1.0))));
    //let chk_text = new checker_texture_2d(solid_color.rgb(0.8, 0.6, 0.4), solid_color.rgb(0.4, 0.6, 0.8), 6.0, 4.0);
    let chk_text = new checker_texture_2d(solid_color.rgb(0.3, 0.3, 0.3), solid_color.rgb(0.8, 0.8, 0.8), 6.0, 4.0);
    let ground_mat = new lambertian(chk_text);
    let noise_text = new noise_texture_2d(solid_color.mono(0.0), solid_color.mono(1.0), new vec3(2.0, 3.0, 4.0), 0.0);
    let box_mat = new metal(noise_text);
    let red_mat = new lambertian(solid_color.rgb(1.0, 0.0, 0.0));
    //render.add_y_plane(-4.0, -4.0, 4.0, 4.0, 0.0, ground_mat);
    //render.add_cube(-1.0, 0.0, -1.0, 1.0, 1.0, 1.0, box_mat);
    for(let i = 0; i < 0; i++){
        const px = random_double_range(-3.0, 3.0);
        const py = random_double_range(0.0, 1.0);
        const pz = random_double_range(-3.0, 3.0);
        let sphere_mat = new lambertian(solid_color.rgb(random_double_range(0.2, 0.8), random_double_range(0.2, 0.8), random_double_range(0.2, 0.8)));
        render.add_sphere(px, py, pz, py, red_mat);
    }
    for(let i = 0; i < 0; i++){
        const px = random_double_range(-3.0, 3.0);
        const pz = random_double_range(-3.0, 3.0);
        const size = random_double_range(0.1, 1.0);
        const height = random_double_range(0.1, 1.0);
        let mat = new lambertian(solid_color.rgb(random_double_range(0.2, 0.8), random_double_range(0.2, 0.8), random_double_range(0.2, 0.8)));
        render.add_cube(px, 0.0, pz, px+size, height, pz+size, red_mat);
    }

    let metal_mat = new simple_combined(new noise_texture_2d(solid_color.mono(0.7), solid_color.mono(0.9), vec3.mono(4.0)), //albedo
                                        solid_color.mono(0.1), //raughness
                                        solid_color.rgb(1.0, 0.5, 0.0), //emission
                                        new checker_texture_2d(solid_color.mono(0.0), solid_color.mono(1.0), 4.0, 1.0), //emission_mask
                                        solid_color.mono(0.2)); //metal mask
    //let diffuse_mat = new lambertian(solid_color.mono(0.8));
    render.add_z_plane(-2.0, 0.0, 2.0, 2.0, 0.0, metal_mat);
    let glow_mat = new diffuse_light(solid_color.mono(5.0));
    for(let i = 0; i < 0; i++){
        const px = random_double_range(-1.0, 1.0);
        const pz = random_double_range(-1.0, 1.0);
        render.add_sphere(px, 0.25, pz, 0.25, glow_mat);
        //render.add_sample_attractor(new sphere(new vec3(px, 0.25, pz), 0.5, glow_mat));
    }

    //add polygonmesh
    let points = new Float64Array(18);
    points[0] = -1.0; points[1] = 0.5; points[2] = -1.0;
    points[3] = 1.0; points[4] = 0.1; points[5] = -1.0;
    points[6] = 1.0; points[7] = 0.5; points[8] = 1.0;

    points[9] = -1.0; points[10] = 0.5; points[11] = -1.0;
    points[12] = 1.0; points[13] = 0.5; points[14] = 1.0;
    points[15] = -1.0; points[16] = 0.1; points[17] = 1.0;
    //render.add_polygonmesh(points, sphere_mat);

    //add plane
    const plane_size = 4.0;
    let plane_points = new Float64Array(18);
    plane_points[0] = -plane_size; plane_points[1] = 0.0; plane_points[2] = -plane_size;
    plane_points[3] = plane_size; plane_points[4] = 0.0; plane_points[5] = -plane_size;
    plane_points[6] = plane_size; plane_points[7] = 0.0; plane_points[8] = plane_size;

    plane_points[9] = -plane_size; plane_points[10] = 0.0; plane_points[11] = -plane_size;
    plane_points[12] = plane_size; plane_points[13] = 0.0; plane_points[14] = plane_size;
    plane_points[15] = -plane_size; plane_points[16] = 0.0; plane_points[17] = plane_size;
    let plane_uvs = new Float64Array(12);
    plane_uvs[0] = 0.0; plane_uvs[1] = 0.0;
    plane_uvs[2] = 1.0; plane_uvs[3] = 0.0;
    plane_uvs[4] = 1.0; plane_uvs[5] = 1.0;

    plane_uvs[6] = 0.0; plane_uvs[7] = 0.0;
    plane_uvs[8] = 1.0; plane_uvs[9] = 1.0;
    plane_uvs[10] = 0.0; plane_uvs[11] = 1.0;
    let bake_uvs = new Float64Array(12);
    bake_uvs[0] = 0.5; bake_uvs[1] = 0.25;
    bake_uvs[2] = 0.75; bake_uvs[3] = 0.25;
    bake_uvs[4] = 0.75; bake_uvs[5] = 0.75;

    bake_uvs[6] = 0.25; bake_uvs[7] = 0.25;
    bake_uvs[8] = 0.5; bake_uvs[9] = 0.75;
    bake_uvs[10] = 0.25; bake_uvs[11] = 0.75;
    render.add_polygonmesh_short(plane_points, ground_mat, new Float64Array(0), plane_uvs, plane_uvs, true);

    const start_time: i64 = process.time();
    render.render(1, 2);  // actual render
    //render.set_image_size(256, 256);
    //render.bake(1, 2, false);
    const render_time: i64 = process.time();
    Console.log("Render time: " + ((<f32>(render_time - start_time)) / 1000.0).toString() + " seconds\n");
    let image = render.get_render_buffer_short();
    let image_size = render.get_image_size();

    //output the image
    let file_path: string = "build/image.ppm";
    let file_or_null: Descriptor | null = FileSystem.open(file_path, "w+");
    if (file_or_null == null) {
        throw new Error("Could not open the file " + file_path);
    }
    let file = changetype<Descriptor>(file_or_null);
    file.writeString("P3\n" + image_size[0].toString() + " " + image_size[1].toString() + "\n255\n");
    for(let p = 0, len = image_size[0]*image_size[1]; p < len; p++){
        file.writeString((<i32>(256 * clamp(image[3*p], 0.0, 0.999))).toString() + " " + 
                         (<i32>(256 * clamp(image[3*p + 1], 0.0, 0.999))).toString() + " " + 
                         (<i32>(256 * clamp(image[3*p + 2], 0.0, 0.999))).toString() + "\n");
    }
}

main(process.argv);