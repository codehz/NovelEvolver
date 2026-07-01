import { mergeRefs } from "foxact/merge-refs";
import { ComponentPropsWithRef, useCallback, useEffect, useRef } from "react";
import { SlotOptions, slotText, SlotTextController } from "slot-text";

/**
 * Controlled wrapper around the imperative `slotText()` API.
 * Prefer this over `slot-text/react` for consistent lifecycle control.
 */
export function SlotText({
  text,
  options,
  ref,
  ...props
}: { text: string; options?: SlotOptions } & ComponentPropsWithRef<"span">) {
  const initial = useRef({ text, options });
  const controller = useRef<SlotTextController>(null);
  useEffect(() => {
    if (controller.current) {
      controller.current.set(text, options);
    }
  }, [text, options]);
  const refCallback = useCallback((input: HTMLSpanElement) => {
    const local = (controller.current = slotText(
      input,
      initial.current.text,
      initial.current.options,
    ));
    return () => local.destroy();
  }, []);
  return <span ref={mergeRefs(ref, refCallback)} {...props}></span>;
}
