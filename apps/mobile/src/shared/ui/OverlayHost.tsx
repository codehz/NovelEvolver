import { type StaticScreenProps, useNavigation } from "@react-navigation/native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { navigationRef } from "../../app/navigation-ref";
import { color } from "../theme";
import { OVERLAY_TIMING, overlayStyles } from "./overlay-chrome";

export type OverlayAlertParams = {
  title: string;
  message: string;
  confirmLabel: string;
};

export type OverlayConfirmParams = {
  title: string;
  message: string;
  confirmLabel: string;
};

export type OverlayPromptParams = {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel: string;
};

export type OverlayMenuOption = {
  key: string;
  label: string;
  destructive?: boolean;
};

export type OverlayMenuParams = {
  title: string;
  options: OverlayMenuOption[];
};

export type OverlayAlertRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
};

export type OverlayConfirmRequest = Partial<OverlayConfirmParams>;

export type OverlayPromptRequest = {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
};

export type OverlayMenuRequest = OverlayMenuParams;

type OverlayApi = {
  alert: (request: OverlayAlertRequest) => Promise<void>;
  confirm: (request?: OverlayConfirmRequest) => Promise<boolean>;
  prompt: (request: OverlayPromptRequest) => Promise<string | null>;
  menu: (request: OverlayMenuRequest) => Promise<string | null>;
};

const OverlayContext = createContext<OverlayApi | null>(null);

const DEFAULT_CONFIRM: OverlayConfirmParams = {
  title: "未保存的更改",
  message: "离开将丢弃未保存的更改。",
  confirmLabel: "丢弃",
};

let pendingAlert: (() => void) | null = null;
let pendingConfirm: ((ok: boolean) => void) | null = null;
let pendingPrompt: ((value: string | null) => void) | null = null;
let pendingMenu: ((key: string | null) => void) | null = null;

function settleAlert(_value: undefined): void {
  const resolve = pendingAlert;
  pendingAlert = null;
  resolve?.();
}

function settleConfirm(ok: boolean): void {
  const resolve = pendingConfirm;
  pendingConfirm = null;
  resolve?.(ok);
}

function settlePrompt(value: string | null): void {
  const resolve = pendingPrompt;
  pendingPrompt = null;
  resolve?.(value);
}

function settleMenu(key: string | null): void {
  const resolve = pendingMenu;
  pendingMenu = null;
  resolve?.(key);
}

export function useOverlay(): OverlayApi {
  const overlay = useContext(OverlayContext);
  if (!overlay) {
    throw new Error("useOverlay must be used within OverlayHost");
  }
  return overlay;
}

export function useConfirm(): OverlayApi["confirm"] {
  return useOverlay().confirm;
}

type OverlayHostProps = {
  children: ReactNode;
};

export function OverlayHost({ children }: OverlayHostProps) {
  const overlay = useMemo<OverlayApi>(
    () => ({
      alert(request) {
        return new Promise((resolve) => {
          if (!navigationRef.isReady()) {
            resolve();
            return;
          }
          pendingAlert?.();
          pendingAlert = resolve;
          navigationRef.navigate("Alert", {
            title: request.title,
            message: request.message,
            confirmLabel: request.confirmLabel ?? "确定",
          });
        });
      },
      confirm(request) {
        return new Promise((resolve) => {
          if (!navigationRef.isReady()) {
            resolve(false);
            return;
          }
          pendingConfirm?.(false);
          pendingConfirm = resolve;
          navigationRef.navigate("Confirm", {
            title: request?.title ?? DEFAULT_CONFIRM.title,
            message: request?.message ?? DEFAULT_CONFIRM.message,
            confirmLabel: request?.confirmLabel ?? DEFAULT_CONFIRM.confirmLabel,
          });
        });
      },
      prompt(request) {
        return new Promise((resolve) => {
          if (!navigationRef.isReady()) {
            resolve(null);
            return;
          }
          pendingPrompt?.(null);
          pendingPrompt = resolve;
          navigationRef.navigate("Prompt", {
            title: request.title,
            message: request.message,
            placeholder: request.placeholder,
            initialValue: request.initialValue,
            confirmLabel: request.confirmLabel ?? "确认",
          });
        });
      },
      menu(request) {
        return new Promise((resolve) => {
          if (!navigationRef.isReady()) {
            resolve(null);
            return;
          }
          pendingMenu?.(null);
          pendingMenu = resolve;
          navigationRef.navigate("Menu", request);
        });
      },
    }),
    [],
  );

  return <OverlayContext.Provider value={overlay}>{children}</OverlayContext.Provider>;
}

type OverlayShellProps<T> = {
  dismissValue: T;
  settle: (value: T) => void;
  avoidKeyboard?: boolean;
  children: (requestClose: (value: T) => void) => ReactNode;
};

