import { vec3, dot, unit_vector } from "./vec3";
import { onb } from "./onb";
import { pi, random_cosine_direction, random_double } from "./utilities";
import { hittable } from "./hittable";

export abstract class pdf{
    abstract value(direction: vec3): f64;
    abstract generate(): vec3;
}

export class empty_pdf extends pdf {
    constructor() {
        super();
    }

    value(direction: vec3): f64{
        return 0.0;
    }

    generate(): vec3{
        return new vec3();
    }
}

export class cosine_pdf extends pdf {
    private uvw: onb;

    constructor(w: vec3) {
        super();
        this.uvw = new onb();
        this.uvw.build_from_w(w);
    }

    value(direction: vec3): f64{
        const cosine = dot(unit_vector(direction), this.uvw.w());
        return (cosine < 0.0) ? 0.0 : cosine / pi;
    }

    generate(): vec3{
        let rcd = random_cosine_direction();
        return this.uvw.local(rcd.x(), rcd.y(), rcd.z());
    }
}

export class hittable_pdf extends pdf {
    private o: vec3;
    private ptr: hittable;

    constructor(p: hittable, origin: vec3) {
        super();
        this.ptr = p;
        this.o = origin;
    }

    value(direction: vec3): f64{
        return this.ptr.pdf_value(this.o, direction);
    }

    generate(): vec3{
        return this.ptr.random(this.o);
    }
}

export class mixture_pdf extends pdf {
    private p_0: pdf;
    private p_1: pdf;

    constructor(p0: pdf, p1: pdf) {
        super();

        this.p_0 = p0;
        this.p_1 = p1;
    }

    value(direction: vec3): f64{
        return 0.5 * this.p_0.value(direction) + 0.5 * this.p_1.value(direction);
    }

    generate(): vec3{
        if(random_double() < 0.5){
            return this.p_0.generate();
        }
        else{
            return this.p_1.generate();
        }
    }
}

export function random_to_sphere(radius: f64, distance_squared: f64): vec3 {
    const r1 = random_double();
    const r2 = random_double();
    const z = 1 + r2 * (Math.sqrt(1 - radius*radius / distance_squared) - 1);

    const phi = 2*pi*r1;
    const x = Math.cos(phi)*Math.sqrt(1 - z*z);
    const y = Math.sin(phi)*Math.sqrt(1 - z*z);

    return new vec3(x, y, z);
}