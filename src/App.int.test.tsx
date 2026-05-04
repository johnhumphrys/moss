import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createAppState, createLibrary } from "./test/test-data";

const previewPayload = {
  dataUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  width: 1,
  height: 1
};

const createBridge = () => {
  const library = createLibrary();

  return {
    pickVault: vi.fn(),
    loadVault: vi.fn().mockResolvedValue(library),
    setTheme: vi.fn().mockResolvedValue("dark"),
    persistTheme: vi.fn().mockResolvedValue({}),
    persistViewerInfo: vi.fn().mockResolvedValue({}),
    getDevVaultPath: vi.fn().mockResolvedValue("/Moodboards"),
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

describe("App integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a new album from the template tile", async () => {
    const bridge = createBridge();
    const nextLibrary = {
      ...createLibrary(),
      boards: [
        ...createLibrary().boards,
        {
          id: "coffee",
          title: "Coffee",
          relativePath: "coffee",
          folderName: "coffee",
          imageCount: 0,
          assets: []
        }
      ]
    };
    bridge.createBoard.mockResolvedValue({ vault: nextLibrary, boardId: "coffee" });
    Object.defineProperty(window, "moss", { value: bridge, configurable: true });

    render(<App />);

    await screen.findByRole("heading", { name: "Cycling" });
    await userEvent.click(screen.getByRole("button", { name: "New album" }));
    await userEvent.type(screen.getByPlaceholderText("Album name"), "Coffee");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(bridge.createBoard).toHaveBeenCalledWith("/Moodboards", null, "Coffee");
    });
    expect(await screen.findByText("Created Coffee.")).toBeInTheDocument();
  });

  it("renames an album from the header action", async () => {
    const bridge = createBridge();
    const nextLibrary = {
      ...createLibrary(),
      boards: createLibrary().boards.map((board) =>
        board.id === "cycling" ? { ...board, id: "road-cycling", title: "Road Cycling", relativePath: "road-cycling" } : board
      )
    };
    bridge.renameBoard.mockResolvedValue({ vault: nextLibrary, boardId: "road-cycling" });
    Object.defineProperty(window, "moss", { value: bridge, configurable: true });

    render(<App />);

    await screen.findByRole("heading", { name: "Cycling" });
    await userEvent.click(screen.getAllByRole("button", { name: "Rename album" })[0]);
    const input = screen.getByPlaceholderText("Album name");
    await userEvent.clear(input);
    await userEvent.type(input, "Road Cycling");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(bridge.renameBoard).toHaveBeenCalledWith("/Moodboards", "cycling", "Road Cycling");
    });
    expect(await screen.findByText("Renamed album to Road Cycling.")).toBeInTheDocument();
  });

  it("moves selected images by dragging to another album without starting a native OS drag", async () => {
    const bridge = createBridge();
    Object.defineProperty(window, "moss", { value: bridge, configurable: true });

    const { container } = render(<App />);

    await screen.findByRole("heading", { name: "Cycling" });
    await userEvent.click(screen.getAllByRole("button", { name: "Select image" })[0]);
    expect(await screen.findByText("1 selected")).toBeInTheDocument();

    const assetCard = container.querySelector("[data-asset-id='cycling/one.jpg']");
    expect(assetCard).not.toBeNull();

    const dragStore = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      files: [],
      setData: vi.fn((type: string, value: string) => {
        dragStore.set(type, value);
      }),
      getData: vi.fn((type: string) => dragStore.get(type) ?? "")
    };

    fireEvent.dragStart(assetCard!, { dataTransfer });
    expect(bridge.startAssetDrag).not.toHaveBeenCalled();

    const runningAlbum = screen.getByRole("button", { name: /Running/i });
    fireEvent.drop(runningAlbum, { dataTransfer });

    await waitFor(() => {
      expect(bridge.moveAssets).toHaveBeenCalledWith("/Moodboards", "running", ["/Moodboards/cycling/one.jpg"]);
    });
  });
});
