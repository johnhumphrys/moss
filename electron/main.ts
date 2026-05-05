import { app, BrowserWindow, dialog, ipcMain, nativeImage, nativeTheme } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ThemeMode = "light" | "dark" | "system";

type MossConfig = {
  version: number;
  title?: string;
  theme?: ThemeMode;
  viewerInfoOpen?: boolean;
  starredAssets?: string[];
  assetNotes?: Record<string, string>;
  boards?: Record<string, BoardConfig>;
};

type BoardConfig = {
  title?: string;
  cover?: string;
  notes?: string;
};

type BoardMutationResult = {
  vault: VaultData;
  boardId: string;
};

type Asset = {
  id: string;
  name: string;
  absolutePath: string;
  relativePath: string;
  starred?: boolean;
  notes?: string;
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

type AppSettings = {
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

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const CONFIG_FILENAME = ".moss";
const SETTINGS_FILENAME = "settings.json";
const DEV_DEFAULT_VAULT_PATH = "/Users/johnhumphrys/Documents/Moodboards";

let mainWindow: BrowserWindow | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1100,
    minHeight: 740,
    backgroundColor: "#141312",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererUrl = process.env.VITE_DEV_SERVER_URL;

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    void mainWindow?.webContents
      .executeJavaScript("typeof window.moss")
      .then((value) => console.log("[moss] window.moss type:", value))
      .catch((error) => console.error("[moss] bridge probe failed", error));
  });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILENAME);
}

function getThumbnailCacheDir() {
  return path.join(app.getPath("userData"), "thumbnails");
}

function getMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function boardIdToDirectory(rootPath: string, boardId: string) {
  return path.join(rootPath, ...boardId.split("/"));
}

function directoryToBoardId(rootPath: string, directoryPath: string) {
  return path.relative(rootPath, directoryPath).split(path.sep).join("/");
}

function isVisibleDirectoryName(name: string) {
  return !name.startsWith(".");
}

function isWithinRoot(rootPath: string, candidatePath: string) {
  const normalizedRoot = `${path.resolve(rootPath)}${path.sep}`;
  const normalizedCandidate = path.resolve(candidatePath);
  return normalizedCandidate === path.resolve(rootPath) || normalizedCandidate.startsWith(normalizedRoot);
}

async function readAppSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsPath();
  if (!(await fileExists(settingsPath))) {
    return { recentVaults: [] };
  }

  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      recentVaults: Array.isArray(parsed.recentVaults) ? parsed.recentVaults : [],
      lastVaultPath: parsed.lastVaultPath
    };
  } catch {
    return { recentVaults: [] };
  }
}

async function writeAppSettings(settings: AppSettings) {
  const settingsPath = getSettingsPath();
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

async function rememberVault(rootPath: string) {
  const currentSettings = await readAppSettings();
  const recentVaults = [rootPath, ...currentSettings.recentVaults.filter((vaultPath) => vaultPath !== rootPath)].slice(0, 8);

  await writeAppSettings({
    recentVaults,
    lastVaultPath: rootPath
  });
}

async function readConfig(rootPath: string): Promise<MossConfig> {
  const configPath = path.join(rootPath, CONFIG_FILENAME);
  if (!(await fileExists(configPath))) {
    return { version: 1, theme: "dark", viewerInfoOpen: false, boards: {} };
  }

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as MossConfig;
    return {
      version: parsed.version ?? 1,
      title: parsed.title,
      theme: parsed.theme ?? "dark",
      viewerInfoOpen: parsed.viewerInfoOpen ?? false,
      starredAssets: Array.isArray(parsed.starredAssets) ? parsed.starredAssets : [],
      assetNotes: parsed.assetNotes && typeof parsed.assetNotes === "object" ? parsed.assetNotes : {},
      boards: parsed.boards ?? {}
    };
  } catch {
    return { version: 1, theme: "dark", viewerInfoOpen: false, boards: {} };
  }
}

