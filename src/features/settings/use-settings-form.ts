import { useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";

import type { SettingsFormHandle } from "./settings-leave-guard";

type UseSettingsFormOptions<T extends object> = {
  /** Baseline values; identity change resets values + baseline. */
  initial: T;
  formRef?: Ref<SettingsFormHandle | null>;
  onDirtyChange?: (dirty: boolean) => void;
  /** When true, `submit` short-circuits with `false`. */
  busy?: boolean;
  /**
   * Called with current values on submit / leave-save.
   * Return `false` to signal failure; other results count as success.
   */
  onSubmit: (values: T) => boolean | void | Promise<boolean | void>;
  /** Defaults to shallow top-level key comparison. */
  isEqual?: (a: T, b: T) => boolean;
};

type UseSettingsFormResult<T extends object> = {
  values: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setValues: (next: T | ((prev: T) => T)) => void;
  dirty: boolean;
  /** Reset values to baseline, or replace both with `nextBaseline`. */
  reset: (nextBaseline?: T) => void;
  submit: () => Promise<boolean>;
  formElementRef: RefObject<HTMLFormElement | null>;
};

function shallowEqualRecord<T extends object>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }
  const aKeys = Object.keys(a) as (keyof T)[];
  const bKeys = Object.keys(b) as (keyof T)[];
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Thin settings-form state machine: values/baseline, dirty notify, leave-guard save.
 * Validation and payload shaping stay in the form's `onSubmit` wrapper.
 */
export function useSettingsForm<T extends object>({
  initial,
  formRef,
  onDirtyChange,
  busy = false,
  onSubmit,
  isEqual = shallowEqualRecord,
}: UseSettingsFormOptions<T>): UseSettingsFormResult<T> {
  const [values, setValuesState] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);
  const formElementRef = useRef<HTMLFormElement | null>(null);

  const valuesRef = useRef(values);
  valuesRef.current = values;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;

  useEffect(() => {
    setValuesState(initial);
    setBaseline(initial);
  }, [initial]);

  const dirty = !isEqual(values, baseline);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [key]: value }));
  };

  const setValues = (next: T | ((prev: T) => T)) => {
    setValuesState(next);
  };

  const reset = (nextBaseline?: T) => {
    if (nextBaseline !== undefined) {
      setValuesState(nextBaseline);
      setBaseline(nextBaseline);
      return;
    }
    setValuesState(baselineRef.current);
  };

  const submit = async (): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }
    const result = await onSubmitRef.current(valuesRef.current);
    return result !== false;
  };

  useImperativeHandle(formRef, () => ({
    save: submit,
  }));

  return {
    values,
    setField,
    setValues,
    dirty,
    reset,
    submit,
    formElementRef,
  };
}
