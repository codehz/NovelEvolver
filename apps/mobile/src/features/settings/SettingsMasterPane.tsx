import { Header } from "@react-navigation/elements";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IconAdd from "~icons/codicon/add";

import type { SplitMasterComponentProps } from "../../app/split-navigator";
import { color, fontSize } from "../../shared/theme";
import { AiAgentsList } from "./ai-agents/AiAgentsPanel";
import { AiModelsList } from "./ai-models/AiModelsPanel";
import { AiPromptsList } from "./ai-prompts/AiPromptsPanel";
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from "./categories";
import { settingsStyles } from "./settings-chrome";
import { requestSettingsLeave } from "./settings-leave-guard";
import { SettingsHeaderBackButton } from "./SettingsHeaderBackButton";

export function SettingsMasterPane(props: SplitMasterComponentProps) {
  const wide = props.layout === "wide";
  const insets = useSafeAreaInsets();
  const focused = props.state.routes[props.state.index]?.name;
  const highlightSelection = wide || props.pane === "detail";

  const selectCategory = async (id: SettingsCategoryId) => {
    if (!(await requestSettingsLeave())) {
      return;
    }
    props.navigation.navigate(id, { screen: "List" });
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
        headerLeftContainerStyle={wide ? undefined : settingsStyles.headerLeftContainer}
        headerLeft={
          wide
            ? undefined
            : (headerLeftProps) => (
                <SettingsHeaderBackButton
                  {...headerLeftProps}
                  onPress={() => {
                    props.navigation.goBack();
                  }}
                />
              )
        }
      />
      <Text style={[settingsStyles.railLabel, !wide && settingsStyles.compactSectionLabel]}>
        分类
      </Text>
      <ScrollView>
        {SETTINGS_CATEGORIES.map((category) => {
          const selected = highlightSelection && category.id === focused;
          const openCategory = () => {
            void selectCategory(category.id);
          };
          const addCategory = () => {
            void requestSettingsLeave().then((ok) => {
              if (!ok) {
                return;
              }
              if (category.id === "ai-models") {
                props.navigation.navigate(category.id, { screen: "ProviderEditor", params: {} });
              } else if (category.id === "ai-agents") {
                props.navigation.navigate(category.id, { screen: "AgentEditor", params: {} });
              } else if (category.id === "ai-prompts") {
                props.navigation.navigate(category.id, { screen: "PromptEditor", params: {} });
              }
            });
          };
          return (
            <View key={category.id}>
              <View
                style={[settingsStyles.categoryRow, selected && settingsStyles.railItemSelected]}
              >
                <Pressable style={settingsStyles.categoryLabelButton} onPress={openCategory}>
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
                    void requestSettingsLeave().then((ok) => {
                      if (!ok) return;
                      if (target.type === "provider") {
                        props.navigation.navigate(category.id, {
                          screen: "ProviderEditor",
                          params: { id: target.id },
                        });
                      } else if (target.type === "model") {
                        props.navigation.navigate(category.id, {
                          screen: "ModelEditor",
                          params: { id: target.id },
                        });
                      } else {
                        props.navigation.navigate(category.id, {
                          screen: "ModelEditor",
                          params: { providerId: target.providerId },
                        });
                      }
                    });
                  }}
                />
              ) : null}
              {category.id === "ai-agents" ? (
                <AiAgentsList
                  onOpen={(id) => {
                    void requestSettingsLeave().then((ok) => {
                      if (ok) {
                        props.navigation.navigate(category.id, {
                          screen: "AgentEditor",
                          params: { id },
                        });
                      }
                    });
                  }}
                />
              ) : null}
              {category.id === "ai-prompts" ? (
                <AiPromptsList
                  onOpen={(id) => {
                    void requestSettingsLeave().then((ok) => {
                      if (ok) {
                        props.navigation.navigate(category.id, {
                          screen: "PromptEditor",
                          params: { id },
                        });
                      }
                    });
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