async function writeConfig(rootPath: string, config: MossConfig) {
  const configPath = path.join(rootPath, CONFIG_FILENAME);
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function normalizeAlbumDirectoryName(name: string) {
  return name
    .trim()
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ");
}

async function uniqueDirectoryPath(parentDirectory: string, folderName: string) {
  const normalizedName = normalizeAlbumDirectoryName(folderName);
  if (!normalizedName) {
    throw new Error("Album name cannot be empty.");
  }

  let counter = 0;

  while (true) {
    const candidateName = counter === 0 ? normalizedName : `${normalizedName} ${counter}`;
    const candidatePath = path.join(parentDirectory, candidateName);

    if (!(await fileExists(candidatePath))) {
      return candidatePath;
    }

    counter += 1;
  }
}

function rewriteBoardConfigPaths(
  boards: Record<string, BoardConfig> | undefined,
  fromBoardId: string,
  toBoardId: string
) {
  if (!boards) {
    return {};
  }

  const nextBoards: Record<string, BoardConfig> = {};

  for (const [boardId, boardConfig] of Object.entries(boards)) {
    if (boardId === fromBoardId || boardId.startsWith(`${fromBoardId}/`)) {
      const suffix = boardId.slice(fromBoardId.length);
      nextBoards[`${toBoardId}${suffix}`] = boardConfig;
    } else {
      nextBoards[boardId] = boardConfig;
    }
  }

  return nextBoards;
}

function rewriteStarredAssetPaths(starredAssets: string[] | undefined, fromBoardId: string, toBoardId: string) {
  return (starredAssets ?? []).map((relativePath) => {
    if (relativePath === fromBoardId || relativePath.startsWith(`${fromBoardId}/`)) {
      const suffix = relativePath.slice(fromBoardId.length);
      return `${toBoardId}${suffix}`;
    }

    return relativePath;
  });
}

async function loadAssetPayload(assetPath: string): Promise<AssetPayload> {
  const fileBuffer = await fs.readFile(assetPath);
  const image = nativeImage.createFromBuffer(fileBuffer);
  const size = image.isEmpty() ? undefined : image.getSize();

  return {
    dataUrl: `data:${getMimeType(assetPath)};base64,${fileBuffer.toString("base64")}`,
    width: size?.width,
    height: size?.height
  };
}

async function saveCroppedAsset(assetPath: string, cropRect: CropRect) {
  const fileBuffer = await fs.readFile(assetPath);
  const image = nativeImage.createFromBuffer(fileBuffer);
  if (image.isEmpty()) {
    throw new Error("Could not load image for cropping.");
  }

  const cropped = image.crop(cropRect);
  const extension = path.extname(assetPath).toLowerCase();
  const outputBuffer = extension === ".jpg" || extension === ".jpeg" ? cropped.toJPEG(92) : cropped.toPNG();
  await fs.writeFile(assetPath, outputBuffer);
}

async function ensureThumbnail(assetPath: string, relativePath: string, modifiedAt: string, size: number) {
  try {
    const thumbnailKey = createHash("sha1")
      .update(`${relativePath}:${modifiedAt}:${size}`)
      .digest("hex");
    const thumbnailDir = getThumbnailCacheDir();
    const thumbnailPath = path.join(thumbnailDir, `${thumbnailKey}.png`);

    if (await fileExists(thumbnailPath)) {
      return thumbnailPath;
    }

    await fs.mkdir(thumbnailDir, { recursive: true });
    const thumbnail = await nativeImage.createThumbnailFromPath(assetPath, {
      width: 640,
      height: 640
    });

    if (thumbnail.isEmpty()) {
      return undefined;
    }

    await fs.writeFile(thumbnailPath, thumbnail.toPNG());
    return thumbnailPath;
  } catch {
    return undefined;
  }
}

async function loadPreviewPayload(
  assetPath: string,
  relativePath: string,
  modifiedAt: string,
  size: number
): Promise<AssetPayload> {
  const thumbnailPath = await ensureThumbnail(assetPath, relativePath, modifiedAt, size);

  if (thumbnailPath) {
    const thumbnailBuffer = await fs.readFile(thumbnailPath);
    const image = nativeImage.createFromBuffer(thumbnailBuffer);
    const dimensions = image.isEmpty() ? undefined : image.getSize();

    return {
      dataUrl: `data:image/png;base64,${thumbnailBuffer.toString("base64")}`,
      width: dimensions?.width,
      height: dimensions?.height
    };
  }

  return loadAssetPayload(assetPath);
}

async function toAsset(rootPath: string, filePath: string): Promise<Asset> {
  const stats = await fs.stat(filePath);
  const relativePath = path.relative(rootPath, filePath);

  return {
    id: relativePath,
    name: path.basename(filePath),
    absolutePath: filePath,
    relativePath,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };
}

function sortAssetsWithStarredFirst(assets: Asset[]) {
  return [...assets].sort((left, right) => {
    if (Boolean(left.starred) !== Boolean(right.starred)) {
      return left.starred ? -1 : 1;
    }

    return left.relativePath.localeCompare(right.relativePath);
  });
}

async function collectDirectAssets(rootPath: string, directoryPath: string, starredAssets: Set<string>, assetNotes: Record<string, string>): Promise<Asset[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const assets = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(async (entry) => {
        const asset = await toAsset(rootPath, path.join(directoryPath, entry.name));
        return {
          ...asset,
          starred: starredAssets.has(asset.relativePath),
          notes: assetNotes[asset.relativePath] || undefined
        };
      })
  );

  return sortAssetsWithStarredFirst(assets);
}

