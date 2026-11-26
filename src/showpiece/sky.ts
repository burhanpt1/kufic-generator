// The sky over a place at a moment, drawn as an astrolabe's plate draws it: a stereographic projection from the
// zenith, the horizon its outer circle, almucantars (circles of equal altitude) and azimuths about it, and the
// ecliptic across it. Bright stars are placed from J2000 positions (precession over 26 years, under a third of a
// degree, is ignored: invisible at this scale); those the medieval star books named in Arabic carry their names.
import type { Pt } from '../geometry/types';

export interface Star {
  /** Right ascension (hours), declination (degrees), visual magnitude. */
  ra: number;
  dec: number;
  mag: number;
  /** The star's Arabic name, where its common name descends from one (or the name the Arabic star books used). */
  ar?: string;
  /** A cluster rather than a star (drawn as a knot of dots). */
  cluster?: boolean;
}

/** Bright stars of the northern sky, J2000. */
export const STARS: Star[] = [
  { ra: 6.752, dec: -16.72, mag: -1.46, ar: 'الشعرى' }, // Sirius
  { ra: 14.261, dec: 19.18, mag: -0.05, ar: 'السماك الرامح' }, // Arcturus
  { ra: 18.616, dec: 38.78, mag: 0.03, ar: 'النسر الواقع' }, // Vega
  { ra: 5.278, dec: 46.0, mag: 0.08, ar: 'العيوق' }, // Capella
  { ra: 5.242, dec: -8.2, mag: 0.13, ar: 'رجل الجوزاء' }, // Rigel
  { ra: 7.655, dec: 5.22, mag: 0.34, ar: 'الغميصاء' }, // Procyon
  { ra: 5.919, dec: 7.41, mag: 0.5, ar: 'يد الجوزاء' }, // Betelgeuse
  { ra: 19.846, dec: 8.87, mag: 0.77, ar: 'النسر الطائر' }, // Altair
  { ra: 4.599, dec: 16.51, mag: 0.85, ar: 'الدبران' }, // Aldebaran
  { ra: 7.755, dec: 28.03, mag: 1.14 }, // Pollux
  { ra: 22.961, dec: -29.62, mag: 1.16, ar: 'فم الحوت' }, // Fomalhaut
  { ra: 20.69, dec: 45.28, mag: 1.25, ar: 'ذنب الدجاجة' }, // Deneb
  { ra: 10.139, dec: 11.97, mag: 1.35, ar: 'قلب الأسد' }, // Regulus
  { ra: 7.577, dec: 31.89, mag: 1.58 }, // Castor
  { ra: 5.438, dec: 28.61, mag: 1.65 }, // Elnath
  { ra: 5.419, dec: 6.35, mag: 1.64 }, // Bellatrix
  { ra: 5.604, dec: -1.2, mag: 1.69, ar: 'النظام' }, // Alnilam
  { ra: 5.679, dec: -1.94, mag: 1.74 }, // Alnitak
  { ra: 5.533, dec: -0.3, mag: 2.23 }, // Mintaka
  { ra: 12.9, dec: 55.96, mag: 1.77 }, // Alioth
  { ra: 11.062, dec: 61.75, mag: 1.79, ar: 'الدب' }, // Dubhe
  { ra: 3.405, dec: 49.86, mag: 1.79 }, // Mirfak
  { ra: 13.792, dec: 49.31, mag: 1.86, ar: 'القائد' }, // Alkaid
  { ra: 5.992, dec: 44.95, mag: 1.9 }, // Menkalinan
  { ra: 6.629, dec: 16.4, mag: 1.93 }, // Alhena
  { ra: 2.53, dec: 89.26, mag: 1.98, ar: 'الجدي' }, // Polaris
  { ra: 6.378, dec: -17.96, mag: 1.98 }, // Mirzam
  { ra: 2.12, dec: 23.46, mag: 2.0, ar: 'الحمل' }, // Hamal
  { ra: 3.136, dec: 40.96, mag: 2.1, ar: 'رأس الغول' }, // Algol
  { ra: 13.399, dec: 54.93, mag: 2.23 }, // Mizar
  { ra: 0.14, dec: 29.09, mag: 2.06, ar: 'سرة الفرس' }, // Alpheratz
  { ra: 0.675, dec: 56.54, mag: 2.24, ar: 'الصدر' }, // Schedar
  { ra: 0.153, dec: 59.15, mag: 2.28, ar: 'الكف' }, // Caph
  { ra: 0.945, dec: 60.72, mag: 2.15 }, // γ Cas
  { ra: 1.43, dec: 60.24, mag: 2.7 }, // Ruchbah
  { ra: 1.907, dec: 63.67, mag: 3.35 }, // Segin
  { ra: 5.796, dec: -9.67, mag: 2.06 }, // Saiph
  { ra: 11.031, dec: 56.38, mag: 2.37 }, // Merak
  { ra: 11.897, dec: 53.69, mag: 2.44 }, // Phecda
  { ra: 12.257, dec: 57.03, mag: 3.3 }, // Megrez
  { ra: 21.736, dec: 9.88, mag: 2.38 }, // Enif
  { ra: 23.063, dec: 28.08, mag: 2.42 }, // Scheat
  { ra: 23.079, dec: 15.21, mag: 2.48, ar: 'مركب' }, // Markab
  { ra: 0.221, dec: 15.18, mag: 2.83 }, // Algenib
  { ra: 3.038, dec: 4.09, mag: 2.54 }, // Menkar
  { ra: 11.818, dec: 14.57, mag: 2.13 }, // Denebola
  { ra: 15.578, dec: 26.71, mag: 2.2 }, // Alphecca
  { ra: 17.582, dec: 12.56, mag: 2.08 }, // Rasalhague
  { ra: 14.845, dec: 74.16, mag: 2.08 }, // Kochab
  { ra: 20.37, dec: 40.26, mag: 2.23 }, // Sadr
  { ra: 20.77, dec: 33.97, mag: 2.48 }, // Gienah
  { ra: 19.512, dec: 27.96, mag: 3.05 }, // Albireo
  { ra: 1.163, dec: 35.62, mag: 2.05 }, // Mirach
  { ra: 2.065, dec: 42.33, mag: 2.1 }, // Almach
  { ra: 0.727, dec: -17.99, mag: 2.04 }, // Diphda
  { ra: 3.791, dec: 24.1, mag: 1.6, ar: 'الثريا', cluster: true }, // the Pleiades
];

