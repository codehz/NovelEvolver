import "./src/shared/node-compat/buffer";
import { AppRegistry } from "react-native";
import "react-native-gesture-handler";

import { name as appName } from "./app.json";
import { App } from "./src/app/App";

AppRegistry.registerComponent(appName, () => App);