async function collectTreeAssets(
  rootPath: string,
  directoryPath: string,
  starredAssets: Set<string>,
  assetNotes: Record<string, string>,
  cache: Map<string, Promise<Asset[]>>
): Promise<Asset[]> {
  const cached = cache.get(directoryPath);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const directAssets = await collectDirectAssets(rootPath, directoryPath, starredAssets, assetNotes);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const childDirectories = entries.filter((entry) => entry.isDirectory());
    const nestedAssets = await Promise.all(
      childDirectories.map((entry) => collectTreeAssets(rootPath, path.join(directoryPath, entry.name), starredAssets, assetNotes, cache))
    );

    return sortAssetsWithStarredFirst([...directAssets, ...nestedAssets.flat()]);
  })();

  cache.set(directoryPath, promise);
  return promise;
}

async function collectBoards(rootPath: string, config: MossConfig): Promise<Board[]> {
  const boards: Board[] = [];
  const treeCache = new Map<string, Promise<Asset[]>>();
  const starredAssets = new Set(config.starredAssets ?? []);
  const assetNotes = config.assetNotes ?? {};

  async function visitDirectory(directoryPath: string) {
    const relativePath = path.relative(rootPath, directoryPath);
    if (relativePath.startsWith(".git")) {
      return;
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const childDirectories = entries.filter((entry) => entry.isDirectory() && isVisibleDirectoryName(entry.name));

    for (const childDirectory of childDirectories) {
      await visitDirectory(path.join(directoryPath, childDirectory.name));
    }

    if (directoryPath === rootPath) {
      return;
    }

    const treeAssets = await collectTreeAssets(rootPath, directoryPath, starredAssets, assetNotes, treeCache);
    const directAssets = await collectDirectAssets(rootPath, directoryPath, starredAssets, assetNotes);
    const boardId = relativePath.split(path.sep).join("/");
    const boardConfig = config.boards?.[boardId];

    boards.push({
      id: boardId,
      title: boardConfig?.title || path.basename(directoryPath),
      relativePath: boardId,
      folderName: path.basename(directoryPath),
      imageCount: directAssets.length,
      assets: directAssets,
      previewAsset: treeAssets[0]
    });
  }

  await visitDirectory(rootPath);

  const starredBoardAssets = boards.flatMap((board) => board.assets).filter((asset) => asset.starred);
  if (starredBoardAssets.length > 0) {
    const starredAssetsSorted = sortAssetsWithStarredFirst(starredBoardAssets);
    boards.unshift({
      id: "__starred__",
      title: "Starred",
      relativePath: "__starred__",
      folderName: "Starred",
      synthetic: true,
      imageCount: starredAssetsSorted.length,
      assets: starredAssetsSorted,
      previewAsset: starredAssetsSorted[0]
    });
  }

  return boards.sort((left, right) => {
    if (left.synthetic !== right.synthetic) {
      return left.synthetic ? -1 : 1;
    }

    return left.relativePath.localeCompare(right.relativePath);
  });
}

async function scanVault(rootPath: string): Promise<VaultData> {
  const config = await readConfig(rootPath);
  const boards = await collectBoards(rootPath, config);

  return {
    rootPath,
    title: config.title || path.basename(rootPath),
    theme: config.theme ?? "dark",
    viewerInfoOpen: config.viewerInfoOpen ?? false,
    boards
  };
}

async function ensureDirectory(directoryPath: string) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function uniqueDestinationPath(directoryPath: string, fileName: string) {
  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);
  let counter = 0;

  while (true) {
    const candidateName = counter === 0 ? `${basename}${extension}` : `${basename} ${counter}${extension}`;
    const candidatePath = path.join(directoryPath, candidateName);

    if (!(await fileExists(candidatePath))) {
      return candidatePath;
    }

    counter += 1;
  }
}

