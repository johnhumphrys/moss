import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createAppState, createLibrary } from "./test/test-data";

const previewPayload = {
  dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  width: 1600,
  height: 1200
};

const createBridge = () => {
  const library = createLibrary();

  return {
    pickVault: vi.fn(),
    loadVault: vi.fn().mockResolvedValue(library),
    setTheme: vi.fn().mockResolvedValue("dark"),
    persistTheme: vi.fn().mockResolvedValue({}),
    persistViewerInfo: vi.fn().mockResolvedValue({}),

    getAppState: vi.fn().mockResolvedValue(createAppState()),
    loadOriginalAsset: vi.fn().mockResolvedValue(previewPayload),
    loadPreviewAsset: vi.fn().mockResolvedValue(previewPayload),
    toggleStarAsset: vi.fn().mockResolvedValue(library),
    saveCropAsset: vi.fn().mockResolvedValue(library),
    createBoard: vi.fn(),
    renameBoard: vi.fn(),
    importAssets: vi.fn().mockResolvedValue(library),
    moveAssets: vi.fn().mockResolvedValue(library),
    deleteAssets: vi.fn().mockResolvedValue(library),
    startAssetDrag: vi.fn()
  };
};

describe("App UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the details panel closed by default and persists when toggled open", async () => {
    const bridge = createBridge();
    Object.defineProperty(window, "moss", { value: bridge, configurable: true });

    const { container } = render(<App />);

    await screen.findByRole("heading", { name: "Cycling" });
    await userEvent.click(container.querySelector("[data-asset-id='cycling/one.jpg']") as HTMLElement);

    expect(screen.queryByText("Details")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "i" }));
    expect(await screen.findByText("Details")).toBeInTheDocument();

    await waitFor(() => {
      expect(bridge.persistViewerInfo).toHaveBeenCalledWith("/Moodboards", true);
    });
  });

  it("opens the rename album modal from the album title action", async () => {
    const bridge = createBridge();
    Object.defineProperty(window, "moss", { value: bridge, configurable: true });

    render(<App />);

    await screen.findByRole("heading", { name: "Cycling" });
    await userEvent.click(screen.getAllByRole("button", { name: "Rename album" })[0]);

    expect(await screen.findByRole("heading", { name: "Rename album" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cycling")).toBeInTheDocument();
  });
});
