/** Desplazamiento horizontal mínimo (px) para contar como deslizamiento. */
export const SWIPE_MIN_DISTANCE = 60;

/**
 * Dirección de un gesto: `1` = siguiente (se desliza hacia la izquierda),
 * `-1` = anterior, `0` = no es un deslizamiento horizontal claro (un toque o
 * un desplazamiento vertical).
 */
export function swipeDirection(dx: number, dy: number): 1 | -1 | 0 {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return 0;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

/** Rueda o trackpad: solo cuenta el movimiento horizontal dominante. */
export function wheelDirection(deltaX: number, deltaY: number): 1 | -1 | 0 {
  if (Math.abs(deltaX) < 30 || Math.abs(deltaX) < Math.abs(deltaY)) return 0;
  return deltaX > 0 ? 1 : -1;
}
