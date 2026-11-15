import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";

// El panel habla con el backend a través de varios bindings; se doblan todos
// para poder montarlo sin Wails.
const api = vi.hoisted(() => ({
  setConfig: vi.fn(),
  toggleDaemon: vi.fn(),
  addProvider: vi.fn(),
  addRedditProvider: vi.fn(),
  removeProvider: vi.fn(),
  checkBattery: vi.fn(),
  getGowerStatus: vi.fn(),
  getAppVersion: vi.fn(),
  getLogPath: vi.fn(),
  openLogFile: vi.fn(),
  setCustomGowerPath: vi.fn(),
  pickGowerBinary: vi.fn(),
  pickDirectory: vi.fn(),
}));

vi.mock("$lib/api", () => ({
  gower: {
    setConfig: api.setConfig,
    toggleDaemon: api.toggleDaemon,
    addProvider: api.addProvider,
    addRedditProvider: api.addRedditProvider,
    removeProvider: api.removeProvider,
  },
  checkBattery: api.checkBattery,
  getGowerStatus: api.getGowerStatus,
  getAppVersion: api.getAppVersion,
  getLogPath: api.getLogPath,
  openLogFile: api.openLogFile,
  setCustomGowerPath: api.setCustomGowerPath,
  pickGowerBinary: api.pickGowerBinary,
  pickDirectory: api.pickDirectory,
}));

import { locale } from "$lib/stores/i18n";
import SettingsPanel from "./SettingsPanel.svelte";

/** Config con la forma que espera el panel. */
function makeConfig() {
  return {
    behavior: {
      change_interval: 30,
      auto_download: false,
      from_favorites: false,
      save_favorites_to_folder: false,
      multi_monitor: "distinct",
    },
    power: { pause_on_low_battery: true, low_battery_threshold: 20 },
    paths: {
      wallpapers: "/home/u/Walls",
      use_system_dir: false,
      index_wallpapers: false,
    },
    providers: { wallhaven: { name: "Wallhaven", enabled: true } },
    generic_providers: {},
  };
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locale.set("en");
    api.checkBattery.mockResolvedValue(true);
    api.getGowerStatus.mockResolvedValue({
      resolved_path: "/usr/bin/gower",
      configured_path: "",
      available: true,
      error: "",
    });
    api.getAppVersion.mockResolvedValue("0.2.4");
    api.getLogPath.mockResolvedValue(
      "/home/u/.local/state/gowerui/gowerui.log",
    );
  });

  it("monta las secciones y pide el estado de los bindings", async () => {
    render(SettingsPanel, {
      config: makeConfig(),
      status: { daemon_running: false },
    });

    expect(screen.getByText("Daemon")).toBeInTheDocument();
    expect(screen.getByText("Behavior")).toBeInTheDocument();
    expect(screen.getByText("gower binary")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();

    // Los subcomponentes consultan el backend al montarse.
    expect(await screen.findByText("/usr/bin/gower")).toBeInTheDocument();
    expect(await screen.findByText(/0\.2\.4/)).toBeInTheDocument();
    expect(api.checkBattery).toHaveBeenCalled();
  });

  it("abre la sub-vista de providers y vuelve al panel", async () => {
    render(SettingsPanel, {
      config: makeConfig(),
      status: { daemon_running: false },
    });

    await fireEvent.click(screen.getByText(/Providers/));

    // La sub-vista lista los providers configurados.
    expect(screen.getByText("Wallhaven")).toBeInTheDocument();
    expect(screen.getByText("Custom Providers")).toBeInTheDocument();

    await fireEvent.click(screen.getByText("arrow_back").closest("button"));

    expect(screen.queryByText("Wallhaven")).toBeNull();
    expect(screen.getByText("Daemon")).toBeInTheDocument();
  });
});