const RAD = Math.PI / 180;
/** Obliquity of the ecliptic (degrees). */
const OBLIQUITY = 23.44;

/** Local sidereal time (degrees) at a UTC moment and longitude (degrees east). */
export function lst(date: Date, lon: number): number {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  return (((280.46061837 + 360.98564736629 * d + lon) % 360) + 360) % 360;
}

/** Altitude and azimuth (degrees; azimuth from north through east) of a star for an observer. */
export function altAz(raH: number, dec: number, lat: number, lstDeg: number): { alt: number; az: number } {
  const H = (lstDeg - raH * 15) * RAD,
    d = dec * RAD,
    p = lat * RAD,
    sinAlt = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H),
    alt = Math.asin(sinAlt),
    az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(H));
  return { alt: alt / RAD, az: (((az / RAD) % 360) + 360) % 360 };
}

/** Right ascension (hours) and declination of a point on the ecliptic at longitude λ (degrees). */
export function eclipticPoint(lambda: number): { ra: number; dec: number } {
  const l = lambda * RAD,
    e = OBLIQUITY * RAD,
    ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)),
    dec = Math.asin(Math.sin(l) * Math.sin(e));
  return { ra: ((((ra / RAD) % 360) + 360) % 360) / 15, dec: dec / RAD };
}

/** The astrolabe's projection: zenith at c, horizon at radius R, north up and east to the left (the sky seen from
 *  beneath). */
export function project(alt: number, az: number, c: Pt, R: number): Pt {
  const r = R * Math.tan(((90 - alt) / 2) * RAD);
  return [c[0] - r * Math.sin(az * RAD), c[1] - r * Math.cos(az * RAD)];
}

// ---------- the Moon and the planets ----------
// Low-precision positions from mean orbital elements (Paul Schlyter's "How to compute planetary positions"): the
// Moon with its largest perturbations (within a quarter of a degree), the planets without theirs (within a degree
// or so for Jupiter and Saturn). Geocentric; at this chart's scale the Moon's parallax doesn't show.

export type Wanderer = 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
export const WANDERERS: Record<Wanderer, { ar: string }> = {
  moon: { ar: 'القمر' },
  mercury: { ar: 'عطارد' },
  venus: { ar: 'الزهرة' },
  mars: { ar: 'المريخ' },
  jupiter: { ar: 'المشتري' },
  saturn: { ar: 'زحل' },
};

interface Elements {
  N: number;
  i: number;
  w: number;
  a: number;
  e: number;
  M: number;
}
const rev = (x: number) => ((x % 360) + 360) % 360;
/** Orbital elements at d days from 31 December 1999, 0h UT. */
const ELEMENTS: Record<Wanderer | 'sun', (d: number) => Elements> = {
  sun: d => ({ N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.047 + 0.9856002585 * d }), // prettier-ignore
  moon: d => ({ N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.0549, M: 115.3654 + 13.0649929509 * d }), // prettier-ignore
  mercury: d => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.0e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }), // prettier-ignore
  venus: d => ({ N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d, a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }), // prettier-ignore
  mars: d => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }), // prettier-ignore
  jupiter: d => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d }), // prettier-ignore
  saturn: d => ({ N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d }), // prettier-ignore
};

