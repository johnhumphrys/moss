import { DragEvent, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import trashIcon from "./trash.png";
import { buildCreateAlbumDialog, buildRenameAlbumDialog, normalizeAlbumNameInput, type AlbumDialogState } from "./lib/album-dialog";
import {
  extractDroppedFilePaths,
  getBoardCoverAssets,
  getDraggedAssetPaths,
  getInitialVisibleAssetIds,
  isBoardInitialLoading,
  toggleSelectedAssetIds
} from "./lib/asset-utils";
import { buildBoardCountParts, getParentBoardId, isTopLevelBoard } from "./lib/board-utils";
import { formatBytes, formatDate } from "./lib/formatters";

type ViewerState = {
  boardId: string;
  assetId: string;
};

type CropHandle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const INTERNAL_DRAG_MIME = "application/x-moss-asset-paths";

const getBridge = () => window.moss;

function App() {
  const devDefaultFolder = "/Users/johnhumphrys/Documents/Moodboards";
  const [library, setLibrary] = useState<VaultData | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isPicking, setIsPicking] = useState(false);
  const [manualFolderPath, setManualFolderPath] = useState(devDefaultFolder);
  const [appState, setAppState] = useState<AppState>({ recentVaults: [] });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMutatingAssets, setIsMutatingAssets] = useState(false);
  const [assetDimensions, setAssetDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [assetPreviewSrcs, setAssetPreviewSrcs] = useState<Record<string, string>>({});
  const [assetPreviewLoaded, setAssetPreviewLoaded] = useState<Record<string, boolean>>({});
  const [visibleAssetIds, setVisibleAssetIds] = useState<string[]>([]);
  const [boardPreviewSrcs, setBoardPreviewSrcs] = useState<Record<string, string>>({});
  const [viewerImageLoading, setViewerImageLoading] = useState(false);
  const [viewerImageSrc, setViewerImageSrc] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  const [cropFrameSize, setCropFrameSize] = useState({ width: 1, height: 1 });
  const [savingCrop, setSavingCrop] = useState(false);
  const [assetActionMenu, setAssetActionMenu] = useState<{ assetId: string; x: number; y: number } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [dragTargetBoardId, setDragTargetBoardId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [albumDialog, setAlbumDialog] = useState<AlbumDialogState | null>(null);
  const [albumNameInput, setAlbumNameInput] = useState("");
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(() => typeof getBridge() !== "undefined");
  const [albumInfoOpen, setAlbumInfoOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const hasDesktopBridge = typeof getBridge() !== "undefined";
  const longPressTimerRef = useRef<number | null>(null);
  const cropDragRef = useRef<{
    handle: CropHandle;
    startX: number;
    startY: number;
    startRect: CropRect;
  } | null>(null);

  const rootBoards = useMemo(
    () => library?.boards.filter((board) => isTopLevelBoard(board.id)) ?? [],
    [library]
  );

  const selectedBoard = useMemo(
    () => library?.boards.find((board) => board.id === selectedBoardId) ?? rootBoards[0] ?? null,
    [library, rootBoards, selectedBoardId]
  );

  const childBoards = useMemo(
    () => library?.boards.filter((board) => getParentBoardId(board.id) === selectedBoard?.id) ?? [],
    [library, selectedBoard]
  );

  const moveTargets = useMemo(
    () => library?.boards.filter((board) => board.id !== selectedBoard?.id && !board.synthetic) ?? [],
    [library, selectedBoard]
  );

  const selectedAsset = useMemo(() => {
    if (!viewer || !selectedBoard) {
      return null;
    }

    return selectedBoard.assets.find((asset) => asset.id === viewer.assetId) ?? null;
  }, [selectedBoard, viewer]);

  const selectedAssetDimensions = selectedAsset ? assetDimensions[selectedAsset.id] : undefined;

  const selectedAssets = useMemo(
    () => selectedBoard?.assets.filter((asset) => selectedAssetIds.includes(asset.id)) ?? [],
    [selectedAssetIds, selectedBoard]
  );

  const boardInitialLoading = isBoardInitialLoading(selectedBoard, visibleAssetIds, assetPreviewLoaded);

  const albumTotalSize = useMemo(
    () => selectedBoard?.assets.reduce((sum, asset) => sum + asset.size, 0) ?? 0,
    [selectedBoard]
  );

  useEffect(() => {
    const loadAppState = async () => {
      if (!hasDesktopBridge) {
        return;
      }

      try {
        const nextAppState = await getBridge().getAppState();
        setAppState(nextAppState);

        if (nextAppState.lastVaultPath) {
          try {
            const nextLibrary = await getBridge().loadVault(nextAppState.lastVaultPath);
            loadLibrary(nextLibrary);
          } catch {
            setErrorMessage("Could not reopen the last folder. Choose it again in Settings.");
          }
        } else {
          const devPath = await getBridge().getDevVaultPath();
          if (devPath) {
            setManualFolderPath(devPath);
          }
        }
      } finally {
        setIsInitialLoading(false);
      }
    };

    void loadAppState();
  }, [hasDesktopBridge]);

  useEffect(() => {
    if (!library) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    if (hasDesktopBridge) {
      void getBridge().setTheme(theme);
    }
  }, [hasDesktopBridge, library, theme]);

  useEffect(() => {
    if (!selectedAsset) {
      return;
    }

    setViewerImageLoading(true);
    setViewerImageSrc(null);
    setCropMode(false);
    setCropRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  }, [selectedAsset]);

  useEffect(() => {
    setNoteText(selectedAsset?.notes ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.assetId]);

  useEffect(() => {
    let cancelled = false;

    const loadViewerAsset = async () => {
      if (!selectedAsset) {
        return;
      }

      if (!hasDesktopBridge) {
        if (!cancelled) {
          setViewerImageSrc(`file://${selectedAsset.absolutePath}`);
          setViewerImageLoading(false);
        }
        return;
      }

      try {
        const payload = await getBridge().loadOriginalAsset(selectedAsset.absolutePath);
        if (!cancelled) {
          setViewerImageSrc(payload.dataUrl);

          if (payload.width && payload.height) {
            setAssetDimensions((current) => ({
              ...current,
              [selectedAsset.id]: { width: payload.width, height: payload.height }
            }));
          }
        }
      } catch {
        if (!cancelled) {
          setErrorMessage(`Could not load ${selectedAsset.name}.`);
          setViewerImageLoading(false);
        }
      }
    };

    void loadViewerAsset();

    return () => {
      cancelled = true;
    };
  }, [hasDesktopBridge, selectedAsset]);

  useEffect(() => {
    const loadBoardPreviews = async () => {
      if (!hasDesktopBridge || !library) {
        return;
      }

      const boardsToPreview = [...rootBoards, ...childBoards];
      const coverAssets = boardsToPreview.flatMap((board) => getBoardCoverAssets(board));
      const nextPreviewEntries = await Promise.all(
        boardsToPreview.map(async (board) => {
          if (!board.previewAsset) {
            return [board.id, ""] as const;
          }

          try {
            const payload = await getBridge().loadPreviewAsset(
              board.previewAsset.absolutePath,
              board.previewAsset.relativePath,
              board.previewAsset.modifiedAt,
              board.previewAsset.size
            );
            return [board.id, payload.dataUrl] as const;
          } catch {
            return [board.id, `file://${board.previewAsset.absolutePath}`] as const;
          }
        })
      );
      const nextCoverEntries = await Promise.all(
        coverAssets.map(async (asset) => {
          try {
            const payload = await getBridge().loadPreviewAsset(asset.absolutePath, asset.relativePath, asset.modifiedAt, asset.size);
            return [asset.id, payload.dataUrl] as const;
          } catch {
            return [asset.id, `file://${asset.thumbnailPath ?? asset.absolutePath}`] as const;
          }
        })
      );

      setBoardPreviewSrcs((current) => ({
        ...current,
        ...Object.fromEntries(nextPreviewEntries.filter(([, src]) => src))
      }));
      setAssetPreviewSrcs((current) => ({
        ...current,
        ...Object.fromEntries(nextCoverEntries)
      }));
    };

    void loadBoardPreviews();
  }, [childBoards, hasDesktopBridge, library, rootBoards]);

  useEffect(() => {
    const loadAssetPreviews = async () => {
      if (!selectedBoard || !hasDesktopBridge) {
        return;
      }

      const pendingAssets = selectedBoard.assets.filter(
        (asset) => visibleAssetIds.includes(asset.id) && !assetPreviewSrcs[asset.id]
      );

      if (pendingAssets.length === 0) {
        return;
      }

      const nextPreviewEntries = await Promise.all(
        pendingAssets.map(async (asset) => {
          try {
            const payload = await getBridge().loadPreviewAsset(
              asset.absolutePath,
              asset.relativePath,
              asset.modifiedAt,
              asset.size
            );
            return [asset.id, payload.dataUrl] as const;
          } catch {
            return [asset.id, `file://${asset.thumbnailPath ?? asset.absolutePath}`] as const;
          }
        })
      );

      setAssetPreviewSrcs((current) => ({
        ...current,
        ...Object.fromEntries(nextPreviewEntries)
      }));
  };

    void loadAssetPreviews();
  }, [assetPreviewSrcs, hasDesktopBridge, selectedBoard, visibleAssetIds]);

  useEffect(() => {
    if (!selectedBoard) {
      return;
    }

    setAssetPreviewLoaded({});
    setVisibleAssetIds(getInitialVisibleAssetIds(selectedBoard.assets));

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleAssetIds((current) => {
          const nextIds = new Set(current);

          for (const entry of entries) {
            if (entry.isIntersecting) {
              const assetId = (entry.target as HTMLElement).dataset.assetId;
              if (assetId) {
                nextIds.add(assetId);
              }
            }
          }

          return Array.from(nextIds);
        });
      },
      {
        rootMargin: "400px 0px"
      }
    );

    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-asset-id]"));
    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [selectedBoard?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!viewer || !selectedBoard) {
        return;
      }

      const currentIndex = selectedBoard.assets.findIndex((asset) => asset.id === viewer.assetId);
      if (event.key === "Escape") {
        setViewer(null);
      } else if (event.key === "ArrowRight" && currentIndex < selectedBoard.assets.length - 1) {
        setViewer({ boardId: selectedBoard.id, assetId: selectedBoard.assets[currentIndex + 1].id });
      } else if (event.key === "ArrowLeft" && currentIndex > 0) {
        setViewer({ boardId: selectedBoard.id, assetId: selectedBoard.assets[currentIndex - 1].id });
      } else if (event.key.toLowerCase() === "i") {
        toggleViewerInfoFromKeyboard();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedBoard, viewer]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setAlbumInfoOpen(false);
  }, [selectedBoardId]);

  function loadLibrary(nextLibrary: VaultData, options?: { preserveCaches?: boolean }) {
    setLibrary(nextLibrary);
    setTheme(nextLibrary.theme ?? "dark");
    setShowInfo(nextLibrary.viewerInfoOpen ?? false);
    setSelectedBoardId((current) =>
      nextLibrary.boards.some((board) => board.id === current) ? current : nextLibrary.boards[0]?.id ?? null
    );
    setViewer(null);
    setSelectionMode(false);
    setSelectedAssetIds([]);
    if (!options?.preserveCaches) {
      setAssetPreviewSrcs({});
      setAssetPreviewLoaded({});
      setBoardPreviewSrcs({});
      setVisibleAssetIds([]);
    }
  }

  const refreshAppState = async () => {
    if (!hasDesktopBridge) {
      return;
    }

    setAppState(await getBridge().getAppState());
  };

  const pickFolder = async () => {
    if (!hasDesktopBridge) {
      setErrorMessage("Folder selection only works inside the Electron app.");
      return;
    }

    setIsPicking(true);
    setErrorMessage(null);
    try {
      const nextLibrary = await getBridge().pickVault();
      if (!nextLibrary) {
        return;
      }

      loadLibrary(nextLibrary);
      await refreshAppState();
      setSettingsOpen(false);
    } finally {
      setIsPicking(false);
    }
  };

  const openFolderPath = async (folderPath: string) => {
    if (!hasDesktopBridge) {
      setErrorMessage("Folder opening only works inside the Electron app.");
      return;
    }

    try {
      setErrorMessage(null);
      setStatusMessage(null);
      const nextLibrary = await getBridge().loadVault(folderPath);
      loadLibrary(nextLibrary);
      setManualFolderPath(folderPath);
      await refreshAppState();
      setSettingsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open that folder.";
      setErrorMessage(message);
    }
  };

  const openCurrentPathInput = async () => {
    const trimmedPath = manualFolderPath.trim();
    if (!trimmedPath) {
      setErrorMessage("Enter a folder path first.");
      return;
    }

    await openFolderPath(trimmedPath);
  };

  const updateTheme = async (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    if (library && hasDesktopBridge) {
      await getBridge().persistTheme(library.rootPath, nextTheme);
    }
  };

  async function updateShowInfo(nextShowInfo: boolean) {
    setShowInfo(nextShowInfo);
    if (library && hasDesktopBridge) {
      await getBridge().persistViewerInfo(library.rootPath, nextShowInfo);
    }
  }

  const toggleViewerInfoFromKeyboard = useEffectEvent(() => {
    void updateShowInfo(!showInfo);
  });

  const openCreateAlbumDialog = (parentBoardId: string | null) => {
    setAlbumDialog(buildCreateAlbumDialog(parentBoardId));
    setAlbumNameInput("");
  };

  const openRenameAlbumDialog = (board: Board) => {
    const dialog = buildRenameAlbumDialog(board);
    if (!dialog) {
      return;
    }

    setAlbumDialog(dialog);
    setAlbumNameInput(board.title);
  };

  const closeAlbumDialog = () => {
    if (isSavingAlbum) {
      return;
    }

    setAlbumDialog(null);
    setAlbumNameInput("");
  };

  const submitAlbumDialog = async () => {
    if (!library || !hasDesktopBridge || !albumDialog) {
      return;
    }

    const nextName = normalizeAlbumNameInput(albumNameInput);
    if (!nextName) {
      setErrorMessage("Album name cannot be empty.");
      return;
    }

    setIsSavingAlbum(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (albumDialog.mode === "create") {
        const result = await getBridge().createBoard(library.rootPath, albumDialog.parentBoardId, nextName);
        loadLibrary(result.vault);
        setSelectedBoardId(result.boardId);
        setStatusMessage(`Created ${nextName}.`);
      } else {
        const result = await getBridge().renameBoard(library.rootPath, albumDialog.boardId, nextName);
        loadLibrary(result.vault);
        setSelectedBoardId(result.boardId);
        setStatusMessage(`Renamed album to ${nextName}.`);
      }

      setAlbumDialog(null);
      setAlbumNameInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the album.";
      setErrorMessage(message);
    } finally {
      setIsSavingAlbum(false);
    }
  };

  const toggleStarAsset = async (asset: Asset) => {
    if (!library || !hasDesktopBridge) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextLibrary = await getBridge().toggleStarAsset(library.rootPath, asset.relativePath);
      loadLibrary(nextLibrary, { preserveCaches: true });
      if (viewer && selectedBoard) {
        const nextBoard = nextLibrary.boards.find((board) => board.id === selectedBoard.id);
        const nextAsset = nextBoard?.assets.find((currentAsset) => currentAsset.relativePath === asset.relativePath);
        if (nextBoard && nextAsset) {
          setViewer({ boardId: nextBoard.id, assetId: nextAsset.id });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update the star.";
      setErrorMessage(message);
    }
  };

  const saveNote = async (asset: Asset, note: string) => {
    if (!library || !hasDesktopBridge) {
      return;
    }

    const trimmed = note.trim() || undefined;
    console.log("[moss] saveNote", asset.relativePath, JSON.stringify(note), "current:", JSON.stringify(asset.notes), "skip:", trimmed === (asset.notes ?? undefined));
    if (trimmed === (asset.notes ?? undefined)) {
      return;
    }

    try {
      await getBridge().setAssetNote(library.rootPath, asset.relativePath, note);
      setLibrary((current) => {
        if (!current) return current;
        return {
          ...current,
          boards: current.boards.map((board) => ({
            ...board,
            assets: board.assets.map((a) =>
              a.relativePath === asset.relativePath ? { ...a, notes: trimmed } : a
            )
          }))
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save note.";
      setErrorMessage(message);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => !current);
    setSelectedAssetIds([]);
  };

  const enterSelectionModeForAsset = (assetId: string) => {
    setSelectionMode(true);
    setSelectedAssetIds([assetId]);
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((current) => toggleSelectedAssetIds(current, assetId));
  };

  const openAsset = (assetId: string) => {
    if (!selectedBoard) {
      return;
    }

    if (selectionMode) {
      toggleAssetSelection(assetId);
      return;
    }

    setViewer({ boardId: selectedBoard.id, assetId });
  };

  const handleAssetCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, assetId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAsset(assetId);
    }
  };

  const startLongPress = (event: ReactPointerEvent<HTMLElement>, asset: Asset) => {
    if (selectionMode) {
      return;
    }

    window.clearTimeout(longPressTimerRef.current ?? undefined);
    longPressTimerRef.current = window.setTimeout(() => {
      setAssetActionMenu({
        assetId: asset.id,
        x: event.clientX,
        y: event.clientY
      });
    }, 500);
  };

  const clearLongPress = () => {
    window.clearTimeout(longPressTimerRef.current ?? undefined);
    longPressTimerRef.current = null;
  };

  const stepViewer = (direction: -1 | 1) => {
    if (!selectedBoard || !viewer) {
      return;
    }

    const currentIndex = selectedBoard.assets.findIndex((asset) => asset.id === viewer.assetId);
    const nextAsset = selectedBoard.assets[currentIndex + direction];
    if (!nextAsset) {
      return;
    }

    setViewer({ boardId: selectedBoard.id, assetId: nextAsset.id });
  };

  const evictAssetsFromCaches = (ids: string[]) => {
    const idSet = new Set(ids);
    setAssetPreviewSrcs((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !idSet.has(id))));
    setAssetPreviewLoaded((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !idSet.has(id))));
    setVisibleAssetIds((current) => current.filter((id) => !idSet.has(id)));
  };

  const performDeleteSingle = async (assetId: string) => {
    if (!library || !selectedBoard || !hasDesktopBridge) {
      return;
    }

    const asset = selectedBoard.assets.find((currentAsset) => currentAsset.id === assetId);
    if (!asset) {
      return;
    }

    setAssetActionMenu(null);
    setIsMutatingAssets(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextLibrary = await getBridge().deleteAssets(library.rootPath, [asset.absolutePath]);
      loadLibrary(nextLibrary, { preserveCaches: true });
      evictAssetsFromCaches([asset.id]);
      setStatusMessage(`Deleted ${asset.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete the image.";
      setErrorMessage(message);
    } finally {
      setIsMutatingAssets(false);
    }
  };

  const performMoveSingle = async (assetId: string, boardId: string) => {
    if (!library || !selectedBoard || !hasDesktopBridge) {
      return;
    }

    const asset = selectedBoard.assets.find((currentAsset) => currentAsset.id === assetId);
    if (!asset || !boardId) {
      return;
    }

    setAssetActionMenu(null);
    setIsMutatingAssets(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextLibrary = await getBridge().moveAssets(library.rootPath, boardId, [asset.absolutePath]);
      loadLibrary(nextLibrary);
      setStatusMessage(`Moved ${asset.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not move the image.";
      setErrorMessage(message);
    } finally {
      setIsMutatingAssets(false);
    }
  };

  const startCropInteraction = (handle: CropHandle, event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    cropDragRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startRect: cropRect
    };

    const onPointerMove = (pointerEvent: PointerEvent) => {
      const currentDrag = cropDragRef.current;
      if (!currentDrag) {
        return;
      }

      const dx = (pointerEvent.clientX - currentDrag.startX) / cropFrameSize.width;
      const dy = (pointerEvent.clientY - currentDrag.startY) / cropFrameSize.height;
      const minSize = 0.05;
      let { x, y, width, height } = currentDrag.startRect;

      if (currentDrag.handle.includes("e")) {
        width = Math.min(1 - x, Math.max(minSize, currentDrag.startRect.width + dx));
      }
      if (currentDrag.handle.includes("s")) {
        height = Math.min(1 - y, Math.max(minSize, currentDrag.startRect.height + dy));
      }
      if (currentDrag.handle.includes("w")) {
        const nextX = Math.min(currentDrag.startRect.x + currentDrag.startRect.width - minSize, Math.max(0, currentDrag.startRect.x + dx));
        width = currentDrag.startRect.width + (currentDrag.startRect.x - nextX);
        x = nextX;
      }
      if (currentDrag.handle.includes("n")) {
        const nextY = Math.min(currentDrag.startRect.y + currentDrag.startRect.height - minSize, Math.max(0, currentDrag.startRect.y + dy));
        height = currentDrag.startRect.height + (currentDrag.startRect.y - nextY);
        y = nextY;
      }
      if (currentDrag.handle === "move") {
        x = Math.min(1 - width, Math.max(0, currentDrag.startRect.x + dx));
        y = Math.min(1 - height, Math.max(0, currentDrag.startRect.y + dy));
      }

      setCropRect({ x, y, width, height });
    };

    const onPointerUp = () => {
      cropDragRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const saveCrop = async () => {
    if (!library || !selectedAsset || !selectedAssetDimensions || !hasDesktopBridge) {
      return;
    }

    setSavingCrop(true);
    try {
      const nextLibrary = await getBridge().saveCropAsset(library.rootPath, selectedAsset.absolutePath, {
        x: Math.round(cropRect.x * selectedAssetDimensions.width),
        y: Math.round(cropRect.y * selectedAssetDimensions.height),
        width: Math.round(cropRect.width * selectedAssetDimensions.width),
        height: Math.round(cropRect.height * selectedAssetDimensions.height)
      });
      loadLibrary(nextLibrary);
      setViewer({ boardId: selectedBoard!.id, assetId: selectedAsset.id });
      setStatusMessage(`Saved crop for ${selectedAsset.name}.`);
      setCropMode(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save crop.";
      setErrorMessage(message);
    } finally {
      setSavingCrop(false);
    }
  };

  const performDeleteSelected = async () => {
    if (!library || selectedAssets.length === 0 || !hasDesktopBridge) {
      return;
    }

    setIsMutatingAssets(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const deletedIds = selectedAssets.map((asset) => asset.id);
      const nextLibrary = await getBridge().deleteAssets(
        library.rootPath,
        selectedAssets.map((asset) => asset.absolutePath)
      );
      loadLibrary(nextLibrary, { preserveCaches: true });
      evictAssetsFromCaches(deletedIds);
      setStatusMessage(`Deleted ${selectedAssets.length} image${selectedAssets.length === 1 ? "" : "s"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete the selected images.";
      setErrorMessage(message);
    } finally {
      setIsMutatingAssets(false);
    }
  };

  const handleBoardDrop = async (event: DragEvent, targetBoardId: string) => {
    event.preventDefault();
    setDragTargetBoardId(null);

    if (!library || !hasDesktopBridge || targetBoardId === "__starred__") {
      return;
    }

    const internalData = event.dataTransfer.getData(INTERNAL_DRAG_MIME);
    if (internalData) {
      if (targetBoardId === selectedBoard?.id) {
        return;
      }
      const assetPaths = JSON.parse(internalData) as string[];
      const nextLibrary = await getBridge().moveAssets(library.rootPath, targetBoardId, assetPaths);
      loadLibrary(nextLibrary);
      return;
    }

    const droppedPaths = extractDroppedFilePaths(event);
    if (droppedPaths.length === 0) {
      return;
    }

    const nextLibrary = await getBridge().importAssets(library.rootPath, targetBoardId, droppedPaths);
    loadLibrary(nextLibrary);
  };

  const handleAssetDragStart = (event: DragEvent, asset: Asset) => {
    const draggedAssets = getDraggedAssetPaths(selectionMode, selectedAssetIds, selectedAssets, asset);

    event.dataTransfer.setData(INTERNAL_DRAG_MIME, JSON.stringify(draggedAssets));
    event.dataTransfer.effectAllowed = "copyMove";
  };

  const renderMiniBoardItem = (board: Board) => {
    const coverAssets = getBoardCoverAssets(board);
    const src = coverAssets.length > 0 ? (assetPreviewSrcs[coverAssets[0].id] ?? boardPreviewSrcs[board.id]) : null;
    return (
      <button
        key={board.id}
        className={`mini-board-item ${selectedBoard?.id === board.id ? "selected" : ""}`}
        onClick={() => setSelectedBoardId(board.id)}
      >
        <span className="mini-board-row">
          <span className="mini-board-cover">
            {src ? <img src={src} alt="" /> : null}
          </span>
          <span className="mini-board-title">{board.title}</span>
        </span>
      </button>
    );
  };

  const renderBoardCard = (board: Board, compact = false) => {
    const childCount = library?.boards.filter((candidate) => getParentBoardId(candidate.id) === board.id).length ?? 0;
    const countParts = buildBoardCountParts(board.imageCount, childCount);
    const coverAssets = getBoardCoverAssets(board);

    return (
      <button
        key={board.id}
        className={`board-tile board-tile-album ${selectedBoard?.id === board.id ? "selected" : ""} ${dragTargetBoardId === board.id ? "drop-target" : ""} ${
          compact ? "board-tile-compact" : ""
        }`}
        onClick={() => setSelectedBoardId(board.id)}
        onDragOver={(event) => {
          if (board.synthetic || board.id === selectedBoard?.id) {
            return;
          }
          event.preventDefault();
          setDragTargetBoardId(board.id);
        }}
        onDragLeave={() => setDragTargetBoardId((current) => (current === board.id ? null : current))}
        onDrop={(event) => void handleBoardDrop(event, board.id)}
      >
        <span className={`board-cover-collage board-cover-count-${Math.min(Math.max(coverAssets.length, 1), 3)}`}>
          {coverAssets.map((asset, index) => {
            const src = assetPreviewSrcs[asset.id] ?? boardPreviewSrcs[board.id];

            return (
              <span key={`${board.id}-${asset.id}`} className={`board-cover-slot board-cover-slot-${index + 1}`}>
                {src ? <img src={src} alt="" /> : null}
              </span>
            );
          })}
          {coverAssets.length === 0 ? <span className="board-cover-empty" /> : null}
        </span>
        <span className="board-copy board-copy-below">
          <strong>{board.title}</strong>
          {countParts.length > 0 ? <small>{countParts.join(" · ")}</small> : null}
        </span>
      </button>
    );
  };

  if (!library) {
    return (
      <>
        {isInitialLoading ? (
          <div className="loading-overlay">
            <div className="loading-overlay-inner">
              <h1 className="loading-overlay-title">Moss.</h1>
              <div className="spinner" />
            </div>
          </div>
        ) : null}
        <main className="empty-shell">
          <div className="empty-glow empty-glow-left" />
          <div className="empty-glow empty-glow-right" />
          <section className="empty-card">
            <p className="eyebrow">Moss</p>
            <h1>Your offline visual library.</h1>
            <p className="lede">Browse folders like moodboards, keep everything local, and move images around without leaving the filesystem.</p>
            <div className="welcome-actions">
              <button className="primary-button" onClick={() => void pickFolder()} disabled={isPicking}>
                {isPicking ? "Opening…" : "Choose Folder"}
              </button>
              <button className="ghost-button" onClick={() => void openFolderPath(devDefaultFolder)}>
                Open Moodboards
              </button>
            </div>
            <div className="path-entry">
              <input
                className="path-input"
                value={manualFolderPath}
                onChange={(event) => setManualFolderPath(event.target.value)}
                placeholder="/path/to/your/moodboards"
              />
              <button className="ghost-button" onClick={() => void openCurrentPathInput()}>
                Open Path
              </button>
            </div>
            {appState.recentVaults.length > 0 ? (
              <div className="recent-vaults">
                <p className="recent-title">Recent folders</p>
                <div className="recent-list">
                  {appState.recentVaults.map((rootPath) => (
                    <button key={rootPath} className="recent-chip" onClick={() => void openFolderPath(rootPath)}>
                      {rootPath}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}
          </section>
        </main>
      </>
    );
  }

  return (
    <>
    {boardInitialLoading ? (
      <div className="loading-overlay">
        <div className="loading-overlay-inner">
          <h1 className="loading-overlay-title">Moss.</h1>
          <div className="spinner" />
        </div>
      </div>
    ) : null}
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-top">
              <h1>Moss.</h1>
            </div>

            <nav className="board-list">
              {rootBoards.map((board) => renderBoardCard(board))}
              <button className="board-tile board-tile-template" onClick={() => openCreateAlbumDialog(null)} aria-label="New album">
                <span className="board-cover-template">+</span>
                <span className="board-copy board-copy-below">
                  <strong>New album</strong>
                </span>
              </button>
            </nav>
          </>
        )}

        <div className="sidebar-footer">
          <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
            ⚙
          </button>
          <button
            className="settings-button sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        {sidebarCollapsed && (
          <div className="sidebar-peek">
            <div className="sidebar-peek-head">
              <span className="sidebar-peek-title">Moss.</span>
            </div>
            <nav className="sidebar-peek-list">
              {rootBoards.map(renderMiniBoardItem)}
              <button className="mini-board-item mini-board-new" onClick={() => openCreateAlbumDialog(null)}>
                <span className="mini-board-cover mini-board-cover-new">+</span>
                <span className="mini-board-title">New album</span>
              </button>
            </nav>
          </div>
        )}
      </aside>

      <section
        className="canvas"
        onDragOver={(event) => {
          if (selectedBoard && !event.dataTransfer.types.includes(INTERNAL_DRAG_MIME)) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          if (selectedBoard) {
            void handleBoardDrop(event, selectedBoard.id);
          }
        }}
      >
        {selectedBoard ? (
          <>
            <header className="board-header">
              <div className="board-title-wrap">
                <div className="board-title-row">
                  <h2>{selectedBoard.title}</h2>
                  {!selectedBoard.synthetic && !selectionMode ? (
                    <div className={`board-title-actions ${albumInfoOpen ? "info-open" : ""}`}>
                      <button
                        className="title-icon-button"
                        onClick={() => openRenameAlbumDialog(selectedBoard)}
                        aria-label="Rename album"
                        title="Rename album"
                      >
                        ✎
                      </button>
                      <button
                        className="title-icon-button"
                        onClick={() => openCreateAlbumDialog(selectedBoard.id)}
                        aria-label="New sub album"
                        title="New sub album"
                      >
                        +
                      </button>
                      <div className="album-info-wrap">
                        <button
                          className={`title-icon-button ${albumInfoOpen ? "active" : ""}`}
                          onClick={() => setAlbumInfoOpen((current) => !current)}
                          aria-label="Album info"
                          title="Album info"
                        >
                          i
                        </button>
                        {albumInfoOpen ? (
                          <div className="album-info-popover">
                            <dl>
                              <div><dt>Images</dt><dd>{selectedBoard.imageCount}</dd></div>
                              {childBoards.length > 0 ? (
                                <div><dt>Sub-albums</dt><dd>{childBoards.length}</dd></div>
                              ) : null}
                              <div><dt>Total size</dt><dd>{formatBytes(albumTotalSize)}</dd></div>
                              <div><dt>Path</dt><dd>{selectedBoard.relativePath}</dd></div>
                            </dl>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {selectionMode ? (
                <div className="board-actions">
                  <button className="ghost-button active-toggle" onClick={toggleSelectionMode}>
                    Done
                  </button>
                </div>
              ) : null}
            </header>

            {selectionMode ? (
              <section className="selection-bar">
                <span>{selectedAssetIds.length} selected</span>
                <span className="selection-hint">Drag the selected images onto an album to move them.</span>
                <button
                  className="ghost-button danger-button"
                  onClick={() => void performDeleteSelected()}
                  disabled={selectedAssetIds.length === 0 || isMutatingAssets}
                >
                  {isMutatingAssets ? "Working…" : "Delete"}
                </button>
              </section>
            ) : null}

            {statusMessage ? <p className="status-copy">{statusMessage}</p> : null}
            {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}

            {!selectedBoard.synthetic && childBoards.length > 0 ? (
              <section className="child-board-section">
                <div className="child-board-grid">{childBoards.map((board) => renderBoardCard(board, true))}</div>
              </section>
            ) : null}

            <div className="masonry-grid">
              {selectedBoard.assets.map((asset) => {
                const isSelected = selectedAssetIds.includes(asset.id);

                return (
                  <div
                    key={asset.id}
                    className={`asset-card ${isSelected ? "selected" : ""}`}
                    data-asset-id={asset.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openAsset(asset.id)}
                    onKeyDown={(event) => handleAssetCardKeyDown(event, asset.id)}
                    onPointerDown={(event) => startLongPress(event, asset)}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    draggable
                    onDragStart={(event) => handleAssetDragStart(event, asset)}
                  >
                    {!assetPreviewLoaded[asset.id] ? (
                      <div className="asset-loading">
                        <div className="spinner spinner-small" />
                      </div>
                    ) : null}
                    {visibleAssetIds.includes(asset.id) && assetPreviewSrcs[asset.id] ? (
                      <img
                        className={assetPreviewLoaded[asset.id] ? "" : "asset-image-loading"}
                        src={assetPreviewSrcs[asset.id]}
                        alt={asset.name}
                        loading="lazy"
                        onLoad={() =>
                          setAssetPreviewLoaded((current) => ({
                            ...current,
                            [asset.id]: true
                          }))
                        }
                        onError={() =>
                          setAssetPreviewLoaded((current) => ({
                            ...current,
                            [asset.id]: true
                          }))
                        }
                      />
                    ) : null}
                    <button
                      className={`asset-star-button ${asset.starred ? "starred" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleStarAsset(asset);
                      }}
                      aria-label={asset.starred ? "Unstar image" : "Star image"}
                    >
                      ★
                    </button>
                    <button
                      className={`asset-select-button ${selectionMode && isSelected ? "selected" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (selectionMode) {
                          toggleAssetSelection(asset.id);
                        } else {
                          enterSelectionModeForAsset(asset.id);
                        }
                      }}
                      aria-label={selectionMode && isSelected ? "Deselect image" : "Select image"}
                    >
                      {selectionMode && isSelected ? "✓" : "◯"}
                    </button>
                    <span className="asset-sheen" />
                    {asset.notes ? (
                      <div className="asset-note-overlay">
                        <p className="asset-note-text">{asset.notes}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-board">No folders with images yet.</div>
        )}
      </section>

      {selectedAsset && selectedBoard ? (
        <div className="viewer-backdrop" onClick={() => setViewer(null)}>
          <div className="viewer-shell" onClick={(event) => event.stopPropagation()}>
            <button className="viewer-nav viewer-nav-left" onClick={() => stepViewer(-1)}>
              ‹
            </button>
            <div className="viewer-image-wrap" onClick={(e) => e.stopPropagation()}>
              {viewerImageLoading && !viewerImageSrc && assetPreviewSrcs[selectedAsset.id] ? (
                <img
                  className="viewer-image"
                  src={assetPreviewSrcs[selectedAsset.id]}
                  alt={selectedAsset.name}
                />
              ) : null}
              {viewerImageSrc ? (
                <img
                  className="viewer-image"
                  src={viewerImageSrc}
                  alt={selectedAsset.name}
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (!naturalWidth || !naturalHeight) {
                      return;
                    }

                    setViewerImageLoading(false);
                    setCropFrameSize({
                      width: Math.max(event.currentTarget.clientWidth, 1),
                      height: Math.max(event.currentTarget.clientHeight, 1)
                    });
                    setAssetDimensions((current) => ({
                      ...current,
                      [selectedAsset.id]: { width: naturalWidth, height: naturalHeight }
                    }));
                  }}
                  onError={() => setViewerImageLoading(false)}
                />
              ) : null}
              {viewerImageLoading ? (
                <div className="viewer-load-indicator">
                  <div className="spinner spinner-small" />
                </div>
              ) : null}
              <textarea
                className="viewer-note-input"
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={() => void saveNote(selectedAsset, noteText)}
              />
            </div>
            <button className="viewer-nav viewer-nav-right" onClick={() => stepViewer(1)}>
              ›
            </button>

            <div className="viewer-toolbar">
              <button className={`icon-button ${cropMode ? "active" : ""}`} onClick={() => setCropMode((current) => !current)} aria-label="Crop">
                ⛶
              </button>
              <button className={`icon-button ${showInfo ? "active" : ""}`} onClick={() => void updateShowInfo(!showInfo)}>
                i
              </button>
              <button
                className="icon-button viewer-delete-button"
                onClick={() => void performDeleteSingle(selectedAsset.id)}
                disabled={isMutatingAssets}
                aria-label="Delete image"
                title="Delete image"
              >
                <img src={trashIcon} alt="" style={{ width: 18, height: 18, filter: "invert(1)" }} />
              </button>
              <button className="icon-button" onClick={() => setViewer(null)}>
                ×
              </button>
            </div>

            {cropMode && selectedAssetDimensions ? (
              <div className="crop-toolbar">
                <button className="ghost-button" onClick={() => setCropMode(false)}>
                  Cancel
                </button>
                <button className="primary-button" onClick={() => void saveCrop()} disabled={savingCrop}>
                  {savingCrop ? "Saving…" : "Save Crop"}
                </button>
              </div>
            ) : null}

            {cropMode && !viewerImageLoading ? (
              <div className="crop-overlay">
                <div
                  className="crop-rect"
                  style={{
                    left: `calc(50% - ${cropFrameSize.width / 2}px + ${cropRect.x * cropFrameSize.width}px)`,
                    top: `calc(50% - ${cropFrameSize.height / 2}px + ${cropRect.y * cropFrameSize.height}px)`,
                    width: `${cropRect.width * cropFrameSize.width}px`,
                    height: `${cropRect.height * cropFrameSize.height}px`
                  }}
                >
                  <div className="crop-move" onPointerDown={(event) => startCropInteraction("move", event)} />
                  {(["n", "s", "e", "w", "nw", "ne", "sw", "se"] as CropHandle[]).map((handle) => (
                    <button
                      key={handle}
                      className={`crop-handle crop-handle-${handle}`}
                      onPointerDown={(event) => startCropInteraction(handle, event)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {showInfo ? (
              <aside className="info-panel">
                <p className="eyebrow">Details</p>
                <h3>{selectedAsset.name}</h3>
                <dl>
                  <div>
                    <dt>Folder</dt>
                    <dd>{selectedBoard.title}</dd>
                  </div>
                  <div>
                    <dt>Path</dt>
                    <dd>{selectedAsset.relativePath}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(selectedAsset.size)}</dd>
                  </div>
                  <div>
                    <dt>Modified</dt>
                    <dd>{formatDate(selectedAsset.modifiedAt)}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{selectedAssetDimensions ? `${selectedAssetDimensions.width} × ${selectedAssetDimensions.height}` : "Loading…"}</dd>
                  </div>
                </dl>
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="settings-head">
              <h3>Settings</h3>
              <button className="icon-button" onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </div>
            <p className="subtle">Choose the folder Moss should use for your moodboards.</p>
            <div className="settings-theme-row">
              <button className={`theme-chip ${theme === "dark" ? "active" : ""}`} onClick={() => void updateTheme("dark")}>
                Dark
              </button>
              <button className={`theme-chip ${theme === "light" ? "active" : ""}`} onClick={() => void updateTheme("light")}>
                Light
              </button>
            </div>
            <div className="path-entry">
              <input
                className="path-input"
                value={manualFolderPath}
                onChange={(event) => setManualFolderPath(event.target.value)}
                placeholder="/path/to/your/moodboards"
              />
              <button className="ghost-button" onClick={() => void openCurrentPathInput()}>
                Open Path
              </button>
            </div>
            <div className="settings-actions">
              <button className="primary-button" onClick={() => void pickFolder()} disabled={isPicking}>
                {isPicking ? "Opening…" : "Choose Folder"}
              </button>
            </div>
            {appState.recentVaults.length > 0 ? (
              <div className="recent-vaults">
                <p className="recent-title">Recent folders</p>
                <div className="recent-list">
                  {appState.recentVaults.map((rootPath) => (
                    <button key={rootPath} className="recent-chip" onClick={() => void openFolderPath(rootPath)}>
                      {rootPath}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}
          </section>
        </div>
      ) : null}

      {albumDialog ? (
        <div className="settings-backdrop" onClick={closeAlbumDialog}>
          <section className="settings-modal album-modal" onClick={(event) => event.stopPropagation()}>
            <div className="settings-head">
              <h3>{albumDialog.title}</h3>
              <button className="icon-button" onClick={closeAlbumDialog} disabled={isSavingAlbum}>
                ×
              </button>
            </div>
            <p className="subtle">
              {albumDialog.mode === "create"
                ? "Moss will create the folder for you and keep it in sync."
                : "Moss will rename the folder and keep the library in sync."}
            </p>
            <div className="path-entry">
              <input
                className="path-input"
                value={albumNameInput}
                onChange={(event) => setAlbumNameInput(event.target.value)}
                placeholder="Album name"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitAlbumDialog();
                  }
                }}
              />
            </div>
            <div className="settings-actions">
              <button className="ghost-button" onClick={closeAlbumDialog} disabled={isSavingAlbum}>
                Cancel
              </button>
              <button className="primary-button" onClick={() => void submitAlbumDialog()} disabled={isSavingAlbum}>
                {isSavingAlbum ? "Saving…" : albumDialog.buttonLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {assetActionMenu && selectedBoard ? (
        <div className="asset-action-menu" style={{ left: assetActionMenu.x, top: assetActionMenu.y }}>
          <button className="ghost-button danger-button" onClick={() => void performDeleteSingle(assetActionMenu.assetId)}>
            Delete
          </button>
          <select defaultValue="" onChange={(event) => void performMoveSingle(assetActionMenu.assetId, event.target.value)}>
            <option value="">Move to…</option>
            {moveTargets.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </main>
    {albumInfoOpen ? <div className="album-info-backdrop" onClick={() => setAlbumInfoOpen(false)} /> : null}
    </>
  );
}

export default App;
