import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AiAgentsPanel } from "./ai-agents/AiAgentsPanel";
import { AiModelsPanel } from "./ai-models/AiModelsPanel";
import { AiPromptsPanel } from "./ai-prompts/AiPromptsPanel";
import { AiRuntimePolicyPanel } from "./ai-runtime-policy/AiRuntimePolicyPanel";
import { SETTINGS_CATEGORIES, settingsCategoryLabel, type SettingsCategoryId } from "./categories";
import { settingsStyles, WIDE_SETTINGS_BREAKPOINT } from "./settings-chrome";
import { requestSettingsLeave } from "./settings-leave-guard";

type SettingsScreenProps = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_SETTINGS_BREAKPOINT;
  const [categoryId, setCategoryId] = useState<SettingsCategoryId | null>(
    wide ? "ai-models" : null,
  );

  useEffect(() => {
    if (wide && categoryId == null) {
      setCategoryId("ai-models");
    }
  }, [wide, categoryId]);

  const selectCategory = async (next: SettingsCategoryId | null) => {
    if (next === categoryId) {
      return;
    }
    if (!(await requestSettingsLeave())) {
      return;
    }
    setCategoryId(next);
  };

  const handleBack = async () => {
    if (!wide && categoryId != null) {
      await selectCategory(null);
      return;
    }
    if (!(await requestSettingsLeave())) {
      return;
    }
    onBack();
  };

  return (
    <SafeAreaView style={settingsStyles.root}>
      <View style={settingsStyles.header}>
        <Pressable style={settingsStyles.headerAction} onPress={() => void handleBack()}>
          <Text style={settingsStyles.headerActionLabel}>返回</Text>
        </Pressable>
        <Text style={settingsStyles.headerTitle}>
          {wide || categoryId == null ? "设置" : settingsCategoryLabel(categoryId)}
        </Text>
      </View>
      {wide ? (
        <View style={settingsStyles.dualPane}>
          <CategoryRail
            selectedId={categoryId ?? "ai-models"}
            onSelect={(id) => {
              void selectCategory(id);
            }}
          />
          <View style={settingsStyles.detail}>
            <CategoryBody categoryId={categoryId ?? "ai-models"} />
          </View>
        </View>
      ) : categoryId == null ? (
        <CategoryRail
          selectedId={null}
          onSelect={(id) => {
            void selectCategory(id);
          }}
        />
      ) : (
        <CategoryBody categoryId={categoryId} />
      )}
    </SafeAreaView>
  );
}

type CategoryRailProps = {
  selectedId: SettingsCategoryId | null;
  onSelect: (id: SettingsCategoryId) => void;
};

function CategoryRail({ selectedId, onSelect }: CategoryRailProps) {
  return (
    <View style={selectedId == null ? settingsStyles.detail : settingsStyles.rail}>
      <Text style={settingsStyles.railLabel}>分类</Text>
      <ScrollView>
        {SETTINGS_CATEGORIES.map((category) => {
          const selected = category.id === selectedId;
          return (
            <Pressable
              key={category.id}
              style={[settingsStyles.railItem, selected && settingsStyles.railItemSelected]}
              onPress={() => {
                onSelect(category.id);
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

type CategoryBodyProps = {
  categoryId: SettingsCategoryId;
};

function CategoryBody({ categoryId }: CategoryBodyProps) {
  switch (categoryId) {
    case "ai-models":
      return <AiModelsPanel />;
    case "ai-agents":
      return <AiAgentsPanel />;
    case "ai-prompts":
      return <AiPromptsPanel />;
    case "ai-runtime-policy":
      return <AiRuntimePolicyPanel />;
  }
}
