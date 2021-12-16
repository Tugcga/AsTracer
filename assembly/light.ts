import { vec3, dot, subtract, unit_vector } from "./vec3";
import { clamp } from "./utilities";

export abstract class light{
    abstract get_position(): vec3;
    abstract get_color(): vec3;
    abstract get_attenuation(in_normal: vec3, in_position: vec3): f64;
}

export class directional_light extends light {
    private position: vec3 = new vec3();
    private color: vec3 = new vec3();
    private direction: vec3 = new vec3();

    constructor(_color: vec3 = new vec3(1.0, 1.0, 1.0), _p: vec3 = new vec3(), _dir: vec3 = new vec3(0.0, 1.0, 0.0)) {
        super();
        this.position = _p;
        this.color = _color;
        this.direction = unit_vector(_dir);
    }

    get_position(): vec3{
        return this.position;
    }

    get_color(): vec3{
        return this.color;
    }

    get_attenuation(in_normal: vec3, in_position: vec3): f64{
        return clamp(-1 * dot(in_normal, this.direction), 0.0, 1.0);
    }
}

export class point_light extends light {
    private position: vec3 = new vec3();
    private color: vec3 = new vec3();
    
    constructor(_color: vec3 = new vec3(1.0, 1.0, 1.0), _p: vec3 = new vec3()) {
        super();
        this.position = _p;
        this.color = _color;
    }

    get_position(): vec3{
        return this.position;
    }

    get_color(): vec3{
        return this.color;
    }

    get_attenuation(in_normal: vec3, in_position: vec3): f64{
        let to_sample = subtract(in_position, this.position)
        let to_sample_unit = unit_vector(to_sample);
        return clamp(-1 * dot(in_normal, to_sample_unit), 0.0, 1.0) / to_sample.length_squared();
    }
}