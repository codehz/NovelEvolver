import { Header } from "@react-navigation/elements";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IconAdd from "~icons/codicon/add";

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

export function SettingsMasterPane({
  wide,
  selectedDetail,
  onOpenDetail,
  onCloseSettings,
}: SettingsMasterPaneProps) {
  const insets = useSafeAreaInsets();
  const selectedCategory = detailCategory(selectedDetail);

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
          const selected = selectedCategory === category.id;
          const addCategory = () => {
            if (category.id === "ai-models") openEditor({ type: "provider-editor" });
            if (category.id === "ai-agents") openEditor({ type: "agent-editor" });
            if (category.id === "ai-prompts") openEditor({ type: "prompt-editor" });
          };
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
                {category.id === "ai-models" ||
                category.id === "ai-agents" ||
                category.id === "ai-prompts" ? (
                  <Pressable
                    style={settingsStyles.categoryAction}
                    onPress={addCategory}
                    accessibilityRole="button"
                    accessibilityLabel={`添加${category.label}`}
                    hitSlop={8}
                  >
                    <IconAdd width={20} height={20} color={color.accent} />
                  </Pressable>
                ) : null}
              </View>
              {category.id === "ai-models" ? (
                <AiModelsList
                  onOpen={(target) => {
                    if (target.type === "provider") {
                      openEditor({ type: "provider-editor", id: target.id });
                    } else if (target.type === "model") {
                      openEditor({ type: "model-editor", id: target.id });
                    } else {
                      openEditor({ type: "model-editor", providerId: target.providerId });
                    }
                  }}
                />
              ) : null}
              {category.id === "ai-agents" ? (
                <AiAgentsList onOpen={(id) => openEditor({ type: "agent-editor", id })} />
              ) : null}
              {category.id === "ai-prompts" ? (
                <AiPromptsList onOpen={(id) => openEditor({ type: "prompt-editor", id })} />
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
