import { Pressable, ScrollView, Text, View } from "react-native";

import { aiStyles } from "./ai-chrome";

export type AiPickerItem = {
  id: string;
  title: string;
  detail?: string;
  selected?: boolean;
};

type AiPickerListProps = {
  title: string;
  items: readonly AiPickerItem[];
  empty: string;
  onSelect: (id: string) => void;
};

export function AiPickerList({ title, items, empty, onSelect }: AiPickerListProps) {
  return (
    <View style={aiStyles.root}>
      <Text style={aiStyles.groupLabel}>{title}</Text>
      <ScrollView style={aiStyles.list}>
        {items.length === 0 ? (
          <Text style={aiStyles.empty}>{empty}</Text>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              style={[aiStyles.listRow, item.selected ? aiStyles.listRowActive : null]}
              onPress={() => {
                onSelect(item.id);
              }}
            >
              <Text style={aiStyles.listRowTitle}>{item.title}</Text>
              {item.detail ? <Text style={aiStyles.listRowMeta}>{item.detail}</Text> : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
