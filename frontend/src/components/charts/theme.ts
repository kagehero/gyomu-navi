/**
 * Shared chart color palette. We use literal HSL values for recharts because
 * the chart library reads colors at JS-evaluation time, before CSS variables
 * are resolved. Keep these in sync with --primary/--success/etc in globals.css.
 */
export const CHART_COLORS = {
  primary: "hsl(215, 70%, 45%)",
  primarySoft: "hsl(215, 70%, 75%)",
  success: "hsl(150, 60%, 40%)",
  successSoft: "hsl(150, 60%, 70%)",
  warning: "hsl(38, 90%, 50%)",
  destructive: "hsl(0, 70%, 55%)",
  axis: "hsl(215, 15%, 50%)",
  grid: "hsl(214, 20%, 90%)",
  surface: "hsl(0, 0%, 100%)",
} as const;

/** Palette used for categorical breakdowns (donuts, stacked bars). */
export const CATEGORY_PALETTE: readonly string[] = [
  "hsl(215, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(38, 90%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(190, 70%, 45%)",
  "hsl(0, 70%, 60%)",
  "hsl(45, 70%, 50%)",
  "hsl(330, 60%, 55%)",
];

export const TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.grid}`,
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
} as const;

export const AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 10 } as const;
