import { createFileRoute, redirect } from "@tanstack/react-router";

/** Los hábitos viven ahora dentro de Productividad; se mantiene la ruta por enlaces antiguos. */
export const Route = createFileRoute("/habitos")({
  beforeLoad: () => {
    throw redirect({ to: "/productividad", search: { vista: "habitos" } });
  },
});
