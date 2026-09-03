const fs = require("node:fs");
const path = require("node:path");

const iconData = require.resolve("@iconify-json/codicon/icons.json");
const icons = require(iconData).icons;
const babelRuntimeHelper = require.resolve("@babel/runtime/helpers/interopRequireDefault");
const babelRuntimeRoot = path.dirname(path.dirname(babelRuntimeHelper));
const generatedDirectory = path.join(__dirname, "metro-icons", "codicon");

function toJsxAttributes(body) {
  return body.replace(/([a-z-]+)="([^"]*)"/g, (_, name, value) => {
    const jsxName = name === "fill" ? "fill" : name;
    const jsxValue = value === "currentColor" ? "{color ?? 'currentColor'}" : `"${value}"`;
    return `${jsxName}=${jsxValue}`;
  });
}

function createIconModule(name, definition) {
  const svgBody = toJsxAttributes(definition.body);
  const viewBoxWidth = definition.width ?? 16;
  const viewBoxHeight = definition.height ?? 16;
  return `import Svg, { Path } from "react-native-svg";\n\nexport default function Icon${name}({ color, width = 16, height = 16, ...props }) {\n  return (\n    <Svg width={width} height={height} viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" {...props}>\n      ${svgBody.replace("<path", "<Path").replace("/>", "/>")}\n    </Svg>\n  );\n}\n`;
}

function iconName(icon) {
  return icon.replace(/(?:^|-)([a-z0-9])/g, (_, character) => character.toUpperCase());
}

function generateIconModules() {
  fs.mkdirSync(generatedDirectory, { recursive: true });
  for (const [icon, definition] of Object.entries(icons)) {
    if (!/^<path\b/.test(definition.body)) continue;
    const filePath = path.join(generatedDirectory, `${icon}.tsx`);
    const source = createIconModule(iconName(icon), definition);
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== source) {
      fs.writeFileSync(filePath, source);
    }
  }
}

generateIconModules();

function resolveIcon(moduleName) {
  const match = /^~icons\/codicon\/([a-z0-9-]+)$/.exec(moduleName);
  if (!match) return undefined;

  const [, icon] = match;
  const definition = icons[icon];
  if (!definition || !/^<path\b/.test(definition.body)) {
    throw new Error(`Unsupported or unknown Codicon: ${icon}`);
  }

  fs.mkdirSync(generatedDirectory, { recursive: true });
  const filePath = path.join(generatedDirectory, `${icon}.tsx`);
  const source = createIconModule(iconName(icon), definition.body);
  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== source) {
    fs.writeFileSync(filePath, source);
  }
  return filePath;
}

module.exports = function resolveRequest(context, moduleName, platform) {
  const iconPath = resolveIcon(moduleName);
  if (iconPath) return { type: "sourceFile", filePath: iconPath };

  const appRoot = __dirname;
  const builtins = {
    crypto: path.join(appRoot, "src/shared/node-compat/crypto.ts"),
    "node:crypto": path.join(appRoot, "src/shared/node-compat/crypto.ts"),
    zlib: path.join(appRoot, "src/shared/node-compat/zlib.ts"),
    "node:zlib": path.join(appRoot, "src/shared/node-compat/zlib.ts"),
  };
  const builtinPath = builtins[moduleName];
  if (builtinPath) return { type: "sourceFile", filePath: builtinPath };

  if (moduleName.startsWith("@babel/runtime/")) {
    const helperPath = path.join(babelRuntimeRoot, moduleName.slice("@babel/runtime/".length));
    return {
      type: "sourceFile",
      filePath: helperPath.endsWith(".js") ? helperPath : `${helperPath}.js`,
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};
