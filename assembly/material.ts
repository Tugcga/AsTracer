import { ray } from "./ray";
import { hit_record } from "./hittable";
import { vec3, add, scale, dot, reflect, refract, unit_vector, random_in_hemisphere, random_in_unit_sphere, random_unit_vector } from "./vec3";
import { random_double, pi, delta, random_cosine_direction, log_message } from "./utilities";
import { texture, solid_color } from "./texture";
import { onb } from "./onb";
import { pdf, cosine_pdf, empty_pdf } from "./pdf";

export class scatter_record{
    specular_ray: ray = new ray();
    is_specular: bool = false;
    attenuation: vec3 = new vec3();
    pdf_ptr: pdf = new empty_pdf();
}

export class material{

    get_branches_count(): i32{
        return 1;
    }

    get_branch_coefficient(u: f64, v: f64, p: vec3, branch_index: i32): f64{
        return 1.0;
    }
    
    scatter(r_in: ray, rec: hit_record, srec: scatter_record, branch_index: i32): bool{
        return false;
    }

    scattering_pdf(r_in: ray, rec: hit_record, scattered: ray, branch_index: i32): f64{
        return 0.0;
    }

    emitted(r_in: ray, rec: hit_record, u: f64, v: f64, p: vec3, branch_index: i32): vec3{
        return new vec3(0.0, 0.0, 0.0);
    }
}

export class lambertian extends material {
    private albedo: texture;

    constructor(a: texture = new solid_color()) {
        super();
        this.albedo = a;
    }

    scatter(r_in: ray, rec: hit_record, srec: scatter_record, branch_index: i32): bool{
        srec.is_specular = false;
        srec.specular_ray = new ray();
        srec.attenuation = this.albedo.value(rec.u, rec.v, rec.p);
        srec.pdf_ptr = new cosine_pdf(rec.normal);

        return true;
    }

    scattering_pdf(r_in: ray, rec: hit_record, scattered: ray, branch_index: i32): f64{
        const cosine = dot(rec.normal, unit_vector(scattered.direction()));
        return cosine < 0.0 ? 0.0 : cosine / pi;
    }
}

export class metal extends material {
    private albedo: texture;
    private fuzz: texture;

    constructor(_albedo: texture = new solid_color(new vec3(0.8, 0.8, 0.8)), _fuzz: texture = new solid_color(new vec3())) {
        super();
        this.albedo = _albedo;
        this.fuzz = _fuzz;
    }

    scatter(r_in: ray, rec: hit_record, srec: scatter_record, branch_index: i32): bool{
        let reflected: vec3 = reflect(unit_vector(r_in.direction()), rec.normal);
        srec.specular_ray = new ray(rec.p, add(reflected, scale(this.fuzz.value(rec.u, rec.v, rec.p).average(), random_in_hemisphere(rec.normal))));
        srec.attenuation = this.albedo.value(rec.u, rec.v, rec.p);
        srec.is_specular = true;

        return true;
    }
}

export class dielectric extends material {
    private ir: f64;

    constructor(index_of_refraction: f64) {
        super();
        this.ir = index_of_refraction;
    }

    scatter(r_in: ray, rec: hit_record, srec: scatter_record, branch_index: i32): bool{
        srec.is_specular = true;
        srec.attenuation = new vec3(1.0, 1.0, 1.0);

        const refraction_ratio: f64 = rec.front_face ? (1.0 / this.ir) : this.ir;

        let unit_directon: vec3 = unit_vector(r_in.direction());
        const cos_theta = Math.min(dot(scale(-1.0, unit_directon), rec.normal), 1.0);
        const sin_theta = Math.sqrt(1.0 - cos_theta * cos_theta);

        const cannot_refract = (refraction_ratio * sin_theta) > 1.0;
        let direction = new vec3();
        if(cannot_refract || dielectric.reflectance(cos_theta, refraction_ratio) > random_double()){
            direction.clone_from(reflect(unit_directon, rec.normal));
        }
        else{
            direction.clone_from(refract(unit_directon, rec.normal, refraction_ratio));
        }

        srec.specular_ray = new ray(rec.p, direction);
        return true;
    }

