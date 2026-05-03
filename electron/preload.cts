const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moss", {
  pickVault: () => ipcRenderer.invoke("vault:pick"),
  loadVault: (rootPath: string) => ipcRenderer.invoke("vault:load", rootPath),
  setTheme: (mode: "light" | "dark" | "system") => ipcRenderer.invoke("theme:set", mode),
  persistTheme: (rootPath: string, mode: "light" | "dark" | "system") =>
    ipcRenderer.invoke("theme:persist", rootPath, mode),
  getDevVaultPath: () => ipcRenderer.invoke("dev:vault-path"),
  getAppState: () => ipcRenderer.invoke("app:state"),
  loadOriginalAsset: (assetPath: string) => ipcRenderer.invoke("asset:load-original", assetPath),
  loadPreviewAsset: (assetPath: string, relativePath: string, modifiedAt: string, size: number) =>
    ipcRenderer.invoke("asset:load-preview", assetPath, relativePath, modifiedAt, size),
  toggleStarAsset: (rootPath: string, relativePath: string) => ipcRenderer.invoke("asset:toggle-star", rootPath, relativePath),
  saveCropAsset: (rootPath: string, assetPath: string, cropRect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke("asset:save-crop", rootPath, assetPath, cropRect),
  importAssets: (rootPath: string, boardId: string, sourcePaths: string[]) =>
    ipcRenderer.invoke("assets:import", rootPath, boardId, sourcePaths),
  moveAssets: (rootPath: string, boardId: string, sourcePaths: string[]) =>
    ipcRenderer.invoke("assets:move", rootPath, boardId, sourcePaths),
  deleteAssets: (rootPath: string, sourcePaths: string[]) =>
    ipcRenderer.invoke("assets:delete", rootPath, sourcePaths),
  startAssetDrag: (assetPath: string) => ipcRenderer.send("asset:start-drag", assetPath)
});
