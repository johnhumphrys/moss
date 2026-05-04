import { describe, expect, it } from "vitest";
import { buildBoardCountParts, getParentBoardId, isTopLevelBoard } from "./board-utils";

describe("board-utils", () => {
  it("finds parent board ids", () => {
    expect(getParentBoardId("root/child")).toBe("root");
    expect(getParentBoardId("root/child/grandchild")).toBe("root/child");
    expect(getParentBoardId("root")).toBeNull();
  });

  it("detects top level boards", () => {
    expect(isTopLevelBoard("cycling")).toBe(true);
    expect(isTopLevelBoard("cycling/coffee")).toBe(false);
  });

  it("builds image and folder counts while omitting empty values", () => {
    expect(buildBoardCountParts(0, 0)).toEqual([]);
    expect(buildBoardCountParts(1, 0)).toEqual(["1 image"]);
    expect(buildBoardCountParts(2, 1)).toEqual(["2 images", "1 folder"]);
  });
});
