import { vec3, add, scale, mult } from "./vec3";
import { perlin } from "./perlin";
import { clamp, pi, log_message } from "./utilities";

export class texture{
    value(u: f64, v: f64, p: vec3): vec3{
        return new vec3();
    }
}

export class solid_color extends texture {
    private color_value: vec3;

    constructor(c: vec3 = new vec3()) {
        super();

        this.color_value = c;
    }

    value(u: f64, v: f64, p: vec3): vec3{
        return this.color_value;
    }

    static rgb(r: f64, g: f64, b: f64): solid_color{
        return new solid_color(new vec3(r, g, b));
    }

    static mono(v: f64): solid_color{
        return new solid_color(new vec3(v, v, v));
    }
}

export class checker_texture extends texture {
    private odd: texture;
    private even: texture;
    private scale: vec3;

    constructor(_even: texture = new solid_color(new vec3(0.2, 0.2, 0.2)),
                _odd: texture = new solid_color(new vec3(0.8, 0.8, 0.8)), 
                _scale: vec3 = new vec3(1.0, 1.0, 1.0)) {
        super();

        this.odd = _odd;
        this.even = _even;
        this.scale = _scale;
    }

    value(u: f64, v: f64, p: vec3): vec3{
        const sines = Math.sin(this.scale.x() * p.x()) * Math.sin(this.scale.y() * p.y()) * Math.sin(this.scale.z() * p.z());
        if(sines < 0.0){
            return this.odd.value(u, v, p);
        }
        else{
            return this.even.value(u, v, p);
        }
    }
}

export class checker_texture_2d extends checker_texture {
    
    constructor(_even: texture = new solid_color(new vec3(0.2, 0.2, 0.2)), 
                _odd: texture = new solid_color(new vec3(0.8, 0.8, 0.8)), 
                _scale_u: f64 = 2.0,
                _scale_v: f64 = 2.0) {
        super(_even, _odd, new vec3(_scale_u, 1.0, _scale_v));  // in 2d scale is the number of squares in one uv-tile
    }

    value(u: f64, v: f64, p: vec3): vec3{
        const sines = Math.sin(this.scale.x() * pi * u) * Math.sin(this.scale.z() * pi * v);
        if(sines < 0.0){
            return this.odd.value(u, v, p);
        }
        else{
            return this.even.value(u, v, p);
        }
    }
}

export class noise_texture extends texture {
    private noise: perlin = new perlin();
    private scale: vec3;
    private color_01: texture;
    private color_02: texture;

    constructor(_color_01: texture = new solid_color(new vec3(0.0, 0.0, 0.0)),
                _color_02: texture = new solid_color(new vec3(1.0, 1.0, 1.0)),
                _scale: vec3 = new vec3(1.0, 1.0, 1.0)) {
        super();
        this.color_01 = _color_01;
        this.color_02 = _color_02;
        this.scale = _scale;
    }

    value(u: f64, v: f64, p: vec3): vec3{
        //usual noise
        //return scale(0.5 * (1.0 + this.noise.noise(scale(this.scale, p))), new vec3(1.0, 1.0, 1.0));

        //with turbulence
        //return scale(this.noise.turb(mult(this.scale, p)), new vec3(1.0, 1.0, 1.0));
        const value = this.noise.turb(mult(this.scale, p));
        return add(scale(1.0 - value, this.color_01.value(u, v, p)), scale(value, this.color_02.value(u, v, p)));

        //marble-like
        //return scale(0.5 * (1 + Math.sin(this.scale * p.z() + 10 * this.noise.turb(p))), new vec3(1.0, 1.0, 1.0));
    }
}

export class noise_texture_2d extends texture {
    private noise: perlin = new perlin();
    private scale: vec3;
    private color_01: texture;
    private color_02: texture;
    private z_slice: f64;

