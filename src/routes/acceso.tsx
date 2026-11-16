import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Chip } from "@/components/common/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth-store";

export const Route = createFileRoute("/acceso")({
  head: () => ({
    meta: [
      { title: "Acceso — Calma" },
      { name: "description", content: "Entra en tu cuenta de Calma para ver tus tareas." },
      { property: "og:title", content: "Acceso — Calma" },
      { property: "og:description", content: "Entra en tu cuenta de Calma para ver tus tareas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

type Mode = "signin" | "signup";

function AccessPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await signIn(cleanEmail, password);
        // Si va bien, la puerta de la app redirige sola al dashboard.
        if (signInError) setError(signInError);
      } else {
        const { error: signUpError, needsConfirmation } = await signUp(cleanEmail, password);
        if (signUpError) setError(signUpError);
        else if (needsConfirmation) {
          setNotice("Cuenta creada. Revisa tu correo y confirma el enlace para poder entrar.");
          setMode("signin");
        }
      }
    } finally {
      setPending(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <span className="font-display font-semibold text-2xl leading-none">c</span>
            <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-personal" />
          </span>
          <div>
            <h1 className="font-display font-semibold text-3xl leading-tight text-foreground">calma</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup
                ? "Crea tu cuenta para empezar a organizar tu día."
                : "Entra para ver tus tareas y tus notas."}
            </p>
          </div>
        </div>

        <div className="surface space-y-5 p-6">
          <div className="flex gap-2">
            <Chip selected={!isSignup} onClick={() => switchMode("signin")}>
              Entrar
            </Chip>
            <Chip selected={isSignup} onClick={() => switchMode("signup")}>
              Crear cuenta
            </Chip>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignup ? "Al menos 6 caracteres" : "Tu contraseña"}
                className="h-11 rounded-xl"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
                {notice}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={pending || !email.trim() || !password}>
              {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
              {isSignup ? "Crear cuenta" : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Tus datos solo son visibles para ti.
        </p>
      </div>
    </div>
  );
}
