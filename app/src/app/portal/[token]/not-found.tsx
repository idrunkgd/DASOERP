export default function PortalNotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-semibold mb-2">Lien invalide ou expiré</h1>
        <p className="text-sm text-slate-500">
          Ce lien ne correspond plus à aucun espace actif. Si vous pensez qu'il s'agit d'une erreur,
          merci de contacter votre interlocuteur habituel.
        </p>
      </div>
    </div>
  );
}
