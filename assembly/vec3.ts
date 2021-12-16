import { random_double, random_double_range } from "./utilities";

export class vec3{
    private m_x: f64;
    private m_y: f64;
    private m_z: f64;

    constructor(e0: f64 = 0, e1: f64 = 0, e2: f64 = 0) {
        this.m_x = e0; this.m_y = e1; this.m_z = e2;
    }

    @inline
    x(): f64{ return this.m_x; }
    @inline
    y(): f64{ return this.m_y; }
    @inline
    z(): f64{ return this.m_z; }

    @inline
    clone_from(other: vec3): void{
        this.m_x = other.x();
        this.m_y = other.y();
        this.m_z = other.z();
    }

    @inline
    negate(): vec3{
        return new vec3(-this.m_x, -this.m_y, -this.m_z);
    }

    @inline
    get(i: i32): f64{
        if(i == 0){
            return this.m_x;
        }
        else if(i == 1){
            return this.m_y;
        }
        else{
            return this.m_z;
        }
    }

    @inline
    set(i: i32, value: f64): void{
        if(i == 0){
            this.m_x = value;
        }
        else if(i == 1){
            this.m_y = value;
        }
        else{
            this.m_z = value;
        }
    }

    add_inplace_values(x: f64, y: f64, z: f64): vec3{
        this.m_x += x;
        this.m_y += y;
        this.m_z += z;
        return this;
    }

    add_inplace(other: vec3): vec3{
        this.m_x += other.x();
        this.m_y += other.y();
        this.m_z += other.z();
        return this;
    }

    @inline
    mult_inplace(scalar: f64): vec3{
        this.m_x *= scalar;
        this.m_y *= scalar;
        this.m_z *= scalar;
        return this;
    }

    @inline
    divide_inplace(scalar: f64): vec3{
        return this.mult_inplace(1.0 / scalar);
    }

    @inline
    length(): f64{
        return Math.sqrt(this.length_squared());
    }

    @inline
    length_squared(): f64{
        return this.m_x*this.m_x + this.m_y*this.m_y + this.m_z*this.m_z;
    }

    @inline
    near_zero(): bool{
        const s: f64 = 0.00000001;
        return (Math.abs(this.m_x) < s) && (Math.abs(this.m_y) < s) && (Math.abs(this.m_z) < s);
    }

    @inline
    average(): f64{
        return (this.m_x + this.m_y + this.m_z) / 3.0;
    }

    @inline
    static random(): vec3{
        return new vec3(random_double(), random_double(), random_double());
    }

    @inline
    static random_range(min: f64, max: f64): vec3{
        return new vec3(random_double_range(min, max), random_double_range(min, max), random_double_range(min, max));
    }

    @inline
    static xyz(x: f64, y: f64, z: f64): vec3{
        return new vec3(x, y, z);
    }

    static mono(v: f64): vec3{
        return new vec3(v, v, v);
    }

    @inline
    toString(): string{
        return "(" + this.m_x.toString() + ", " + this.m_y.toString() + ", " + this.m_z.toString() + ")";
    }
}

@inline
export function distance(a: vec3, b: vec3): f64{
    return Math.sqrt((b.x() - a.x()) * (b.x() - a.x()) + (b.y() - a.y()) * (b.y() - a.y()) + (b.z() - a.z()) * (b.z() - a.z()));
}

@inline
export function add(u: vec3, v: vec3): vec3{
    return new vec3(u.get(0) + v.get(0), u.get(1) + v.get(1), u.get(2) + v.get(2));
}

@inline
export function subtract(u: vec3, v: vec3): vec3{
    return new vec3(u.get(0) - v.get(0), u.get(1) - v.get(1), u.get(2) - v.get(2));
}

@inline
export function mult(u: vec3, v: vec3): vec3{
    return new vec3(u.get(0) * v.get(0), u.get(1) * v.get(1), u.get(2) * v.get(2));
}

@inline
export function scale(t: f64, v: vec3): vec3{
    return new vec3(t*v.get(0), t*v.get(1), t*v.get(2));
}

@inline
export function divide(t: f64, v: vec3): vec3{
    return scale(1.0 / t, v);
}

@inline
export function dot(u: vec3, v: vec3): f64{
    return u.get(0) * v.get(0) + u.get(1) * v.get(1) + u.get(2) * v.get(2);
}

@inline
export function cross(u: vec3, v: vec3): vec3{
    return new vec3(u.get(1) * v.get(2) - u.get(2) * v.get(1),
                    u.get(2) * v.get(0) - u.get(0) * v.get(2),
                    u.get(0) * v.get(1) - u.get(1) * v.get(0));
}

@inline
export function reflect(v: vec3, n: vec3): vec3 {
    return subtract(v, scale(2.0 * dot(v, n), n));
}

@inline
export function refract(uv: vec3, n: vec3, etai_over_eta: f64): vec3 {
    const cos_theta = <f64>Math.min(dot(scale(-1.0, uv), n), 1.0);
    const value_01 = scale(cos_theta, n);
    const r_out_perp = scale(etai_over_eta, add(uv, value_01));
    const r_out_parallel = scale(-1.0 * Math.sqrt(1.0 - r_out_perp.length_squared()), n);
    return add(r_out_perp, r_out_parallel);
}

@inline
export function unit_vector(v: vec3): vec3{
    const l = v.length();
    if(l < 0.99999 || l > 1.00001){
        return divide(v.length(), v);
    }
    return new vec3(v.x(), v.y(), v.z());
}

@inline
export function random_in_unit_sphere(): vec3{
    const s = random_double();
    const t = random_double();
    const u = random_double();
    const v = random_double();
    const w = random_double();
    const norm = Math.sqrt(s*s + t*t + u*u + v*v + w*w);
    return new vec3(u / norm, v / norm, w / norm);
    /*while(true){
        const p = vec3.random_range(-1.0, 1.0);
        if(p.length_squared() >= 1){
            continue;
        }

        return p;
    }*/
}

@inline
export function random_unit_vector(): vec3{
    const p = vec3.random_range(-1.0, 1.0);
    return unit_vector(p);
    //return unit_vector(random_in_unit_sphere());
}

@inline
export function random_in_hemisphere(normal: vec3): vec3{
    let in_unit_sphere: vec3 = random_in_unit_sphere();
    if(dot(in_unit_sphere, normal) > 0.0){
        return in_unit_sphere;
    }
    else{
        return in_unit_sphere.negate();
    }
}

@inline
export function random_in_unit_disk(): vec3 {
    const s = random_double();
    const t = random_double();
    const u = random_double();
    const v = random_double();
    const norm = Math.sqrt(s*s + t*t + u*u + v*v);
    return new vec3(u / norm, v / norm, 0.0);
    /*while(true){
        let p = new vec3(random_double_range(-1.0, 1.0), random_double_range(-1.0, 1.0), 0.0);
        if(p.length_squared() >= 1){
            continue;
        }
        return p;
    }*/
}