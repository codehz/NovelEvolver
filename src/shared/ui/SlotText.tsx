import { PresenceHost } from "@codehz/auto-transition";
import { mergeRefs } from "foxact/merge-refs";
import { ComponentPropsWithRef, useCallback, useEffect, useRef } from "react";
import { SlotOptions, slotText, SlotTextController } from "slot-text";

type SlotTextProps = { text: string; options?: SlotOptions } & ComponentPropsWithRef<"span">;

/**
 * Controlled wrapper around the imperative `slotText()` API.
 * Prefer this over `slot-text/react` for consistent lifecycle control.
 */
export function SlotText({ text, options, ref, ...props }: SlotTextProps) {
  const initial = useRef({ text, options });
  const controller = useRef<SlotTextController>(null);
  useEffect(() => {
    if (controller.current && controller.current.value !== text) {
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

  return <PresenceHost ref={useCallback(mergeRefs(ref, refCallback), [ref])} {...props} />;
}
