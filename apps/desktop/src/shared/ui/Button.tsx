import { Button as BaseButton } from "@base-ui/react/button";

import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button-chrome";

type ButtonProps = BaseButton.Props & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/**
 * Design-system button on top of Base UI Button.
 * Defaults: `type="button"`, `variant="secondary"`, `size="sm"`.
 */
export function Button({
  variant = "secondary",
  size = "sm",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      className={(state) =>
        buttonClassName(
          variant,
          size,
          typeof className === "function" ? className(state) : className,
        )
      }
      {...rest}
    />
  );
}

export type { ButtonProps, ButtonSize, ButtonVariant };
