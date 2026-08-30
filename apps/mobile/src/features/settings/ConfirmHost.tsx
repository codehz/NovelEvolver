import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { color, fontSize, radius, space, wash } from "../../shared/theme";
import { setSettingsLeaveConfirm } from "./settings-leave-guard";

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
};

type ConfirmFn = (request?: Partial<ConfirmRequest>) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

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
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useMemo<ConfirmFn>(() => {
    return (next) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setRequest({
          title: next?.title ?? "未保存的更改",
          message: next?.message ?? "离开将丢弃未保存的更改。",
          confirmLabel: next?.confirmLabel ?? "丢弃",
        });
      });
  }, []);

  useEffect(() => {
    setSettingsLeaveConfirm(() => confirm());
    return () => {
      setSettingsLeaveConfirm(null);
    };
  }, [confirm]);

  const close = (ok: boolean) => {
    setRequest(null);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={request != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          close(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{request?.title}</Text>
            <Text style={styles.message}>{request?.message}</Text>
            <View style={styles.actions}>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  close(false);
                }}
              >
                <Text style={styles.secondaryLabel}>取消</Text>
              </Pressable>
              <Pressable
                style={styles.danger}
                onPress={() => {
                  close(true);
                }}
              >
                <Text style={styles.dangerLabel}>{request?.confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
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
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  message: {
    color: color.muted,
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
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
