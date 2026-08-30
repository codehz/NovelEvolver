import { useAtom } from "jotai";

import { SettingsDialog } from "#app/features/settings/SettingsDialog";
import { settingsOpenAtom } from "#app/shared/lib/settings";

export function SettingsHost() {
  const [open, setOpen] = useAtom(settingsOpenAtom);

  return (
    <SettingsDialog
      open={open}
      onDismiss={() => {
        setOpen(false);
      }}
    />
  );
}
