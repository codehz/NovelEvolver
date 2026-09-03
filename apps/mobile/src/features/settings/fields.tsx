import { type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { color } from "../../shared/theme";
import { DropdownSelect } from "../../shared/ui/DropdownSelect";
import { MarkdownTextInput } from "../../shared/ui/MarkdownTextInput";
import type { OverlayMenuOption } from "../../shared/ui/OverlayHost";
import { settingsStyles } from "./settings-chrome";

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function SettingsField({ label, hint, children }: FieldProps) {
  return (
    <View style={settingsStyles.field}>
      <Text style={settingsStyles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={settingsStyles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

type TextFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  monospace?: boolean;
  multiline?: boolean;
  editable?: boolean;
  keyboardType?: "default" | "numeric" | "url";
  autoCapitalize?: "none" | "sentences";
  markdown?: boolean;
};

export function SettingsTextField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  monospace = false,
  multiline,
  editable = true,
  keyboardType = "default",
  autoCapitalize = "none",
  markdown = false,
}: TextFieldProps) {
  const inputStyle = [
    settingsStyles.input,
    monospace && settingsStyles.inputMono,
    multiline ? settingsStyles.textarea : null,
  ];

  return (
    <SettingsField label={label} hint={hint}>
      {markdown ? (
        <MarkdownTextInput
          text={value}
          onTextChange={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.placeholder}
          multiline={multiline}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={inputStyle}
        />
      ) : (
        <TextInput
          style={inputStyle}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.placeholder}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
      )}
    </SettingsField>
  );
}

type SwitchFieldProps = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function SettingsSwitchField({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: SwitchFieldProps) {
  return (
    <View style={settingsStyles.field}>
      <View style={settingsStyles.switchRow}>
        <Text style={[settingsStyles.fieldLabel, { flex: 1 }]}>{label}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: value, disabled }}
          disabled={disabled}
          onPress={() => onValueChange(!value)}
          style={[settingsStyles.switch, disabled && settingsStyles.switchDisabled]}
        >
          <View style={[settingsStyles.switchTrack, value && settingsStyles.switchTrackOn]}>
            <View style={[settingsStyles.switchThumb, value && settingsStyles.switchThumbOn]} />
          </View>
        </Pressable>
      </View>
      {hint ? <Text style={settingsStyles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

type Choice<T extends string> = {
  value: T;
  label: string;
  detail?: string;
  group?: string;
};

type ChoiceFieldProps<T extends string> = {
  label: string;
  hint?: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
};

export function SettingsChoiceField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: ChoiceFieldProps<T>) {
  return (
    <SettingsField label={label} hint={hint}>
      <View style={settingsStyles.chipRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[settingsStyles.chip, selected && settingsStyles.chipSelected]}
              onPress={() => {
                onChange(option.value);
              }}
            >
              <Text
                style={[settingsStyles.chipLabel, selected && settingsStyles.chipLabelSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SettingsField>
  );
}

export function SettingsMenuChoiceField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: ChoiceFieldProps<T>) {
  const menuOptions = options.map<OverlayMenuOption>((option) => ({
    key: option.value,
    label: option.label,
    detail: option.detail,
    group: option.group,
  }));

  return (
    <SettingsField label={label} hint={hint}>
      <DropdownSelect
        value={value}
        options={menuOptions}
        onChange={(next) => onChange(next as T)}
        title={label}
      />
    </SettingsField>
  );
}
