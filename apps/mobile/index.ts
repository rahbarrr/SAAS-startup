import { registerRootComponent } from "expo";
import "./src/services/geofencing";
import { App } from "./src/App";

// Register the root application component for native Android/iOS builds.
// Importing ./src/services/geofencing at the top level ensures TaskManager.defineTask
// is evaluated immediately on both foreground launch and headless background wakeups.
registerRootComponent(App);

