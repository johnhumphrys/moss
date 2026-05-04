/// <reference types="vite/client" />

type ThemeMode = "light" | "dark" | "system";

type Asset = {
  id: string;
  name: string;
  absolutePath: string;
  relativePath: string;
  starred?: boolean;
  thumbnailPath?: string;
  size: number;
  modifiedAt: string;
  width?: number;
  height?: number;
};

type Board = {
  id: string;
  title: string;
  relativePath: string;
  folderName: string;
  synthetic?: boolean;
  imageCount: number;
  assets: Asset[];
  previewAsset?: Asset;
};

type VaultData = {
  rootPath: string;
  title: string;
  theme: ThemeMode;
  viewerInfoOpen: boolean;
  boards: Board[];
};

type BoardMutationResult = {
  vault: VaultData;
  boardId: string;
};

type AppState = {
  recentVaults: string[];
  lastVaultPath?: string;
};

type AssetPayload = {
  dataUrl: string;
  width?: number;
  height?: number;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface Window {
  moss: {
    pickVault: () => Promise<VaultData | null>;
    loadVault: (rootPath: string) => Promise<VaultData>;
    setTheme: (mode: ThemeMode) => Promise<"light" | "dark">;
    persistTheme: (rootPath: string, mode: ThemeMode) => Promise<unknown>;
    persistViewerInfo: (rootPath: string, isOpen: boolean) => Promise<unknown>;
    getDevVaultPath: () => Promise<string | null>;
    getAppState: () => Promise<AppState>;
    loadOriginalAsset: (assetPath: string) => Promise<AssetPayload>;
    loadPreviewAsset: (
      assetPath: string,
      relativePath: string,
      modifiedAt: string,
      size: number
    ) => Promise<AssetPayload>;
    toggleStarAsset: (rootPath: string, relativePath: string) => Promise<VaultData>;
    saveCropAsset: (rootPath: string, assetPath: string, cropRect: CropRect) => Promise<VaultData>;
    createBoard: (rootPath: string, parentBoardId: string | null, name: string) => Promise<BoardMutationResult>;
    renameBoard: (rootPath: string, boardId: string, name: string) => Promise<BoardMutationResult>;
    importAssets: (rootPath: string, boardId: string, sourcePaths: string[]) => Promise<VaultData>;
    moveAssets: (rootPath: string, boardId: string, sourcePaths: string[]) => Promise<VaultData>;
    deleteAssets: (rootPath: string, sourcePaths: string[]) => Promise<VaultData>;
    startAssetDrag: (assetPath: string) => void;
  };
}
