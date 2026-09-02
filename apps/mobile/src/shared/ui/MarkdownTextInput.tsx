import type { StyleProp, TextInputProps, TextStyle } from "react-native";
import { StyleSheet, Text, TextInput } from "react-native";

import { parseMarkdownForEditor, type MarkdownTextStyle } from "../lib/markdown-inline";
import { color, fontFamily, fontSize, wash } from "../theme";

type MarkdownTextInputProps = Omit<TextInputProps, "children" | "onChangeText" | "value"> & {
  text: string;
  onTextChange: (text: string) => void;
  style?: StyleProp<TextStyle>;
};

function getSegmentStyle(segment: MarkdownTextStyle) {
  return [
    segment.bold && styles.markdownBold,
    segment.italic && styles.markdownItalic,
    segment.strikethrough && styles.markdownStrikethrough,
    segment.code && styles.markdownCode,
    segment.heading && styles.markdownHeading,
    segment.marker && styles.markdownMarker,
  ];
}

export function MarkdownTextInput({ text, onTextChange, style, ...props }: MarkdownTextInputProps) {
  return (
    <TextInput
      {...props}
      multiline={props.multiline ?? true}
      autoCorrect={false}
      spellCheck={false}
      onChangeText={onTextChange}
      style={[styles.input, style]}
    >
      {parseMarkdownForEditor(text).map((segment, index) => (
        <Text key={`${index}-${segment.text}`} style={getSegmentStyle(segment.style)}>
          {segment.text}
        </Text>
      ))}
    </TextInput>
  );
}

const styles = StyleSheet.create({
  input: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
  },
  markdownBold: {
    fontWeight: "700",
  },
  markdownItalic: {
    fontStyle: "italic",
  },
  markdownStrikethrough: {
    textDecorationLine: "line-through",
  },
  markdownCode: {
    color: color.info,
    fontFamily: fontFamily.mono,
    backgroundColor: wash.mutedFill,
  },
  markdownHeading: {
    fontWeight: "700",
  },
  markdownMarker: {
    color: color.accent,
  },
});
