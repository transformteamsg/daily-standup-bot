import path from "path";
import { loadAndRunScenarios } from "@tests/e2e/runner";

const scenariosDir = path.resolve(__dirname, "scenarios");
loadAndRunScenarios(scenariosDir);
