export const createLibrary = (): VaultData => ({
  rootPath: "/Moodboards",
  title: "Moodboards",
  theme: "dark",
  viewerInfoOpen: false,
  boards: [
    {
      id: "cycling",
      title: "Cycling",
      relativePath: "cycling",
      folderName: "cycling",
      imageCount: 1,
      assets: [
        {
          id: "cycling/one.jpg",
          name: "one.jpg",
          absolutePath: "/Moodboards/cycling/one.jpg",
          relativePath: "cycling/one.jpg",
          size: 1200,
          modifiedAt: "2026-05-04T10:00:00.000Z",
          thumbnailPath: "/Moodboards/cycling/one-thumb.jpg"
        }
      ],
      previewAsset: {
        id: "cycling/one.jpg",
        name: "one.jpg",
        absolutePath: "/Moodboards/cycling/one.jpg",
        relativePath: "cycling/one.jpg",
        size: 1200,
        modifiedAt: "2026-05-04T10:00:00.000Z",
        thumbnailPath: "/Moodboards/cycling/one-thumb.jpg"
      }
    },
    {
      id: "running",
      title: "Running",
      relativePath: "running",
      folderName: "running",
      imageCount: 1,
      assets: [
        {
          id: "running/two.jpg",
          name: "two.jpg",
          absolutePath: "/Moodboards/running/two.jpg",
          relativePath: "running/two.jpg",
          size: 1500,
          modifiedAt: "2026-05-04T10:00:00.000Z",
          thumbnailPath: "/Moodboards/running/two-thumb.jpg"
        }
      ],
      previewAsset: {
        id: "running/two.jpg",
        name: "two.jpg",
        absolutePath: "/Moodboards/running/two.jpg",
        relativePath: "running/two.jpg",
        size: 1500,
        modifiedAt: "2026-05-04T10:00:00.000Z",
        thumbnailPath: "/Moodboards/running/two-thumb.jpg"
      }
    }
  ]
});

export const createAppState = (): AppState => ({
  recentVaults: ["/Moodboards"],
  lastVaultPath: "/Moodboards"
});
