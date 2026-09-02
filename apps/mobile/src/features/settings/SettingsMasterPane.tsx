import { Header } from "@react-navigation/elements";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, fontSize } from "../../shared/theme";
import { AiAgentsList } from "./ai-agents/AiAgentsPanel";
import { AiModelsList } from "./ai-models/AiModelsPanel";
import { AiPromptsList } from "./ai-prompts/AiPromptsPanel";
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from "./categories";
import { settingsStyles } from "./settings-chrome";
import { requestSettingsLeave } from "./settings-leave-guard";
import type { SettingsDetail } from "./settings-navigation";
import { SettingsHeaderBackButton } from "./SettingsHeaderBackButton";

type SettingsMasterPaneProps = {
  wide: boolean;
  selectedDetail: SettingsDetail | null;
  onOpenDetail: (detail: SettingsDetail) => void;
  onCloseSettings: () => void;
};

function detailCategory(detail: SettingsDetail | null): SettingsCategoryId | null {
  if (detail?.type === "provider-editor" || detail?.type === "model-editor") {
    return "ai-models";
  }
  if (detail?.type === "agent-editor") {
    return "ai-agents";
  }
  if (detail?.type === "prompt-editor") {
    return "ai-prompts";
  }
  if (detail?.type === "ai-runtime-policy") {
    return "ai-runtime-policy";
  }
  return null;
}

function hasSelectedDetailRow(detail: SettingsDetail | null): boolean {
  return (
    (detail?.type === "provider-editor" && detail.id != null) ||
    (detail?.type === "model-editor" && (detail.id != null || detail.providerId != null)) ||
    (detail?.type === "agent-editor" && detail.id != null) ||
    (detail?.type === "prompt-editor" && detail.id != null)
  );
}

export function SettingsMasterPane({
  wide,
  selectedDetail,
  onOpenDetail,
  onCloseSettings,
}: SettingsMasterPaneProps) {
  const insets = useSafeAreaInsets();
  const selectedCategory = detailCategory(selectedDetail);
  const selectedRow = hasSelectedDetailRow(selectedDetail) ? selectedDetail : null;

  const openEditor = (detail: SettingsDetail) => {
    void requestSettingsLeave().then((ok) => {
      if (ok) onOpenDetail(detail);
    });
  };

  return (
    <View
      style={[
        settingsStyles.root,
        wide && settingsStyles.rail,
        wide && { paddingLeft: insets.left, paddingBottom: insets.bottom },
      ]}
    >
      <Header
        title="设置"
        headerTintColor={color.accent}
        headerTitleStyle={masterHeaderTitleStyle}
        headerStyle={wide ? masterHeaderWideStyle : masterHeaderStyle}
        headerTitleAlign={wide ? "left" : undefined}
        headerShadowVisible={false}
        headerLeftContainerStyle={settingsStyles.headerLeftContainer}
        headerLeft={(headerLeftProps) => (
          <SettingsHeaderBackButton {...headerLeftProps} onPress={onCloseSettings} />
        )}
      />
      <Text style={[settingsStyles.railLabel, !wide && settingsStyles.compactSectionLabel]}>
        分类
      </Text>
      <ScrollView>
        {SETTINGS_CATEGORIES.map((category) => {
          const selected =
            selectedCategory === category.id && !hasSelectedDetailRow(selectedDetail);
          return (
            <View key={category.id}>
              <View
                style={[settingsStyles.categoryRow, selected && settingsStyles.railItemSelected]}
              >
                <Pressable
                  style={settingsStyles.categoryLabelButton}
                  onPress={() => {
                    if (category.id === "ai-runtime-policy") {
                      openEditor({ type: "ai-runtime-policy" });
                    }
                  }}
                >
                  <Text
                    style={[
                      wide ? settingsStyles.railItemTitle : settingsStyles.rowTitle,
                      selected && settingsStyles.railItemTitleSelected,
                    ]}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              </View>
              {category.id === "ai-models" ? (
                <AiModelsList
                  selectedProviderId={
                    wide &&
                    selectedRow != null &&
                    (selectedRow.type === "provider-editor" || selectedRow.type === "model-editor")
                      ? selectedRow.type === "provider-editor"
                        ? selectedRow.id
                        : selectedRow.providerId
                      : undefined
                  }
                  selectedModelId={
                    wide && selectedRow?.type === "model-editor" ? selectedRow.id : undefined
                  }
                  onOpen={(target) => {
                    if (target.type === "provider") {
                      openEditor({ type: "provider-editor", id: target.id });
                    } else if (target.type === "model") {
                      openEditor({ type: "model-editor", id: target.id });
                    } else {
                      openEditor({ type: "model-editor", providerId: target.providerId });
                    }
                  }}
                  onAddProvider={() => {
                    openEditor({ type: "provider-editor" });
                  }}
                />
              ) : null}
              {category.id === "ai-agents" ? (
                <AiAgentsList
                  selectedId={
                    wide && selectedRow?.type === "agent-editor" ? selectedRow.id : undefined
                  }
                  onOpen={(id) => openEditor({ type: "agent-editor", id })}
                  onAdd={() => {
                    openEditor({ type: "agent-editor" });
                  }}
                />
              ) : null}
              {category.id === "ai-prompts" ? (
                <AiPromptsList
                  selectedId={
                    wide && selectedRow?.type === "prompt-editor" ? selectedRow.id : undefined
                  }
                  onOpen={(id) => openEditor({ type: "prompt-editor", id })}
                  onAdd={() => {
                    openEditor({ type: "prompt-editor" });
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const masterHeaderStyle = { backgroundColor: color.background };
const masterHeaderWideStyle = { backgroundColor: color.surface };
const masterHeaderTitleStyle = {
  color: color.foreground,
  fontSize: fontSize.md,
  fontWeight: "600" as const,
};
