import { describe, expect, it } from "vitest";
import { buildCreateAlbumDialog, buildRenameAlbumDialog, normalizeAlbumNameInput } from "./album-dialog";

describe("album-dialog helpers", () => {
  it("builds a root album dialog", () => {
    expect(buildCreateAlbumDialog(null)).toEqual({
      mode: "create",
      parentBoardId: null,
      title: "New album",
      buttonLabel: "Create"
    });
  });

  it("builds a sub album dialog", () => {
    expect(buildCreateAlbumDialog("cycling")).toEqual({
      mode: "create",
      parentBoardId: "cycling",
      title: "New sub-album",
      buttonLabel: "Create"
    });
  });

  it("returns no rename dialog for synthetic boards", () => {
    expect(buildRenameAlbumDialog({ id: "__starred__", title: "Starred", synthetic: true })).toBeNull();
  });

  it("builds a rename dialog for standard boards", () => {
    expect(buildRenameAlbumDialog({ id: "cycling", title: "Cycling" })).toEqual({
      mode: "rename",
      boardId: "cycling",
      currentName: "Cycling",
      title: "Rename album",
      buttonLabel: "Save"
    });
  });

  it("normalizes album name input", () => {
    expect(normalizeAlbumNameInput("  Coffee  ")).toBe("Coffee");
  });
});