async function moveFile(sourcePath: string, destinationPath: string) {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "EXDEV") {
      throw error;
    }

    await fs.copyFile(sourcePath, destinationPath);
    await fs.unlink(sourcePath);
  }
}

async function createBoard(rootPath: string, parentBoardId: string | null, name: string): Promise<BoardMutationResult> {
  const parentDirectory = parentBoardId ? boardIdToDirectory(rootPath, parentBoardId) : rootPath;
  await ensureDirectory(parentDirectory);
  const nextDirectory = await uniqueDirectoryPath(parentDirectory, name);
  await fs.mkdir(nextDirectory, { recursive: true });

  const boardId = directoryToBoardId(rootPath, nextDirectory);
  return {
    boardId,
    vault: await scanVault(rootPath)
  };
}

async function renameBoard(rootPath: string, boardId: string, nextName: string): Promise<BoardMutationResult> {
  const currentDirectory = boardIdToDirectory(rootPath, boardId);
  const stats = await fs.stat(currentDirectory);

  if (!stats.isDirectory()) {
    throw new Error("Album path must be a directory.");
  }

  const parentDirectory = path.dirname(currentDirectory);
  const normalizedName = normalizeAlbumDirectoryName(nextName);
  if (!normalizedName) {
    throw new Error("Album name cannot be empty.");
  }

  const targetDirectory = path.join(parentDirectory, normalizedName);
  if (path.resolve(targetDirectory) !== path.resolve(currentDirectory) && (await fileExists(targetDirectory))) {
    throw new Error("Another album with that name already exists.");
  }

  await fs.rename(currentDirectory, targetDirectory);

  const nextBoardId = directoryToBoardId(rootPath, targetDirectory);
  const config = await readConfig(rootPath);
  await writeConfig(rootPath, {
    ...config,
    version: config.version ?? 1,
    boards: rewriteBoardConfigPaths(config.boards, boardId, nextBoardId),
    starredAssets: rewriteStarredAssetPaths(config.starredAssets, boardId, nextBoardId)
  });

  return {
    boardId: nextBoardId,
    vault: await scanVault(rootPath)
  };
}

ipcMain.handle("vault:pick", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const rootPath = result.filePaths[0];
  const vault = await scanVault(rootPath);
  await rememberVault(rootPath);
  return vault;
});

ipcMain.handle("vault:load", async (_event, rootPath: string) => {
  const resolvedPath = path.resolve(rootPath);
  const stats = await fs.stat(resolvedPath);

  if (!stats.isDirectory()) {
    throw new Error("Folder path must be a directory.");
  }

  const vault = await scanVault(resolvedPath);
  await rememberVault(resolvedPath);
  return vault;
});

