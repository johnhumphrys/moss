export const formatBytes = (size: number) => {
  if (size === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
