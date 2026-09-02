import { Header } from "@react-navigation/elements";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useReducer } from "react";
import { BackHandler, useWindowDimensions, View } from "react-native";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { AgentEditor } from "./ai-agents/AiAgentsPanel";
import { ModelEditor, ProviderEditor } from "./ai-models/AiModelsPanel";
import { PromptEditor } from "./ai-prompts/AiPromptsPanel";
import { AiRuntimePolicyPanel } from "./ai-runtime-policy/AiRuntimePolicyPanel";
import { requestSettingsLeave, useSettingsDirty } from "./settings-leave-guard";
import {
  initialSettingsNavigationState,
  isSettingsDetail,
  settingsNavigationReducer,
  type SettingsDetail,
} from "./settings-navigation";
import { SettingsDetailPlaceholder } from "./SettingsDetailPlaceholder";
import { SettingsHeaderBackButton } from "./SettingsHeaderBackButton";
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

  return (
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
      {wide || state.screen === "master" ? (
        <View style={wide ? { width: 220 } : { flex: 1 }}>
          <SettingsMasterPane
            wide={wide}
            selectedDetail={isSettingsDetail(state) ? state.detail : null}
            onOpenDetail={openDetail}
            onCloseSettings={leaveSettings}
          />
        </View>
      ) : null}
      {wide ? (
        <View style={{ flex: 1, minWidth: 0 }}>
          {isSettingsDetail(state) ? (
            <SettingsDetailView
              detail={state.detail}
              wide={wide}
              onBack={showMaster}
              onSaved={showMaster}
            />
          ) : (
            <SettingsDetailPlaceholder />
          )}
        </View>
      ) : null}
      {!wide && isSettingsDetail(state) ? (
        <View style={{ flex: 1 }}>
          <SettingsDetailView
            detail={state.detail}
            wide={wide}
            onBack={showMaster}
            onSaved={showMaster}
          />
        </View>
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
  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <Header
        title={detailTitle(detail)}
        headerStyle={{ backgroundColor: color.background }}
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
      />
      {detail.type === "provider-editor" ? (
        <ProviderEditor id={detail.id} onSaved={onSaved} />
      ) : detail.type === "model-editor" ? (
        <ModelEditor id={detail.id} providerId={detail.providerId} onSaved={onSaved} />
      ) : detail.type === "agent-editor" ? (
        <AgentEditor id={detail.id} onSaved={onSaved} />
      ) : detail.type === "prompt-editor" ? (
        <PromptEditor id={detail.id} onSaved={onSaved} />
      ) : (
        <AiRuntimePolicyPanel onSaved={onSaved} />
      )}
    </View>
  );
}

export type { SettingsDetail, SettingsNavigationState } from "./settings-navigation";
