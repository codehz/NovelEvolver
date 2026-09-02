import { Pressable, ScrollView, Text } from "react-native";

import { aiStyles } from "./ai-chrome";

export type AiPickerItem = {
  id: string;
  title: string;
  detail?: string;
  selected?: boolean;
};

type AiPickerListProps = {
  items: readonly AiPickerItem[];
  empty: string;
  onSelect: (id: string) => void;
};

export function AiPickerList({ items, empty, onSelect }: AiPickerListProps) {
  return (
    <ScrollView style={aiStyles.pickerList} keyboardShouldPersistTaps="handled">
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
  );
}
