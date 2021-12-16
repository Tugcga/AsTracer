import { random_double, random_int } from "./utilities";
import { vec3, dot } from "./vec3";

export class perlin{
    static point_count: i32 = 256;
    private rand_vec: Array<vec3>;  // use random vectors on the lattice points
    private perm_x: Int32Array;
    private perm_y: Int32Array;
    private perm_z: Int32Array;

    constructor() {
        this.rand_vec = new Array<vec3>(perlin.point_count);
        for(let i = 0, len = this.rand_vec.length; i < len; i++){
            unchecked(this.rand_vec[i] = vec3.random_range(-1.0, 1.0));
        }

        this.perm_x = perlin.perlin_generate_perm();
        this.perm_y = perlin.perlin_generate_perm();
        this.perm_z = perlin.perlin_generate_perm();
    }

    noise(p: vec3): f64{
        /*
        // first iteration, output squared random blocks
        const i = <i32>(4 * p.x()) & 255;  // & is and
        const j = <i32>(4 * p.y()) & 255;
        const k = <i32>(4 * p.z()) & 255;

        return this.rand_float[this.perm_x[i] ^ this.perm_y[j] ^ this.perm_z[k]];  // ^ is xor
        */

        //second iteration, output interpolated result
        let u = p.x() - Math.floor(p.x());
        let v = p.y() - Math.floor(p.y());
        let w = p.z() - Math.floor(p.z());

        //at third step add Hermite cubic
        //u = u*u*(3 - 2*u);
        //v = v*v*(3 - 2*v);
        //w = w*w*(3 - 2*w);

        let i = <i32>(Math.floor(p.x()));
        let j = <i32>(Math.floor(p.y()));
        let k = <i32>(Math.floor(p.z()));
        let c = new Array<vec3>(8);
        for(let di = 0; di < 2; di++){
            for(let dj = 0; dj < 2; dj++){
                for(let dk = 0; dk < 2; dk++){
                    unchecked(c[4*di + 2*dj + dk] = this.rand_vec[this.perm_x[(i + di)&255]^this.perm_x[(j + dj)&255]^this.perm_x[(k + dk)&255]]);
                }
            }
        }
        return perlin.perlin_interp(c, u, v, w);
    }

    turb(p: vec3, depth: i32 = 7): f64{
        let accum: f64 = 0.0;

        let temp_p = new vec3();
        temp_p.clone_from(p);
        let weight = 1.0;

        for(let i = 0; i < depth; i++){
            accum += weight * this.noise(temp_p);
            weight *= 0.5;
            temp_p.mult_inplace(2.0);
        }

        return Math.abs(accum);
    }

    static perlin_generate_perm(): Int32Array{
        let p = new Int32Array(perlin.point_count);
        for(let i = 0, len = p.length; i < len; i++){
            unchecked(p[i] = i);
        }
        perlin.permute(p, perlin.point_count);
        return p;
    }

    static permute(p: Int32Array, n: i32): void{
        for(let i = n - 1; i > 0; i--){
            const target = random_int(0, i);
            const tmp = p[i];
            unchecked(p[i] = p[target]);
            unchecked(p[target] = tmp);
        }
    }

    // c is an array of the length 8
    static trillinear_interp(c: Int32Array, u: f64, v: f64, w: f64): f64{
        let accum: f64 = 0.0;
        for(let i = 0; i < 2; i++){
            for(let j = 0; j < 2; j++){
                for(let k = 0; k < 2; k++){
                    accum += (i*u + (1-i)*(1-u))*(j*v + (1-j)*(1-v))*(k*w + (1-k)*(1-w))*unchecked(c[4*i + 2*j + k]);
                }
            }
        }
        return accum;
    }

    static perlin_interp(c: Array<vec3>, u: f64, v: f64, w: f64): f64 {
            const uu = u*u*(3-2*u);
            const vv = v*v*(3-2*v);
            const ww = w*w*(3-2*w);
            let accum: f64 = 0.0;

            for (let i=0; i < 2; i++){
                for (let j=0; j < 2; j++){
                    for (let k=0; k < 2; k++) {
                        let weight_v = new vec3(u-i, v-j, w-k);
                        accum += (i*uu + (1-i)*(1-uu))
                               * (j*vv + (1-j)*(1-vv))
                               * (k*ww + (1-k)*(1-ww))
                               * dot(unchecked(c[4*i + 2*j + k]), weight_v);
                    }
                }
            }

            return accum;
        }
}