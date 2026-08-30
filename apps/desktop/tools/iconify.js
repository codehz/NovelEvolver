const { readFileSync } = require("node:fs");
const plugin = require("tailwindcss/plugin");
const { getIconsCSSData } = require("@iconify/utils/lib/css/icons");
const { matchIconName } = require("@iconify/utils/lib/icon/name");

function resolveFile(filename) {
  try {
    return require.resolve(filename);
  } catch {}

  return undefined;
}

function locateIconSet(prefix) {
  return resolveFile(`@iconify/json/json/${prefix}.json`);
}

const iconSetCache = new Map();

function loadIconSet(prefix) {
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

function getDynamicCSSRules(icon, { scale = 1 } = {}) {
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

  if (scale) {
    generated.common.rules.height = `${scale}em`;
    generated.common.rules.width = `${scale}em`;
  } else {
    delete generated.common.rules.height;
    delete generated.common.rules.width;
  }

  return {
    ...generated.common.rules,
    ...generated.css[0].rules,
  };
}

module.exports = plugin.withOptions((options = {}) => {
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
