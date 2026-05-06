"use client";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="w-full max-w-md card p-8">
      <div className="h-32 animate-pulse" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      toast.error("Email ou mot de passe invalide");
    } else if (res?.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-md card p-8">
      <div className="flex flex-col items-center mb-6">
        <Image src="/dasolabs-icon.svg" alt="Dasolabs" width={56} height={70} priority />
        <h1 className="mt-4 text-xl font-semibold text-midnight-900">Dasolabs ERP</h1>
        <p className="text-sm text-midnight-500 mt-1">Connexion à votre espace</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