function OverlayShell<T>({
  dismissValue,
  settle,
  avoidKeyboard = false,
  children,
}: OverlayShellProps<T>) {
  const navigation = useNavigation();
  const closingRef = useRef(false);
  const choiceRef = useRef(dismissValue);
  const progress = useSharedValue(0);

  const finishClose = () => {
    navigation.goBack();
    settle(choiceRef.current);
  };

  const requestClose = (value: T) => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    choiceRef.current = value;
    progress.value = withTiming(0, OVERLAY_TIMING, (finished) => {
      if (finished) {
        scheduleOnRN(finishClose);
      }
    });
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    progress.value = withTiming(1, OVERLAY_TIMING);
  }, [progress]);

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (closingRef.current) {
        return;
      }
      event.preventDefault();
      requestCloseRef.current(dismissValue);
    });
  }, [dismissValue, navigation]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  return (
    <View style={overlayStyles.root} accessibilityViewIsModal>
      <Animated.View style={[overlayStyles.backdrop, overlayStyle]} collapsable={false}>
        <Pressable
          accessibilityLabel="取消"
          style={StyleSheet.absoluteFill}
          onPress={() => {
            requestClose(dismissValue);
          }}
        />
        <KeyboardAvoidingView
          enabled={avoidKeyboard}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={overlayStyles.frame}
        >
          <Animated.View accessibilityRole="alert" style={[overlayStyles.card, cardStyle]}>
            {children(requestClose)}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

export function AlertScreen({ route }: StaticScreenProps<OverlayAlertParams>) {
  const { title, message, confirmLabel } = route.params;
  return (
    <OverlayShell dismissValue={undefined} settle={settleAlert}>
      {(requestClose) => (
        <>
          <Text style={overlayStyles.title}>{title}</Text>
          <Text style={overlayStyles.message}>{message}</Text>
          <View style={overlayStyles.actions}>
            <Pressable style={overlayStyles.primary} onPress={() => requestClose(undefined)}>
              <Text style={overlayStyles.primaryLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </>
      )}
    </OverlayShell>
  );
}

export function ConfirmScreen({ route }: StaticScreenProps<OverlayConfirmParams>) {
  const { title, message, confirmLabel } = route.params;
  return (
    <OverlayShell dismissValue={false} settle={settleConfirm}>
      {(requestClose) => (
        <>
          <Text style={overlayStyles.title}>{title}</Text>
          <Text style={overlayStyles.message}>{message}</Text>
          <View style={overlayStyles.actions}>
            <Pressable style={overlayStyles.secondary} onPress={() => requestClose(false)}>
              <Text style={overlayStyles.secondaryLabel}>取消</Text>
            </Pressable>
            <Pressable style={overlayStyles.danger} onPress={() => requestClose(true)}>
              <Text style={overlayStyles.dangerLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </>
      )}
    </OverlayShell>
  );
}

export function PromptScreen({ route }: StaticScreenProps<OverlayPromptParams>) {
  const { title, message, placeholder, initialValue = "", confirmLabel } = route.params;
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <OverlayShell<string | null> dismissValue={null} settle={settlePrompt} avoidKeyboard>
      {(requestClose) => (
        <>
          <Text style={overlayStyles.title}>{title}</Text>
          {message ? <Text style={overlayStyles.message}>{message}</Text> : null}
          <TextInput
            autoFocus
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={color.placeholder}
            selectionColor={color.accent}
            style={overlayStyles.input}
            onSubmitEditing={() => {
              if (trimmed !== "") {
                requestClose(trimmed);
              }
            }}
          />
          <View style={overlayStyles.actions}>
            <Pressable style={overlayStyles.secondary} onPress={() => requestClose(null)}>
              <Text style={overlayStyles.secondaryLabel}>取消</Text>
            </Pressable>
            <Pressable
              style={overlayStyles.primary}
              disabled={trimmed === ""}
              onPress={() => {
                requestClose(trimmed);
              }}
            >
              <Text
                style={[overlayStyles.primaryLabel, trimmed === "" && overlayStyles.disabledLabel]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </OverlayShell>
  );
}

export function MenuScreen({ route }: StaticScreenProps<OverlayMenuParams>) {
  const { title, options } = route.params;

  return (
    <OverlayShell<string | null> dismissValue={null} settle={settleMenu}>
      {(requestClose) => (
        <>
          <Text style={overlayStyles.title}>{title}</Text>
          <View style={overlayStyles.menu}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                style={({ pressed }) => [
                  overlayStyles.menuItem,
                  pressed && overlayStyles.menuItemPressed,
                ]}
                onPress={() => requestClose(option.key)}
              >
                <Text
                  style={[
                    overlayStyles.menuItemLabel,
                    option.destructive && overlayStyles.menuItemDangerLabel,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={overlayStyles.actions}>
            <Pressable style={overlayStyles.secondary} onPress={() => requestClose(null)}>
              <Text style={overlayStyles.secondaryLabel}>取消</Text>
            </Pressable>
          </View>
        </>
      )}
    </OverlayShell>
  );
}
