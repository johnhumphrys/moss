type AlbumDialogState =
  | { mode: "create"; parentBoardId: string | null; title: string; buttonLabel: string }
  | { mode: "rename"; boardId: string; currentName: string; title: string; buttonLabel: string };

type BoardLike = {
  id: string;
  title: string;
  synthetic?: boolean;
};

export const buildCreateAlbumDialog = (parentBoardId: string | null): AlbumDialogState => ({
  mode: "create",
  parentBoardId,
  title: parentBoardId ? "New sub-album" : "New album",
  buttonLabel: "Create"
});

export const buildRenameAlbumDialog = (board: BoardLike): AlbumDialogState | null => {
  if (board.synthetic) {
    return null;
  }

  return {
    mode: "rename",
    boardId: board.id,
    currentName: board.title,
    title: "Rename album",
    buttonLabel: "Save"
  };
};

export const normalizeAlbumNameInput = (value: string) => value.trim();

export type { AlbumDialogState };