/** Position in the orbit's own plane turned into ecliptic rectangular coordinates (the body's own units). */
function inOrbit(el: Elements): [number, number, number] {
  const M = rev(el.M) * RAD;
  let E = M + el.e * Math.sin(M) * (1 + el.e * Math.cos(M));
  for (let k = 0; k < 8; k++) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  const xv = el.a * (Math.cos(E) - el.e),
    yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E),
    v = Math.atan2(yv, xv),
    r = Math.hypot(xv, yv),
    N = el.N * RAD,
    u = v + el.w * RAD,
    i = el.i * RAD;
  return [
    r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(i)),
    r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(i)),
    r * Math.sin(u) * Math.sin(i),
  ];
}

export interface WandererAt {
  body: Wanderer;
  /** Right ascension (hours), declination (degrees), ecliptic longitude (degrees). */
  ra: number;
  dec: number;
  lon: number;
  /** The Moon only: the lit share of its disc (0 new, 1 full), and whether it is waxing. */
  lit?: number;
  waxing?: boolean;
}

/** The Moon and the five naked-eye planets at a UTC moment, geocentric. */
export function wanderers(date: Date): WandererAt[] {
  const d = date.getTime() / 86400000 - 10956, // days since 1999-12-31 0h UT
    sunEl = ELEMENTS.sun(d),
    [xs, ys] = inOrbit(sunEl),
    sunLon = rev(Math.atan2(ys, xs) / RAD),
    ecl = (23.4393 - 3.563e-7 * d) * RAD,
    out: WandererAt[] = [];
  const equatorial = (x: number, y: number, z: number) => {
    const ye = y * Math.cos(ecl) - z * Math.sin(ecl),
      ze = y * Math.sin(ecl) + z * Math.cos(ecl);
    return { ra: rev(Math.atan2(ye, x) / RAD) / 15, dec: Math.atan2(ze, Math.hypot(x, ye)) / RAD };
  };
  for (const body of Object.keys(WANDERERS) as Wanderer[]) {
    const el = ELEMENTS[body](d);
    let [x, y, z] = inOrbit(el);
    if (body === 'moon') {
      // the largest perturbations of the Moon's longitude and latitude
      const r = Math.hypot(x, y, z),
        Ms = rev(sunEl.M) * RAD,
        Mm = rev(el.M) * RAD,
        Lm = rev(el.M + el.w + el.N),
        D = rev(Lm - rev(sunEl.M + sunEl.w)) * RAD,
        F = rev(Lm - el.N) * RAD,
        lon =
          Math.atan2(y, x) / RAD -
          1.274 * Math.sin(Mm - 2 * D) +
          0.658 * Math.sin(2 * D) -
          0.186 * Math.sin(Ms) -
          0.059 * Math.sin(2 * Mm - 2 * D) -
          0.057 * Math.sin(Mm - 2 * D + Ms) +
          0.053 * Math.sin(Mm + 2 * D) +
          0.046 * Math.sin(2 * D - Ms) +
          0.041 * Math.sin(Mm - Ms) -
          0.035 * Math.sin(D) -
          0.031 * Math.sin(Mm + Ms) -
          0.015 * Math.sin(2 * F - 2 * D) +
          0.011 * Math.sin(Mm - 4 * D),
        lat =
          Math.atan2(z, Math.hypot(x, y)) / RAD -
          0.173 * Math.sin(F - 2 * D) -
          0.055 * Math.sin(Mm - F - 2 * D) -
          0.046 * Math.sin(Mm + F - 2 * D) +
          0.033 * Math.sin(F + 2 * D) +
          0.017 * Math.sin(2 * Mm + F);
      x = r * Math.cos(lon * RAD) * Math.cos(lat * RAD);
      y = r * Math.sin(lon * RAD) * Math.cos(lat * RAD);
      z = r * Math.sin(lat * RAD);
      const elong = rev(lon - sunLon);
      out.push({
        body,
        ...equatorial(x, y, z),
        lon: rev(lon),
        lit: (1 - Math.cos(elong * RAD)) / 2,
        waxing: elong < 180,
      });
      continue;
    }
    // heliocentric to geocentric: add the Sun's geocentric position
    x += xs;
    y += ys;
    out.push({ body, ...equatorial(x, y, z), lon: rev(Math.atan2(y, x) / RAD) });
  }
  return out;
}
