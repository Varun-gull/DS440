import clsx from "clsx";

/** Show the actual value immediately, including before client hydration. */
export function Metric({ value, className }: { value: number; className?: string; duration?: number; delay?: number }) {
  return <span className={clsx("metric", className)}>{value.toLocaleString()}</span>;
}
