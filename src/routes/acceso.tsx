import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Chip } from "@/components/common/chip";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth-store";

export const Route = createFileRoute("/acceso")({
  head: () => ({
    meta: [
      { title: "Acceso — Orgrow" },
      { name: "description", content: "Entra en tu cuenta de Orgrow para ver tus tareas." },
      { property: "og:title", content: "Acceso — Orgrow" },
      { property: "og:description", content: "Entra en tu cuenta de Orgrow para ver tus tareas." },
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
  const [nickname, setNickname] = useState("");
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
    if (mode === "signup" && !nickname.trim()) return;

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await signIn(cleanEmail, password);
        // Si va bien, la puerta de la app redirige sola al dashboard.
        if (signInError) setError(signInError);
      } else {
        const { error: signUpError, needsConfirmation } = await signUp(
          cleanEmail,
          password,
          nickname,
        );
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
          <h1 className="sr-only">Acceso a Orgrow</h1>
          <Brand link={false} surface="background" />
          <p className="text-sm text-muted-foreground">
            {isSignup
              ? "Crea tu cuenta para empezar a organizar tu día."
              : "Entra para ver tus tareas y tus notas."}
          </p>
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
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="nickname">¿Cómo te llamas?</Label>
                <Input
                  id="nickname"
                  type="text"
                  name="nickname"
                  autoComplete="nickname"
                  required
                  maxLength={40}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Tu nombre, el que verás en la app"
                  className="h-11 rounded-xl"
                />
              </div>
            )}

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

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={
                pending || !email.trim() || !password || (isSignup && !nickname.trim())
              }
            >
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
