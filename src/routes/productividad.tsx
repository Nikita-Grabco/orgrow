import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Chip } from "@/components/common/chip";
import { PageHeader } from "@/components/common/page-header";
import { GoalsView } from "@/components/goals/goals-view";
import { HabitsView } from "@/components/habits/habits-view";
import { Button } from "@/components/ui/button";
import { usePlanner } from "@/store/planner-store";

type Vista = "objetivos" | "habitos";

export const Route = createFileRoute("/productividad")({
  validateSearch: (search: Record<string, unknown>): { vista: Vista } => ({
    vista: search["vista"] === "habitos" ? "habitos" : "objetivos",
  }),
  head: () => ({
    meta: [
      { title: "Productividad — Orgrow" },
      {
        name: "description",
        content: "Tus objetivos a largo plazo y los hábitos que te acercan a ellos.",
      },
      { property: "og:title", content: "Productividad — Orgrow" },
      { property: "og:description", content: "Objetivos a largo plazo y hábitos diarios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductivityPage,
});

function ProductivityPage() {
  const { vista } = Route.useSearch();
  const navigate = useNavigate({ from: "/productividad" });
  const { openAddGoal, openAddHabit } = usePlanner();

  const select = (next: Vista) => void navigate({ search: { vista: next }, replace: true });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Productividad"
        title={vista === "objetivos" ? "Objetivos" : "Hábitos"}
        description={
          vista === "objetivos"
            ? "Metas a largo plazo, divididas en hitos que se completan con tus tareas y hábitos."
            : "Marca lo que has hecho hoy y mira cómo se va llenando tu calendario."
        }
        actions={
          vista === "objetivos" ? (
            <Button onClick={openAddGoal}>
              <Plus /> Nuevo objetivo
            </Button>
          ) : (
            <Button onClick={openAddHabit}>
              <Plus /> Nuevo hábito
            </Button>
          )
        }
      />

      <div className="flex gap-2">
        <Chip selected={vista === "objetivos"} onClick={() => select("objetivos")}>
          Objetivos
        </Chip>
        <Chip selected={vista === "habitos"} onClick={() => select("habitos")}>
          Hábitos
        </Chip>
      </div>

      {vista === "objetivos" ? <GoalsView /> : <HabitsView />}
    </div>
  );
}