ipcMain.handle("theme:set", async (_event, mode: ThemeMode) => {
  nativeTheme.themeSource = mode;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

ipcMain.handle("theme:persist", async (_event, rootPath: string, mode: ThemeMode) => {
  const config = await readConfig(rootPath);
  const nextConfig: MossConfig = {
    ...config,
    version: config.version ?? 1,
    theme: mode
  };

  await writeConfig(rootPath, nextConfig);
  nativeTheme.themeSource = mode;
  return nextConfig;
});

ipcMain.handle("viewer-info:persist", async (_event, rootPath: string, isOpen: boolean) => {
  const config = await readConfig(rootPath);
  const nextConfig: MossConfig = {
    ...config,
    version: config.version ?? 1,
    viewerInfoOpen: isOpen
  };

  await writeConfig(rootPath, nextConfig);
  return nextConfig;
});

ipcMain.handle("asset:toggle-star", async (_event, rootPath: string, relativePath: string) => {
  const config = await readConfig(rootPath);
  const current = new Set(config.starredAssets ?? []);

  if (current.has(relativePath)) {
    current.delete(relativePath);
  } else {
    current.add(relativePath);
  }

  await writeConfig(rootPath, {
    ...config,
    version: config.version ?? 1,
    starredAssets: Array.from(current).sort()
  });

  return scanVault(rootPath);
});

ipcMain.handle("asset:set-note", async (_event, rootPath: string, relativePath: string, note: string) => {
  console.log("[moss] asset:set-note", relativePath, JSON.stringify(note));
  const config = await readConfig(rootPath);
  const nextNotes = { ...(config.assetNotes ?? {}) };

  if (note.trim()) {
    nextNotes[relativePath] = note;
  } else {
    delete nextNotes[relativePath];
  }

  await writeConfig(rootPath, { ...config, assetNotes: nextNotes });
  console.log("[moss] asset:set-note written, notes:", JSON.stringify(nextNotes));
  return scanVault(rootPath);
});

ipcMain.handle("dev:vault-path", async () => {
  if (await fileExists(DEV_DEFAULT_VAULT_PATH)) {
    return DEV_DEFAULT_VAULT_PATH;
  }

  return null;
});

ipcMain.handle("app:state", async () => readAppSettings());

ipcMain.handle("asset:load-original", async (_event, assetPath: string) => {
  return loadAssetPayload(assetPath);
});

ipcMain.handle(
  "asset:load-preview",
  async (_event, assetPath: string, relativePath: string, modifiedAt: string, size: number) => {
    return loadPreviewPayload(assetPath, relativePath, modifiedAt, size);
  }
);

ipcMain.handle("asset:save-crop", async (_event, rootPath: string, assetPath: string, cropRect: CropRect) => {
  await saveCroppedAsset(assetPath, cropRect);
  return scanVault(rootPath);
});

ipcMain.handle("assets:import", async (_event, rootPath: string, boardId: string, sourcePaths: string[]) => {
  const destinationDirectory = boardIdToDirectory(rootPath, boardId);
  await ensureDirectory(destinationDirectory);

  for (const sourcePath of sourcePaths) {
    const resolvedSourcePath = path.resolve(sourcePath);
    const destinationPath = await uniqueDestinationPath(destinationDirectory, path.basename(resolvedSourcePath));
    await fs.copyFile(resolvedSourcePath, destinationPath);
  }

  return scanVault(rootPath);
});

ipcMain.handle("assets:move", async (_event, rootPath: string, boardId: string, sourcePaths: string[]) => {
  const destinationDirectory = boardIdToDirectory(rootPath, boardId);
  await ensureDirectory(destinationDirectory);

  for (const sourcePath of sourcePaths) {
    const resolvedSourcePath = path.resolve(sourcePath);
    if (!isWithinRoot(rootPath, resolvedSourcePath)) {
      continue;
    }

    const destinationPath = await uniqueDestinationPath(destinationDirectory, path.basename(resolvedSourcePath));
    if (destinationPath === resolvedSourcePath) {
      continue;
    }
    await moveFile(resolvedSourcePath, destinationPath);
  }

  return scanVault(rootPath);
});

ipcMain.handle("assets:delete", async (_event, rootPath: string, sourcePaths: string[]) => {
  for (const sourcePath of sourcePaths) {
    const resolvedSourcePath = path.resolve(sourcePath);
    if (!isWithinRoot(rootPath, resolvedSourcePath)) {
      continue;
    }

    await fs.rm(resolvedSourcePath, { force: true });
  }

  return scanVault(rootPath);
});

ipcMain.handle("board:create", async (_event, rootPath: string, parentBoardId: string | null, name: string) => {
  return createBoard(rootPath, parentBoardId, name);
});

ipcMain.handle("board:rename", async (_event, rootPath: string, boardId: string, name: string) => {
  return renameBoard(rootPath, boardId, name);
});

ipcMain.on("asset:start-drag", (event, assetPath: string) => {
  try {
    const icon = nativeImage.createFromPath(assetPath);
    event.sender.startDrag({
      file: assetPath,
      icon: icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 96, height: 96 })
    });
  } catch {
    return;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
