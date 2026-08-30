import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Theme font sizes from `@theme --text-*` (must not merge with text-color).
      "font-size": [{ text: ["2xs", "chat", "chat-meta", "titlebar", "activity-bar-icon"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
