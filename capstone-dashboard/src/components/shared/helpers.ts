export function interpolate(clr1: string, clr2: string, val: number) {
    const r1 = parseInt(clr1.substring(1, 3), 16);
    const g1 = parseInt(clr1.substring(3, 5), 16);
    const b1 = parseInt(clr1.substring(5, 7), 16);

    const r2 = parseInt(clr2.substring(1, 3), 16);
    const g2 = parseInt(clr2.substring(3, 5), 16);
    const b2 = parseInt(clr2.substring(5, 7), 16);

    let rFinal = Math.round(r1 + (r2 - r1) * val);
    let gFinal = Math.round(g1 + (g2 - g1) * val);
    let bFinal = Math.round(b1 + (b2 - b1) * val);

    return `#${rFinal.toString(16).padStart(2, "0")}${gFinal.toString(16).padStart(2, "0")}${bFinal.toString(16).padStart(2, "0")}`
}

export function getContrastColor(hexColor: string) {
    // Remove '#' if present
    const cleanHex = hexColor.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const a = [r, g, b].map((v) => {
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    const luminance = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];

    // Luminance threshold is ~0.179
    return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

export const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);