    constructor(_color_01: texture = new solid_color(new vec3(0.0, 0.0, 0.0)),
                _color_02: texture = new solid_color(new vec3(1.0, 1.0, 1.0)),
                _scale: vec3 = new vec3(1.0, 1.0, 1.0), _z: f64 = 0.0) {
        super();
        this.color_01 = _color_01;
        this.color_02 = _color_02;
        this.scale = _scale;
        this.z_slice = _z;
    }

    value(u: f64, v: f64, p: vec3): vec3{
        const value = this.noise.turb(mult(this.scale, new vec3(u, v, this.z_slice)));
        return add(scale(1.0 - value, this.color_01.value(u, v, p)), scale(value, this.color_02.value(u, v, p)));
    }
}

export class gradient_texture extends texture {
    private color_01: texture;
    private color_02: texture;

    constructor(c1: texture = new solid_color(), c2: texture = new solid_color(new vec3(1.0, 1.0, 1.0))) {
        super();
        this.color_01 = c1;
        this.color_02 = c2;
    }

    value(u: f64, v: f64, p: vec3): vec3{
        return add(scale(1.0 - v, this.color_01.value(u, v, p)), scale(v, this.color_02.value(u, v, p)));
    }
}

export class uv_texture extends texture {

    constructor() {
        super();
    }

    value(u: f64, v: f64, p: vec3): vec3{
        return new vec3(u, v, 0.0);
    }
}

export class image_texture extends texture {
    private data: Uint8Array = new Uint8Array(0);
    private width: i32 = 0;
    private height: i32 = 0;
    private bytes_per_scanline: i32 = 0;
    private bytes_per_pixel: i32;

    constructor(pixels: Uint8Array, w: i32, h: i32) {
        super();
        this.data = pixels;
        this.width = w;
        this.height = h;
        const bytes_per_pixel = <i32>(pixels.length / (w * h));
        this.bytes_per_pixel = bytes_per_pixel;
        this.bytes_per_scanline = bytes_per_pixel * this.width;
    }

    value(u: f64, v: f64, p: vec3): vec3{
        if(this.data.length == 0){
            return new vec3(1.0, 0.0, 1.0);
        }

        u = clamp(u, 0.0, 1.0);
        v = 1.0 - clamp(v, 0.0, 1.0);

        let i = <i32>(u * this.width);
        let j = <i32>(v * this.height);

        if(i >= this.width){ i = this.width - 1; }
        if(j >= this.height){ j = this.height - 1; }

        const color_scale: f64 = 1.0 / 255.0;
        const index: i32 = j * this.bytes_per_scanline + i * this.bytes_per_pixel;
        let out_color = new vec3(color_scale * unchecked(this.data[index]), color_scale * unchecked(this.data[index + 1]), color_scale * unchecked(this.data[index + 2]));
        return out_color;
    }
}

export class image_texture_hdr extends texture {
    private data: Float64Array = new Float64Array(0);
    private width: i32 = 0;
    private height: i32 = 0;
    private floats_per_pixel: i32 = 1;

    constructor(pixels: Float64Array, w: i32, h: i32) {
        super();
        this.data = pixels;
        this.width = w;
        this.height = h;
        this.floats_per_pixel = <i32>(pixels.length / (w * h));
    }

    value(u: f64, v: f64, p: vec3): vec3{
        if(this.data.length == 0){
            return new vec3(1.0, 0.0, 1.0);
        }

        u = clamp(u, 0.0, 1.0);
        v = 1.0 - clamp(v, 0.0, 1.0);

        let i = <i32>(u * this.width);
        let j = <i32>(v * this.height);

        if(i >= this.width){ i = this.width - 1; }
        if(j >= this.height){ j = this.height - 1; }

        const index: i32 = j * this.floats_per_pixel * this.width + i * this.floats_per_pixel;
        let out_color = new vec3(unchecked(this.data[index]), unchecked(this.data[index + 1]), unchecked(this.data[index + 2]));
        return out_color;
    }
}