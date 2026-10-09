export const MAX_ZOOM = 512;
export const FULL_VIEW = Object.freeze({x: 0, y: 0, width: 1, height: 1});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Coordinates are fractions of the full time/value domains; y increases upward.
export function zoomViewport(view, factor, anchorX = .5, anchorY = .5) {
  const width = clamp(view.width / factor, Math.min(view.width, 1 / MAX_ZOOM), 1);
  const height = clamp(view.height / factor, Math.min(view.height, 1 / MAX_ZOOM), 1);
  return {
    x: clamp(view.x + clamp(anchorX, 0, 1) * (view.width - width), 0, 1 - width),
    y: clamp(view.y + clamp(anchorY, 0, 1) * (view.height - height), 0, 1 - height),
    width,
    height,
  };
}

// Deltas are fractions of the visible plot, so panning stays consistent at any zoom.
export function panViewport(view, deltaX, deltaY) {
  return {
    ...view,
    x: clamp(view.x + deltaX * view.width, 0, 1 - view.width),
    y: clamp(view.y + deltaY * view.height, 0, 1 - view.height),
  };
}
