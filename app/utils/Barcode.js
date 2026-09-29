// Code 128 barcode helper.
//
// The barcode is generated as an SVG string so the exact same representation
// can be used on screen (react-native-svg <SvgXml />) and in the printed
// receipt (inline SVG inside the HTML) on both web and native - no raster
// image or canvas is required.
//
// Uses the platform-agnostic SVG drawing interface of bwip-js ("generic"
// subpath) which is pure JavaScript and works in every runtime.
import { toSVG } from 'bwip-js/generic';

// Small cache so the same code is not re-encoded on every render.
const cache = new Map();

/**
 * Builds a Code 128 (1D) barcode for `value`.
 *
 * @param {string|number} value - Value to encode.
 * @param {{ scale?: number, height?: number }} [options]
 *   scale  - module scaling factor (default 3).
 *   height - bar height in millimetres (default 12).
 * @returns {{ svg: string, width: number, height: number } | null}
 *   The SVG markup plus its natural size in pixels, or null when the value
 *   is empty or cannot be encoded (e.g. characters outside the Code 128 set).
 */
export function getCode128Barcode(value, options = {}) {
    const text = String(value ?? '').trim();
    if (!text) {
        return null;
    }

    const scale = options.scale ?? 3;
    const height = options.height ?? 12; // bar height in mm
    const key = `${text}|${scale}|${height}`;

    if (cache.has(key)) {
        return cache.get(key);
    }

    let model = null;
    try {
        const svg = toSVG({
            bcid: 'code128',
            text,
            scale,
            height,
            includetext: false,
            paddingwidth: 0,
            paddingheight: 0,
        });

        const match = /viewBox="0 0\s+([\d.]+)\s+([\d.]+)"/.exec(svg);
        model = {
            svg,
            width: match ? Number(match[1]) : 0,
            height: match ? Number(match[2]) : 0,
        };
    } catch (error) {
        console.error('Code 128 generation failed:', error);
        model = null;
    }

    cache.set(key, model);
    return model;
}
