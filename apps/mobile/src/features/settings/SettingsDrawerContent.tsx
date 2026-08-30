import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Header, HeaderBackButton } from "@react-navigation/elements";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { color, fontSize } from "../../shared/theme";
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from "./categories";
import { settingsStyles, WIDE_SETTINGS_BREAKPOINT } from "./settings-chrome";
import { requestSettingsLeave } from "./settings-leave-guard";

export function SettingsDrawerContent(props: DrawerContentComponentProps) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_SETTINGS_BREAKPOINT;
  const focused = props.state.routes[props.state.index]?.name;

  const selectCategory = async (id: SettingsCategoryId) => {
    if (!(await requestSettingsLeave())) {
      return;
    }
    props.navigation.navigate(id, { screen: "List" });
    if (!wide) {
      props.navigation.closeDrawer();
    }
  };

  return (
    <View style={settingsStyles.root}>
      {wide ? null : (
        <Header
          title="设置"
          headerTintColor={color.accent}
          headerTitleStyle={drawerHeaderTitleStyle}
          headerStyle={drawerHeaderStyle}
          headerShadowVisible={false}
          headerLeft={(headerLeftProps) => (
            <HeaderBackButton
              {...headerLeftProps}
              onPress={() => {
                props.navigation.goBack();
              }}
            />
          )}
        />
      )}
      <Text style={settingsStyles.railLabel}>分类</Text>
      <ScrollView>
        {SETTINGS_CATEGORIES.map((category) => {
          const selected = category.id === focused;
          return (
            <Pressable
              key={category.id}
              style={[settingsStyles.railItem, selected && settingsStyles.railItemSelected]}
              onPress={() => {
                void selectCategory(category.id);
              }}
            >
              <Text
                style={[
                  settingsStyles.railItemTitle,
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

const drawerHeaderStyle = { backgroundColor: color.background };
const drawerHeaderTitleStyle = {
  color: color.foreground,
  fontSize: fontSize.md,
  fontWeight: "600" as const,
};
