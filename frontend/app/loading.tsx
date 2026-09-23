// Intentionally empty — NavigationProgress in layout.tsx handles the loading bar.
// Returning null here prevents Next.js from replacing the current page with a skeleton.
export default function Loading() {
  return null;
}
