export const STAGE_COLORS: Record<number, { bg: string; accent: string; badge: string; text: string }> = {
  0: { bg: "bg-blue-50 dark:bg-blue-950/30", accent: "bg-blue-500", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", text: "text-blue-700 dark:text-blue-300" },
  1: { bg: "bg-emerald-50 dark:bg-emerald-950/30", accent: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", text: "text-emerald-700 dark:text-emerald-300" },
  2: { bg: "bg-violet-50 dark:bg-violet-950/30", accent: "bg-violet-500", badge: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200", text: "text-violet-700 dark:text-violet-300" },
  3: { bg: "bg-amber-50 dark:bg-amber-950/30", accent: "bg-amber-500", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", text: "text-amber-700 dark:text-amber-300" },
  4: { bg: "bg-rose-50 dark:bg-rose-950/30", accent: "bg-rose-500", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200", text: "text-rose-700 dark:text-rose-300" },
  5: { bg: "bg-cyan-50 dark:bg-cyan-950/30", accent: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", text: "text-cyan-700 dark:text-cyan-300" },
  6: { bg: "bg-orange-50 dark:bg-orange-950/30", accent: "bg-orange-500", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", text: "text-orange-700 dark:text-orange-300" },
  7: { bg: "bg-teal-50 dark:bg-teal-950/30", accent: "bg-teal-500", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200", text: "text-teal-700 dark:text-teal-300" },
  8: { bg: "bg-pink-50 dark:bg-pink-950/30", accent: "bg-pink-500", badge: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200", text: "text-pink-700 dark:text-pink-300" },
  9: { bg: "bg-indigo-50 dark:bg-indigo-950/30", accent: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", text: "text-indigo-700 dark:text-indigo-300" },
  10: { bg: "bg-lime-50 dark:bg-lime-950/30", accent: "bg-lime-500", badge: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200", text: "text-lime-700 dark:text-lime-300" },
  11: { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", accent: "bg-fuchsia-500", badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200", text: "text-fuchsia-700 dark:text-fuchsia-300" },
};

export function getStageColor(index: number) {
  return STAGE_COLORS[index % Object.keys(STAGE_COLORS).length];
}
