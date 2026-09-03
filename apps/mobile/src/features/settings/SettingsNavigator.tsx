import { Header } from "@react-navigation/elements";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useReducer, useState } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import IconDiscard from "~icons/codicon/discard";
import IconSave from "~icons/codicon/save";
import IconTrash from "~icons/codicon/trash";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { OVERLAY_TIMING } from "../../shared/ui/overlay-chrome";
import { AgentEditor } from "./ai-agents/AiAgentsPanel";
import { ModelEditor, ProviderEditor } from "./ai-models/AiModelsPanel";
import { PromptEditor } from "./ai-prompts/AiPromptsPanel";
import { AiRuntimePolicyPanel } from "./ai-runtime-policy/AiRuntimePolicyPanel";
import { settingsStyles, SETTINGS_RAIL_WIDTH } from "./settings-chrome";
import type { SettingsDetailActionChange } from "./settings-detail-actions";
import { requestSettingsLeave, useSettingsDirty } from "./settings-leave-guard";
import {
  initialSettingsNavigationState,
  isSettingsDetail,
  settingsNavigationReducer,
  type SettingsDetail,
} from "./settings-navigation";
import { SettingsDetailPlaceholder } from "./SettingsDetailPlaceholder";
import { SettingsHeaderBackButton } from "./SettingsHeaderBackButton";
import { SettingsHeaderButton } from "./SettingsHeaderButton";
import { SettingsMasterPane } from "./SettingsMasterPane";

const detailTitles: Record<SettingsDetail["type"], string> = {
  "provider-editor": "编辑供应商",
  "model-editor": "编辑模型",
  "agent-editor": "编辑 Agent",
  "prompt-editor": "编辑提示词",
  "ai-runtime-policy": "AI 运行策略",
};

function detailTitle(detail: SettingsDetail): string {
  if (detail.type === "provider-editor" && detail.id == null) return "添加供应商";
  if (detail.type === "model-editor" && detail.id == null) return "添加模型";
  if (detail.type === "agent-editor" && detail.id == null) return "添加 Agent";
  if (detail.type === "prompt-editor" && detail.id == null) return "添加提示词";
  return detailTitles[detail.type];
}

function settingsDetailKey(detail: SettingsDetail): string {
  switch (detail.type) {
    case "provider-editor":
      return `${detail.type}:${detail.id ?? "new"}`;
    case "model-editor":
      return `${detail.type}:${detail.id ?? "new"}:${detail.providerId ?? ""}`;
    case "agent-editor":
      return `${detail.type}:${detail.id ?? "new"}`;
    case "prompt-editor":
      return `${detail.type}:${detail.id ?? "new"}`;
    case "ai-runtime-policy":
      return detail.type;
  }
}

const settingsAnimation = { duration: OVERLAY_TIMING.duration, easing: OVERLAY_TIMING.easing };

