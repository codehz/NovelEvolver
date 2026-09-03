import {
  StackActions,
  type StaticScreenProps,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { navigationRef } from "../../app/navigation-ref";
import { color, space } from "../theme";
import {
  resolveContextMenuPlacement,
  resolveContextMenuWidth,
  type ContextMenuAnchor,
} from "./context-menu-position";
import { OVERLAY_TIMING, overlayStyles } from "./overlay-chrome";
import { isMenuGroupStart } from "./overlay-menu-model";

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
  detail?: string;
  group?: string;
  destructive?: boolean;
};

export type OverlayMenuParams = {
  anchor: ContextMenuAnchor;
  title?: string;
  selectedKey?: string;
  options: OverlayMenuOption[];
  emptyLabel?: string;
  width?: "default" | "wide";
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
let replaceableMenuRouteKey: string | null = null;

function markMenuReplaceable(routeKey: string): void {
  replaceableMenuRouteKey = routeKey;
}

function clearReplaceableMenu(routeKey: string): void {
  if (replaceableMenuRouteKey === routeKey) {
    replaceableMenuRouteKey = null;
  }
}

type OverlayRouteName = "Alert" | "Confirm" | "Prompt" | "Menu";

function replaceExitingMenu(routeName: OverlayRouteName, params: object): boolean {
  const routeKey = replaceableMenuRouteKey;
  if (routeKey === null) {
    return false;
  }
  const currentRoute = navigationRef.getCurrentRoute();
  if (currentRoute?.name !== "Menu" || currentRoute.key !== routeKey) {
    replaceableMenuRouteKey = null;
    return false;
  }
  replaceableMenuRouteKey = null;
  navigationRef.dispatch({
    ...StackActions.replace(routeName, params),
    source: routeKey,
  });
  return true;
}

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
          const params = {
            title: request.title,
            message: request.message,
            confirmLabel: request.confirmLabel ?? "确定",
          };
          if (!replaceExitingMenu("Alert", params)) {
            navigationRef.navigate("Alert", params);
          }
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
          const params = {
            title: request?.title ?? DEFAULT_CONFIRM.title,
            message: request?.message ?? DEFAULT_CONFIRM.message,
            confirmLabel: request?.confirmLabel ?? DEFAULT_CONFIRM.confirmLabel,
          };
          if (!replaceExitingMenu("Confirm", params)) {
            navigationRef.navigate("Confirm", params);
          }
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
          const params = {
            title: request.title,
            message: request.message,
            placeholder: request.placeholder,
            initialValue: request.initialValue,
            confirmLabel: request.confirmLabel ?? "确认",
          };
          if (!replaceExitingMenu("Prompt", params)) {
            navigationRef.navigate("Prompt", params);
          }
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
          if (!replaceExitingMenu("Menu", request)) {
            navigationRef.navigate("Menu", request);
          }
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

const CONTEXT_MENU_MIN_WIDTH = 168;
const CONTEXT_MENU_WIDE_MIN_WIDTH = 280;
const CONTEXT_MENU_SCREEN_MARGIN = space[2];

export function MenuScreen({ route }: StaticScreenProps<OverlayMenuParams>) {
  const { anchor, title, selectedKey, options, emptyLabel, width = "default" } = route.params;
  const navigation = useNavigation();
  const menuRoute = useRoute();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const closingRef = useRef(false);
  const choiceRef = useRef<string | null>(null);
  const selectionSettledRef = useRef(false);
  const progress = useSharedValue(0);
  const [menuSize, setMenuSize] = useState<{ width: number; height: number } | null>(null);
  const preferredMinimumWidth =
    width === "wide" ? CONTEXT_MENU_WIDE_MIN_WIDTH : CONTEXT_MENU_MIN_WIDTH;
  const { minWidth: minimumWidth, maxWidth: maximumWidth } = resolveContextMenuWidth({
    anchor,
    preferredMinimumWidth,
    viewportWidth,
    insets,
    margin: CONTEXT_MENU_SCREEN_MARGIN,
  });
  const maximumHeight = Math.max(
    44,
    viewportHeight - insets.top - insets.bottom - CONTEXT_MENU_SCREEN_MARGIN * 2,
  );
  const placement =
    menuSize === null
      ? null
      : resolveContextMenuPlacement({
          anchor,
          menuWidth: menuSize.width,
          menuHeight: menuSize.height,
          viewportWidth,
          viewportHeight,
          insets,
          margin: CONTEXT_MENU_SCREEN_MARGIN,
          gap: space[1],
        });

  const finishClose = () => {
    clearReplaceableMenu(menuRoute.key);
    navigation.goBack();
    if (!selectionSettledRef.current) {
      settleMenu(choiceRef.current);
    }
  };

  const requestClose = (value: string | null) => {
    if (closingRef.current) return;
    closingRef.current = true;
    choiceRef.current = value;
    if (value !== null) {
      selectionSettledRef.current = true;
      markMenuReplaceable(menuRoute.key);
      settleMenu(value);
    }
    progress.value = withTiming(0, OVERLAY_TIMING, (finished) => {
      if (finished) scheduleOnRN(finishClose);
    });
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (menuSize !== null) progress.value = withTiming(1, OVERLAY_TIMING);
  }, [menuSize, progress]);

  useEffect(() => {
    return () => {
      clearReplaceableMenu(menuRoute.key);
    };
  }, [menuRoute.key]);

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (closingRef.current) return;
      event.preventDefault();
      requestCloseRef.current(null);
    });
  }, [navigation]);

  const menuAnimatedStyle = useAnimatedStyle(() => {
    const enteringOffset = placement?.side === "above" ? space[1] : -space[1];
    return {
      opacity: progress.value,
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [enteringOffset, 0]) },
        { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
      ],
    };
  });
  const onMenuLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMenuSize((current) =>
      current?.width === width && current.height === height ? current : { width, height },
    );
  };

  return (
    <View style={overlayStyles.root} accessibilityViewIsModal>
      <Pressable
        accessibilityLabel="关闭菜单"
        style={overlayStyles.contextMenuBackdrop}
        onPress={() => requestClose(null)}
      />
      <Animated.View
        accessibilityRole="menu"
        onLayout={onMenuLayout}
        style={[
          overlayStyles.contextMenu,
          {
            left: placement?.left ?? CONTEXT_MENU_SCREEN_MARGIN,
            top: placement?.top ?? CONTEXT_MENU_SCREEN_MARGIN,
            minWidth: minimumWidth,
            maxWidth: maximumWidth,
            maxHeight: maximumHeight,
            opacity: placement === null ? 0 : undefined,
          },
          menuAnimatedStyle,
        ]}
      >
        {title ? (
          <Text style={overlayStyles.contextMenuTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <ScrollView contentContainerStyle={overlayStyles.contextMenuList} bounces={false}>
          {options.length === 0 && emptyLabel ? (
            <Text style={overlayStyles.contextMenuEmpty}>{emptyLabel}</Text>
          ) : null}
          {options.map((option, index) => {
            const selected = option.key === selectedKey;
            const previousOption = options[index - 1];
            const showGroup = isMenuGroupStart(option.group, previousOption?.group);
            return (
              <View key={option.key}>
                {showGroup ? (
                  <Text style={overlayStyles.contextMenuGroupLabel} numberOfLines={1}>
                    {option.group}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    overlayStyles.menuItem,
                    selected && overlayStyles.menuItemSelected,
                    pressed && overlayStyles.menuItemPressed,
                  ]}
                  onPress={() => requestClose(option.key)}
                >
                  <View style={overlayStyles.menuItemContent}>
                    <Text
                      style={[
                        overlayStyles.menuItemLabel,
                        selected && overlayStyles.menuItemLabelSelected,
                        option.destructive && overlayStyles.menuItemDangerLabel,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    {option.detail ? (
                      <Text style={overlayStyles.menuItemDetail} numberOfLines={2}>
                        {option.detail}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
