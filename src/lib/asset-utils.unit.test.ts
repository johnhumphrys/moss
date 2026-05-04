import { describe, expect, it } from "vitest";
import {
  getBoardCoverAssets,
  getDraggedAssetPaths,
  getInitialVisibleAssetIds,
  isBoardInitialLoading,
  toggleSelectedAssetIds
} from "./asset-utils";

const asset = (id: string): Asset => ({
  id,
  name: `${id}.jpg`,
  absolutePath: `/Moodboards/${id}.jpg`,
  relativePath: `${id}.jpg`,
  size: 100,
  modifiedAt: "2026-05-04T10:00:00.000Z"
});

describe("asset-utils", () => {
  it("uses board assets as cover assets before previewAsset fallback", () => {
    const board: Board = {
      id: "cycling",
      title: "Cycling",
      relativePath: "cycling",
      folderName: "cycling",
      imageCount: 2,
      assets: [asset("one"), asset("two"), asset("three"), asset("four")],
      previewAsset: asset("preview")
    };

    expect(getBoardCoverAssets(board).map((current) => current.id)).toEqual(["one", "two", "three"]);
  });

  it("falls back to previewAsset when a board has no direct assets", () => {
    const preview = asset("preview");
    const board: Board = {
      id: "empty",
      title: "Empty",
      relativePath: "empty",
      folderName: "empty",
      imageCount: 0,
      assets: [],
      previewAsset: preview
    };

    expect(getBoardCoverAssets(board)).toEqual([preview]);
  });

  it("builds drag payloads from the selected assets when dragging one of them", () => {
    const selectedAssets = [asset("one"), asset("two")];
    expect(getDraggedAssetPaths(true, ["one", "two"], selectedAssets, selectedAssets[0])).toEqual([
      "/Moodboards/one.jpg",
      "/Moodboards/two.jpg"
    ]);
  });

  it("falls back to a single dragged asset when not dragging a selected asset", () => {
    const selectedAssets = [asset("one"), asset("two")];
    expect(getDraggedAssetPaths(false, ["one", "two"], selectedAssets, asset("three"))).toEqual([
      "/Moodboards/three.jpg"
    ]);
  });

  it("gets the initial visible asset ids", () => {
    expect(getInitialVisibleAssetIds([asset("one"), asset("two")], 1)).toEqual(["one"]);
  });

  it("detects initial board loading from visible unloaded assets", () => {
    const board: Board = {
      id: "cycling",
      title: "Cycling",
      relativePath: "cycling",
      folderName: "cycling",
      imageCount: 2,
      assets: [asset("one"), asset("two")]
    };

    expect(isBoardInitialLoading(board, ["one"], {})).toBe(true);
    expect(isBoardInitialLoading(board, ["one"], { one: true })).toBe(false);
    expect(isBoardInitialLoading(null, ["one"], {})).toBe(false);
  });

  it("toggles selected asset ids", () => {
    expect(toggleSelectedAssetIds(["one"], "one")).toEqual([]);
    expect(toggleSelectedAssetIds(["one"], "two")).toEqual(["one", "two"]);
  });
});
