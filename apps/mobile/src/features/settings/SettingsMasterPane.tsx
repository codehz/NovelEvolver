import { Header } from "@react-navigation/elements";
import { StackActions } from "@react-navigation/native";
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

const EDITOR_CATEGORIES: Record<string, SettingsCategoryId> = {
  ProviderEditor: "ai-models",
  ModelEditor: "ai-models",
  AgentEditor: "ai-agents",
  PromptEditor: "ai-prompts",
  AiRuntimePolicy: "ai-runtime-policy",
};

export function SettingsMasterPane(props: SplitMasterComponentProps) {
  const wide = props.layout === "wide";
  const insets = useSafeAreaInsets();
  const detailRoute = props.state.routes.find((item) => item.name === "detail");
  const detailState = detailRoute?.state;
  const detailScreen =
    detailState?.routes[detailState.index ?? detailState.routes.length - 1]?.name;
  const selectedCategory = EDITOR_CATEGORIES[detailScreen ?? ""];
  const highlightSelection = props.pane === "detail";

  const openDetail = (screen: string, params: Record<string, string | undefined>) => {
    const target = detailRoute?.state?.key;
    if (target) {
      props.navigation.navigate("detail");
      props.navigation.dispatch({ ...StackActions.replace(screen, params), target });
    } else {
      props.navigation.navigate("detail", { screen, params });
    }
  };

  const openEditor = (
    category: SettingsCategoryId,
    screen: string,
    params: Record<string, string | undefined>,
  ) => {
    void category;
    openDetail(screen, params);
  };

  const selectCategory = async (id: SettingsCategoryId) => {
    if (id !== "ai-runtime-policy" || !(await requestSettingsLeave())) {
      return;
    }
    openDetail("AiRuntimePolicy", {});
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
          <SettingsHeaderBackButton
            {...headerLeftProps}
            onPress={() => {
              props.navigation.goBack();
            }}
          />
        )}
      />
      <Text style={[settingsStyles.railLabel, !wide && settingsStyles.compactSectionLabel]}>
        分类
      </Text>
      <ScrollView>
        {SETTINGS_CATEGORIES.map((category) => {
          const selected =
            highlightSelection &&
            (selectedCategory === category.id ||
              (category.id === "ai-runtime-policy" && detailScreen === "AiRuntimePolicy"));
          const openCategory = () => {
            void selectCategory(category.id);
          };
          const addCategory = () => {
            void requestSettingsLeave().then((ok) => {
              if (!ok) return;
              if (category.id === "ai-models") {
                openEditor(category.id, "ProviderEditor", {});
              } else if (category.id === "ai-agents") {
                openEditor(category.id, "AgentEditor", {});
              } else if (category.id === "ai-prompts") {
                openEditor(category.id, "PromptEditor", {});
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
                        openEditor(category.id, "ProviderEditor", { id: target.id });
                      } else if (target.type === "model") {
                        openEditor(category.id, "ModelEditor", { id: target.id });
                      } else {
                        openEditor(category.id, "ModelEditor", { providerId: target.providerId });
                      }
                    });
                  }}
                />
              ) : null}
              {category.id === "ai-agents" ? (
                <AiAgentsList
                  onOpen={(id) => {
                    void requestSettingsLeave().then((ok) => {
                      if (ok) openEditor(category.id, "AgentEditor", { id });
                    });
                  }}
                />
              ) : null}
              {category.id === "ai-prompts" ? (
                <AiPromptsList
                  onOpen={(id) => {
                    void requestSettingsLeave().then((ok) => {
                      if (ok) openEditor(category.id, "PromptEditor", { id });
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
