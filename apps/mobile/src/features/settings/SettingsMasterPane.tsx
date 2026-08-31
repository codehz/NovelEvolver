import { Header } from "@react-navigation/elements";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SplitMasterComponentProps } from "../../app/split-navigator";
import { color, fontSize } from "../../shared/theme";
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
          return (
            <Pressable
              key={category.id}
              style={[
                wide ? settingsStyles.railItem : settingsStyles.row,
                selected && settingsStyles.railItemSelected,
              ]}
              onPress={() => {
                void selectCategory(category.id);
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
