const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moss", {
  createVault: () => ipcRenderer.invoke("vault:create"),
  pickVault: () => ipcRenderer.invoke("vault:pick"),
  loadVault: (rootPath: string) => ipcRenderer.invoke("vault:load", rootPath),
  setTheme: (mode: "light" | "dark" | "system") => ipcRenderer.invoke("theme:set", mode),
  persistTheme: (rootPath: string, mode: "light" | "dark" | "system") =>
    ipcRenderer.invoke("theme:persist", rootPath, mode),
  persistViewerInfo: (rootPath: string, isOpen: boolean) => ipcRenderer.invoke("viewer-info:persist", rootPath, isOpen),

  getAppState: () => ipcRenderer.invoke("app:state"),
  loadOriginalAsset: (assetPath: string) => ipcRenderer.invoke("asset:load-original", assetPath),
  loadPreviewAsset: (assetPath: string, relativePath: string, modifiedAt: string, size: number) =>
    ipcRenderer.invoke("asset:load-preview", assetPath, relativePath, modifiedAt, size),
  toggleStarAsset: (rootPath: string, relativePath: string) => ipcRenderer.invoke("asset:toggle-star", rootPath, relativePath),
  saveCropAsset: (rootPath: string, assetPath: string, cropRect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke("asset:save-crop", rootPath, assetPath, cropRect),
  createBoard: (rootPath: string, parentBoardId: string | null, name: string) =>
    ipcRenderer.invoke("board:create", rootPath, parentBoardId, name),
  renameBoard: (rootPath: string, boardId: string, name: string) =>
    ipcRenderer.invoke("board:rename", rootPath, boardId, name),
  importAssets: (rootPath: string, boardId: string, sourcePaths: string[]) =>
    ipcRenderer.invoke("assets:import", rootPath, boardId, sourcePaths),
  moveAssets: (rootPath: string, boardId: string, sourcePaths: string[]) =>
    ipcRenderer.invoke("assets:move", rootPath, boardId, sourcePaths),
  deleteAssets: (rootPath: string, sourcePaths: string[]) =>
    ipcRenderer.invoke("assets:delete", rootPath, sourcePaths),
  setAssetNote: (rootPath: string, relativePath: string, note: string) =>
    ipcRenderer.invoke("asset:set-note", rootPath, relativePath, note),
  completeOnboarding: () => ipcRenderer.invoke("vault:complete-onboarding"),
  startAssetDrag: (assetPath: string) => ipcRenderer.send("asset:start-drag", assetPath)
});
