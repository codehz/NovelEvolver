import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getIconsCSSData } from "@iconify/utils/lib/css/icons";
import { matchIconName } from "@iconify/utils/lib/icon/name";
import plugin from "tailwindcss/plugin";

function resolveFile(filename: string) {
  try {
    return fileURLToPath(import.meta.resolve(filename));
  } catch {}

  return undefined;
}

function locateIconSet(prefix: string) {
  return resolveFile(`@iconify/json/json/${prefix}.json`);
}

const iconSetCache = new Map();

function loadIconSet(prefix: string) {
  const cached = iconSetCache.get(prefix);
  if (cached) {
    return cached;
  }

  const filename = locateIconSet(prefix);
  if (!filename) {
    throw new Error(`Cannot load icon set for "${prefix}".`);
  }

  const iconSet = JSON.parse(readFileSync(filename, "utf8"));
  iconSetCache.set(prefix, iconSet);
  return iconSet;
}

function getDynamicCSSRules(icon: string, { scale = 1 } = {}) {
  const nameParts = icon.split(/--|:/);
  if (nameParts.length !== 2) {
    throw new Error(`Invalid icon name: "${icon}"`);
  }

  const [prefix, name] = nameParts;
  if (!(prefix.match(matchIconName) && name.match(matchIconName))) {
    throw new Error(`Invalid icon name: "${icon}"`);
  }

  const generated = getIconsCSSData(loadIconSet(prefix), [name], {
    iconSelector: ".icon",
  });

  if (generated.css.length !== 1) {
    throw new Error(`Cannot find "${icon}". Bad icon name?`);
  }

  if (generated.common) {
    if (scale) {
      generated.common.rules.height = `${scale}em`;
      generated.common.rules.width = `${scale}em`;
    } else {
      delete generated.common.rules.height;
      delete generated.common.rules.width;
    }
  }

  return {
    ...generated.common?.rules,
    ...generated.css[0].rules,
  };
}

export default plugin.withOptions<{ prefix?: string; scale?: number }>((options = {}) => {
  const prefix = typeof options.prefix === "string" ? options.prefix : "icon";
  const scale = typeof options.scale === "number" ? options.scale : 1;

  return (api) => {
    if (!prefix) {
      return;
    }

    api.matchComponents({
      [prefix]: (icon) => {
        try {
          return getDynamicCSSRules(icon, { scale });
        } catch (error) {
          if (error instanceof Error) {
            console.warn(error.message);
          }
          return {};
        }
      },
    });
  };
});
