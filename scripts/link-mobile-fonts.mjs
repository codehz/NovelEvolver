#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mobileRoot = path.join(projectRoot, "apps/mobile");
const nativeFontsRoot = path.join(projectRoot, "vendor/fonts/native");
const androidFontRoot = path.join(mobileRoot, "android/app/src/main/res/font");
const androidManifest = path.join(mobileRoot, "android/link-assets-manifest.json");
const iosRoot = path.join(mobileRoot, "ios");
const iosPbxproj = path.join(iosRoot, "NovelEvolver.xcodeproj/project.pbxproj");
const mobileRequire = createRequire(path.join(mobileRoot, "package.json"));

const androidFonts = [
  ["misans/MiSansVF.ttf", "misans_vf.ttf"],
  ["maple-mono/MapleMono-CN-Regular.ttf", "maple_mono_cn_regular.ttf"],
  ["maple-mono/MapleMono-CN-Bold.ttf", "maple_mono_cn_bold.ttf"],
];
const iosFonts = androidFonts.map(([sourceName]) => path.join(nativeFontsRoot, sourceName));

mkdirSync(androidFontRoot, { recursive: true });
for (const [sourceName, targetName] of androidFonts) {
  copyFileSync(path.join(nativeFontsRoot, sourceName), path.join(androidFontRoot, targetName));
}

// The CLI link-assets Android implementation currently cannot read the name
// table of these fonts with its bundled opentype.js version. Android
// registration is therefore explicit in the checked-in XML/MainApplication
// files. Its iOS helper remains useful because iOS only needs Xcode and
// UIAppFonts resource integration.
if (existsSync(androidManifest)) {
  rmSync(androidManifest);
}
const copyAssetsIos = mobileRequire(
  "@react-native-community/cli-link-assets/build/tools/copyAssets/ios",
).default;
copyAssetsIos(iosFonts, {
  platformPath: iosRoot,
  pbxprojFilePath: iosPbxproj,
  isFontAsset: true,
});
