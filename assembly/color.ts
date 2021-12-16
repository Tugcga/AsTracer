import { vec3 } from "./vec3";
import { clamp } from "./utilities";

export function color_string(pixel_color: vec3, samples_per_pixel: i32): string{
    let r = pixel_color.x();
    let g = pixel_color.y();
    let b = pixel_color.z();
    const scale = 1.0 / <f64>samples_per_pixel;
    r = Math.sqrt(scale * r);
    g = Math.sqrt(scale * g);
    b = Math.sqrt(scale * b);
    return (<i32>(256 * clamp(r, 0.0, 0.999))).toString() + " " + 
           (<i32>(256 * clamp(g, 0.0, 0.999))).toString() + " " + 
           (<i32>(256 * clamp(b, 0.0, 0.999))).toString() + "\n";
}

@inline
export function value_linear_to_srgb(value: f64): f64{
    if (value < 0.0031308){
        return (value < 0.0) ? 0.0 : value * 12.92;
    }
    else{
        return 1.055 * Math.pow(value, 1.0 / 2.4) - 0.055;
    }
}

@inline
export function value_srgb_to_linear(value: f64): f64{
    if (value < 0.04045){
        return (value < 0.0) ? 0.0 : value * (1.0 / 12.92);
    }
    else{
        return Math.pow((value + 0.055) * (1.0 / 1.055), 2.4);
    }
}

@inline
export function linear_to_srgb(color: vec3): vec3{
    return new vec3(value_linear_to_srgb(color.x()), value_linear_to_srgb(color.y()), value_linear_to_srgb(color.z()));
}

@inline
export function srgb_to_linear(color: vec3): vec3{
    return new vec3(value_srgb_to_linear(color.x()), value_srgb_to_linear(color.y()), value_srgb_to_linear(color.z()));
}