// Scene constants for the tank.
//
// All the geometry that used to live here is gone — the well is now the Toorji
// Ka Jhalra scan (assets/stepwell.glb), which has real criss-cross flights
// instead of the offset box rows that produced the plaid. This file survives
// only to hold the measurements everything else is placed against.

// Footprint the model is scaled to, and the depth that falls out of it.
export const WELL_WIDTH = 52;
export const WELL_DEPTH = 19.75;

// Toorji Ka Jhalra holds water low in the shaft; roughly two thirds of the
// flights stay dry and walkable above it.
export const WATER_Y = -12.6;

// The shaft has narrowed considerably by the waterline.
export const WATER_HALF = 13.0;
