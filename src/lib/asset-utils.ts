type FileWithPath = File & { path?: string };

export const extractDroppedFilePaths = (event: DragEvent) =>
  Array.from(event.dataTransfer.files)
    .map((file) => (file as FileWithPath).path)
    .filter((value): value is string => Boolean(value));

export const getBoardCoverAssets = (board: Board) => {
  const coverAssets = board.assets.slice(0, 3);
  if (coverAssets.length > 0) {
    return coverAssets;
  }

  return board.previewAsset ? [board.previewAsset] : [];
};

export const getDraggedAssetPaths = (
  selectionMode: boolean,
  selectedAssetIds: string[],
  selectedAssets: Asset[],
  draggedAsset: Asset
) => {
  if (selectionMode && selectedAssetIds.includes(draggedAsset.id)) {
    return selectedAssets.map((asset) => asset.absolutePath);
  }

  return [draggedAsset.absolutePath];
};

export const getInitialVisibleAssetIds = (assets: Asset[], count = 12) => assets.slice(0, count).map((asset) => asset.id);

export const isBoardInitialLoading = (
  selectedBoard: Board | null,
  visibleAssetIds: string[],
  assetPreviewLoaded: Record<string, boolean>
) =>
  Boolean(
    selectedBoard &&
      selectedBoard.assets.length > 0 &&
      visibleAssetIds.some((assetId) => !assetPreviewLoaded[assetId])
  );

export const toggleSelectedAssetIds = (selectedAssetIds: string[], assetId: string) =>
  selectedAssetIds.includes(assetId)
    ? selectedAssetIds.filter((value) => value !== assetId)
    : [...selectedAssetIds, assetId];