export function SettingsNavigator() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const dirty = useSettingsDirty();
  const [state, dispatch] = useReducer(settingsNavigationReducer, initialSettingsNavigationState);

  const leaveSettings = () => {
    void requestSettingsLeave().then((ok) => {
      if (ok) navigation.goBack();
    });
  };

  const showMaster = () => {
    void requestSettingsLeave().then((ok) => {
      if (ok) dispatch({ type: "show-master" });
    });
  };

  usePreventRemove(dirty, ({ data }) => {
    void requestSettingsLeave().then((ok) => {
      if (ok) navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (state.screen === "detail") {
        showMaster();
      } else {
        leaveSettings();
      }
      return true;
    });
    return () => subscription.remove();
  });

  const openDetail = (detail: SettingsDetail) => {
    dispatch({ type: "open-detail", detail });
  };

  const detail = isSettingsDetail(state) ? state.detail : null;
  const detailKey = detail == null ? "master" : settingsDetailKey(detail);
  const navigationProgress = useSharedValue(0);

  useEffect(() => {
    navigationProgress.value = withTiming(detail == null ? 0 : 1, OVERLAY_TIMING);
  }, [detailKey, navigationProgress]);

  const masterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - navigationProgress.value * 0.15,
    transform: [{ translateX: -width * 0.3 * navigationProgress.value }],
  }));

  const renderMaster = () => (
    <SettingsMasterPane
      wide={wide}
      selectedDetail={detail}
      onOpenDetail={openDetail}
      onCloseSettings={leaveSettings}
    />
  );

  const renderDetail = () =>
    detail ? (
      <SettingsDetailView detail={detail} wide={wide} onBack={showMaster} onSaved={showMaster} />
    ) : (
      <SettingsDetailPlaceholder />
    );

  return (
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
      {wide ? (
        <View style={{ width: SETTINGS_RAIL_WIDTH }}>{renderMaster()}</View>
      ) : (
        <View style={{ flex: 1 }}>
          <Animated.View
            pointerEvents={detail == null ? "auto" : "none"}
            style={[StyleSheet.absoluteFill, masterAnimatedStyle]}
          >
            {renderMaster()}
          </Animated.View>
          {detail ? (
            <Animated.View
              key={detailKey}
              entering={SlideInRight.duration(OVERLAY_TIMING.duration).easing(
                OVERLAY_TIMING.easing,
              )}
              exiting={SlideOutRight.duration(OVERLAY_TIMING.duration).easing(
                OVERLAY_TIMING.easing,
              )}
              style={StyleSheet.absoluteFill}
            >
              {renderDetail()}
            </Animated.View>
          ) : null}
        </View>
      )}
      {wide ? (
        <Animated.View
          key={detail == null ? "placeholder" : settingsDetailKey(detail)}
          entering={FadeIn.duration(settingsAnimation.duration).easing(settingsAnimation.easing)}
          exiting={FadeOut.duration(settingsAnimation.duration).easing(settingsAnimation.easing)}
          style={{ flex: 1, minWidth: 0 }}
        >
          {renderDetail()}
        </Animated.View>
      ) : null}
    </View>
  );
}

type SettingsDetailViewProps = {
  detail: SettingsDetail;
  wide: boolean;
  onBack: () => void;
  onSaved: () => void;
};

function SettingsDetailView({ detail, wide, onBack, onSaved }: SettingsDetailViewProps) {
  const [actions, setActions] = useState<Parameters<SettingsDetailActionChange>[0]>(null);
  const onActionsChange = useCallback<SettingsDetailActionChange>((next) => {
    setActions(next);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <Header
        title={detailTitle(detail)}
        headerStyle={settingsStyles.header}
        headerTintColor={color.accent}
        headerTitleStyle={{
          color: color.foreground,
          fontFamily: fontFamily.sans,
          fontSize: fontSize.md,
          fontWeight: "600",
        }}
        headerShadowVisible={false}
        headerLeftContainerStyle={{ paddingStart: 16 }}
        headerLeft={(props) => (
          <SettingsHeaderBackButton {...props} icon={wide ? "close" : "back"} onPress={onBack} />
        )}
        headerRight={() =>
          actions ? (
            <View style={{ flexDirection: "row", gap: 4, paddingEnd: 16 }}>
              {actions.resetToDefaults ? (
                <SettingsHeaderButton
                  label="恢复默认"
                  onPress={actions.resetToDefaults}
                  Icon={IconDiscard}
                  disabled={actions.resetToDefaultsDisabled}
                />
              ) : null}
              <SettingsHeaderButton label="保存" onPress={actions.save} Icon={IconSave} />
              {actions.remove ? (
                <SettingsHeaderButton label="删除" onPress={actions.remove} Icon={IconTrash} />
              ) : null}
            </View>
          ) : null
        }
      />
      {detail.type === "provider-editor" ? (
        <ProviderEditor id={detail.id} onSaved={onSaved} onActionsChange={onActionsChange} />
      ) : detail.type === "model-editor" ? (
        <ModelEditor
          id={detail.id}
          providerId={detail.providerId}
          onSaved={onSaved}
          onActionsChange={onActionsChange}
        />
      ) : detail.type === "agent-editor" ? (
        <AgentEditor id={detail.id} onSaved={onSaved} onActionsChange={onActionsChange} />
      ) : detail.type === "prompt-editor" ? (
        <PromptEditor id={detail.id} onSaved={onSaved} onActionsChange={onActionsChange} />
      ) : (
        <AiRuntimePolicyPanel onSaved={onSaved} onActionsChange={onActionsChange} />
      )}
    </View>
  );
}

export type { SettingsDetail, SettingsNavigationState } from "./settings-navigation";