    static reflectance(cosine: f64, ref_idx: f64): f64{
        let r0 = (1 - ref_idx) / (1 + ref_idx);
        r0 = r0 * r0;
        return r0 + (1 - r0) * Math.pow(1 - cosine, 5.0);
    }
}

export class diffuse_light extends material {
    private emit: texture;

    constructor(a: texture) {
        super();
        this.emit = a;
    }

    scatter(r_in: ray, rec: hit_record, srec: scatter_record, branch_index: i32): bool{
        return false;
    }

    emitted(r_in: ray, rec: hit_record, u: f64, v: f64, p: vec3, branch_index: i32): vec3{
        if(rec.front_face){
            return this.emit.value(u, v, p);
        }
        else{
            return new vec3(0.0, 0.0, 0.0);
        }
    }
}

/*export class isotropic extends material {
    private albedo: texture;

    constructor(a: texture) {
        super();
        this.albedo = a;
    }

    scatter(r_in: ray, rec: hit_record, srec: scatter_record): bool{
        srec.is_specular = false;
        srec.specular_ray = new ray(rec.p, random_in_unit_sphere());
        srec.attenuation = this.albedo.value(rec.u, rec.v, rec.p);
        return true;
    }
}*/

export class simple_combined extends material {
    private m_diffuse_material: material;
    private m_metal_material: material;
    private m_emission_material: material;

    private m_emission_mask: texture;
    private m_metal_mask: texture;

    constructor(albedo: texture = solid_color.mono(0.8),
                roughness: texture = solid_color.mono(0.0),
                emission: texture = solid_color.mono(1.0),
                emission_mask: texture = solid_color.mono(0.0),
                metal_mask: texture = solid_color.mono(0.0)) {
        super();
        this.m_diffuse_material = new lambertian(albedo);
        this.m_metal_material = new metal(albedo, roughness);
        this.m_emission_material = new diffuse_light(emission);

        this.m_emission_mask = emission_mask;
        this.m_metal_mask = metal_mask;
    }

    get_branches_count(): i32{
        //branch 0 - albedo
        //branch 1 - metal
        //branch 2 - emission
        return 3;
    }

    get_branch_coefficient(u: f64, v: f64, p: vec3, branch_index: i32): f64{
        if(branch_index == 2){
            return this.m_emission_mask.value(u, v, p).average();
        }
        else if(branch_index == 1){
            const metal_total = 1.0 - this.m_emission_mask.value(u, v, p).average();
            return this.m_metal_mask.value(u, v, p).average() * metal_total;
        }
        else if(branch_index == 0){
            return (1.0 - this.m_emission_mask.value(u, v, p).average()) * (1.0 - this.m_metal_mask.value(u, v, p).average());
        }
        else{
            return 0.0;
        }
    }

    scatter(r_in: ray, rec: hit_record, srec: scatter_record, branch_index: i32): bool{
        if(branch_index == 2){
            return this.m_emission_material.scatter(r_in, rec, srec, branch_index);
        }
        else if(branch_index == 1){
            return this.m_metal_material.scatter(r_in, rec, srec, branch_index);
        }
        else if(branch_index == 0){
            return this.m_diffuse_material.scatter(r_in, rec, srec, branch_index);
        }
        else{
            return false;
        }
    }

    scattering_pdf(r_in: ray, rec: hit_record, scattered: ray, branch_index: i32): f64{
        if(branch_index == 2){
            return this.m_emission_material.scattering_pdf(r_in, rec, scattered, branch_index);
        }
        else if(branch_index == 1){
            return this.m_metal_material.scattering_pdf(r_in, rec, scattered, branch_index);
        }
        else if(branch_index == 0){
            return this.m_diffuse_material.scattering_pdf(r_in, rec, scattered, branch_index);
        }
        else{
            return 0.0;
        }
    }

    emitted(r_in: ray, rec: hit_record, u: f64, v: f64, p: vec3, branch_index: i32): vec3{
        if(branch_index == 2){
            return this.m_emission_material.emitted(r_in, rec, u, v, p, branch_index);
        }
        else if(branch_index == 1){
            return this.m_metal_material.emitted(r_in, rec, u, v, p, branch_index);
        }
        else if(branch_index == 0){
            return this.m_diffuse_material.emitted(r_in, rec, u, v, p, branch_index);
        }
        else{
            return new vec3();
        }
    }
}