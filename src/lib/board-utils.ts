export const getParentBoardId = (boardId: string) => {
  const segments = boardId.split("/");
  if (segments.length <= 1) {
    return null;
  }

  return segments.slice(0, -1).join("/");
};

export const isTopLevelBoard = (boardId: string) => !boardId.includes("/");

export const buildBoardCountParts = (imageCount: number, childCount: number) =>
  [
    imageCount > 0 ? `${imageCount} image${imageCount === 1 ? "" : "s"}` : "",
    childCount > 0 ? `${childCount} folder${childCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean);
