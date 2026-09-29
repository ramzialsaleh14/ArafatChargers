// Barcode / QR helpers.
//
// Both symbols are generated as SVG strings so the exact same representation
// can be used on screen (react-native-svg <SvgXml />) and in the printed
// receipt (inline SVG inside the HTML) on both web and native - no raster
// image or canvas is required.
//
// Uses the platform-agnostic SVG drawing interface of bwip-js ("generic"
// subpath) which is pure JavaScript and works in every runtime.
import { toSVG } from 'bwip-js/generic';

// Small cache so the same code is not re-encoded on every render.
const cache = new Map();

// bwip-js emits `viewBox="0 0 <w> <h>"`; pull the natural pixel size out.
const VIEW_BOX = /viewBox="0 0\s+([\d.]+)\s+([\d.]+)"/;

const build = (key, options) => {
    if (cache.has(key)) {
        return cache.get(key);
    }

    let model = null;
    try {
        const svg = toSVG(options);
        const match = VIEW_BOX.exec(svg);
        model = {
            svg,
            width: match ? Number(match[1]) : 0,
            height: match ? Number(match[2]) : 0,
        };
    } catch (error) {
        console.error(`bwip-js "${options.bcid}" generation failed:`, error);
        model = null;
    }

    cache.set(key, model);
    return model;
};

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

    return build(`c128|${text}|${scale}|${height}`, {
        bcid: 'code128',
        text,
        scale,
        height,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
    });
}

/**
 * Builds a QR code for `value`. Same value as the barcode, rendered as a
 * square 2D symbol.
 *
 * @param {string|number} value - Value to encode.
 * @param {{ scale?: number, padding?: number }} [options]
 *   scale   - module scaling factor (default 6).
 *   padding - quiet zone in modules (default 4, the spec minimum).
 * @returns {{ svg: string, width: number, height: number } | null}
 */
export function getQrCode(value, options = {}) {
    const text = String(value ?? '').trim();
    if (!text) {
        return null;
    }

    const scale = options.scale ?? 6;
    const padding = options.padding ?? 4;

    return build(`qr|${text}|${scale}|${padding}`, {
        bcid: 'qrcode',
        text,
        scale,
        eclevel: 'M',
        paddingwidth: padding,
        paddingheight: padding,
    });
}
