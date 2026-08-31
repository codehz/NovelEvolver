import { type StaticScreenProps, useNavigation } from "@react-navigation/native";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { navigationRef } from "../../app/navigation-ref";
import type { ConfirmParams } from "../../app/navigation-types";
import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import { setSettingsLeaveConfirm } from "./settings-leave-guard";

type ConfirmFn = (request?: Partial<ConfirmParams>) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const OVERLAY_TIMING = {
  duration: 220,
  easing: Easing.bezier(0.33, 1, 0.68, 1),
};

const DEFAULT_CONFIRM: ConfirmParams = {
  title: "未保存的更改",
  message: "离开将丢弃未保存的更改。",
  confirmLabel: "丢弃",
};

let pendingResolve: ((ok: boolean) => void) | null = null;

function settleConfirm(ok: boolean): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  resolve?.(ok);
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmHost");
  }
  return confirm;
}

type ConfirmHostProps = {
  children: ReactNode;
};

export function ConfirmHost({ children }: ConfirmHostProps) {
  const confirm = useMemo<ConfirmFn>(() => {
    return (next) =>
      new Promise<boolean>((resolve) => {
        if (!navigationRef.isReady()) {
          resolve(false);
          return;
        }
        pendingResolve?.(false);
        pendingResolve = resolve;
        navigationRef.navigate("Confirm", {
          title: next?.title ?? DEFAULT_CONFIRM.title,
          message: next?.message ?? DEFAULT_CONFIRM.message,
          confirmLabel: next?.confirmLabel ?? DEFAULT_CONFIRM.confirmLabel,
        });
      });
  }, []);

  useEffect(() => {
    setSettingsLeaveConfirm(() => confirm());
    return () => {
      setSettingsLeaveConfirm(null);
      settleConfirm(false);
    };
  }, [confirm]);

  return <ConfirmContext.Provider value={confirm}>{children}</ConfirmContext.Provider>;
}

export function ConfirmScreen({ route }: StaticScreenProps<ConfirmParams>) {
  const navigation = useNavigation();
  const { title, message, confirmLabel } = route.params;
  const closingRef = useRef(false);
  const choiceRef = useRef(false);
  const progress = useSharedValue(0);

  const finishClose = () => {
    navigation.goBack();
    settleConfirm(choiceRef.current);
  };

  const requestClose = (ok: boolean) => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    choiceRef.current = ok;
    progress.value = withTiming(0, OVERLAY_TIMING, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
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
      requestCloseRef.current(false);
    });
  }, [navigation]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[styles.backdrop, overlayStyle]} collapsable={false}>
        <Pressable
          accessibilityLabel="取消"
          style={StyleSheet.absoluteFill}
          onPress={() => {
            requestClose(false);
          }}
        />
        <Animated.View accessibilityRole="alert" style={[styles.card, cardStyle]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                requestClose(false);
              }}
            >
              <Text style={styles.secondaryLabel}>取消</Text>
            </Pressable>
            <Pressable
              style={styles.danger}
              onPress={() => {
                requestClose(true);
              }}
            >
              <Text style={styles.dangerLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: wash.backdrop,
    justifyContent: "center",
    padding: space[6],
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[4],
    gap: space[3],
  },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  message: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space[2],
  },
  secondary: {
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  secondaryLabel: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  danger: {
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  dangerLabel: {
    color: color.error,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
