import {
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { swipeDirection, wheelDirection } from "@/lib/swipe";

const WHEEL_COOLDOWN_MS = 500;

/**
 * Cambiar de mes o semana deslizando con el dedo, arrastrando con el ratón o
 * con la rueda/trackpad en horizontal. Devuelve las propiedades para el
 * contenedor; el desplazamiento vertical sigue funcionando.
 */
export function useSwipeNav(onStep: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const lastWheel = useRef(0);

  return {
    style: { touchAction: "pan-y" } satisfies CSSProperties,
    onPointerDown(event: PointerEvent) {
      swiped.current = false;
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp(event: PointerEvent) {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      const direction = swipeDirection(event.clientX - origin.x, event.clientY - origin.y);
      if (direction !== 0) {
        swiped.current = true;
        onStep(direction);
      }
    },
    onPointerCancel() {
      start.current = null;
    },
    // Tras un arrastre no debe contar como pulsar el día sobre el que se soltó.
    onClickCapture(event: MouseEvent) {
      if (swiped.current) {
        swiped.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onWheel(event: WheelEvent) {
      const direction = wheelDirection(event.deltaX, event.deltaY);
      const now = Date.now();
      if (direction === 0 || now - lastWheel.current < WHEEL_COOLDOWN_MS) return;
      lastWheel.current = now;
      onStep(direction);
    },
  };
}
