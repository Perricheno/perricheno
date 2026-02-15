import { getSettings, saveSettings } from "../app/actions";

async function testSettings() {
    console.log("Reading initial settings...");
    const initial = await getSettings();
    console.log("Initial:", initial);

    console.log("Updating settings...");
    const newSettings = { ...initial, model: "test-model-" + Date.now() };
    await saveSettings(newSettings);

    console.log("Reading updated settings...");
    const updated = await getSettings();
    console.log("Updated:", updated);

    if (updated.model === newSettings.model) {
        console.log("SUCCESS: Settings persistence verified!");
    } else {
        console.error("FAILURE: Settings were not persisted correctly.");
    }
}

testSettings().catch(console.error);
