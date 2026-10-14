export const getScanBox = (viewfinderWidth, viewfinderHeight, scanMode) => {
  if (scanMode === 'id') {
    const width = Math.min(500, Math.floor(viewfinderWidth * 0.9));
    const height = Math.min(Math.floor(viewfinderHeight * 0.65), Math.max(70, Math.floor(width * 0.3)));
    return { width, height };
  }
  const size = Math.min(250, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75));
  return { width: size, height: size };
};
