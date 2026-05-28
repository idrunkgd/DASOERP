"use client";
import { useTransition, useState } from "react";
import { createProfile, updateProfile, deleteProfile } from "@/server/actions/service-profiles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const HOURS_PER_DAY = 8;

export function ProfileForm({ initial }: { initial?: any }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [dailyCost, setDailyCost] = useState<string>(String(initial?.dailyCost ?? ""));
  const [dailySell, setDailySell] = useState<string>(String(initial?.dailySell ?? ""));

  const hourlyCost = Number(dailyCost || 0) / HOURS_PER_DAY;
  const hourlySell = Number(dailySell || 0) / HOURS_PER_DAY;
  const marginPerDay = Number(dailySell || 0) - Number(dailyCost || 0);
  const marginPct =
    Number(dailySell || 0) > 0
      ? (marginPerDay / Number(dailySell)) * 100
      : 0;

  return (
    <form
      action={(fd) =>
        start(async () => {
          try {
            if (initial?.id) {
              await updateProfile(initial.id, fd);
              toast.success("Profil mis à jour");
              router.refresh();
            } else {
              await createProfile(fd);
            }
          } catch (e: any) {
            toast.error(e.message);
          }
        })
      }
      className="card p-6 max-w-2xl space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <label className="label">Nom *</label>
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            required
            className="input"
            placeholder="ex: Senior Developer"
          />
        </div>
        <div className="col-span-4">
          <label className="label">Statut</label>
          <select
            name="active"
            defaultValue={initial?.active === false ? "false" : "true"}
            className="input"
          >
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
        </div>
        <div className="col-span-12">
          <label className="label">Description</label>
          <textarea
            name="description"
            defaultValue={initial?.description ?? ""}
            className="input min-h-[60px] py-2"
          />
        </div>

        <div className="col-span-12 border-t border-border pt-3">
          <div className="text-sm font-semibold mb-2">Tarification journalière</div>
          <div className="text-[11px] text-midnight-500 mb-3">
            On saisit uniquement les tarifs par jour. Les tarifs horaires sont calculés
            automatiquement (1 jour = {HOURS_PER_DAY}h).
          </div>
        </div>

        <div className="col-span-6">
          <label className="label">Coût / jour (€) *</label>
          <input
            name="dailyCost"
            type="number"
            step="0.01"
            value={dailyCost}
            onChange={(e) => setDailyCost(e.target.value)}
            required
            className="input"
          />
          <div className="text-[11px] text-midnight-500 mt-1">
            ↳ Calculé : <span className="font-medium">{hourlyCost.toFixed(2)} € / h</span>
          </div>
        </div>
        <div className="col-span-6">
          <label className="label">Vente / jour (€) *</label>
          <input
            name="dailySell"
            type="number"
            step="0.01"
            value={dailySell}
            onChange={(e) => setDailySell(e.target.value)}
            required
            className="input"
          />
          <div className="text-[11px] text-midnight-500 mt-1">
            ↳ Calculé : <span className="font-medium">{hourlySell.toFixed(2)} € / h</span>
          </div>
        </div>

        {Number(dailySell || 0) > 0 && (
          <div className="col-span-12 bg-midnight-50 rounded p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-midnight-600">Marge par jour</span>
              <span className="font-semibold tabular-nums">
                {marginPerDay.toFixed(2)} € ({marginPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        {initial?.id ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Supprimer ce profil ?"))
                start(async () => {
                  await deleteProfile(initial.id);
                  window.location.href = "/service-profiles";
                });
            }}
            className="btn-danger btn-sm"
          >
            Supprimer
          </button>
        ) : (
          <span />
        )}
        <button disabled={pending} className="btn-primary">
          {pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}
        </button>
      </div>
    </form>
  );
}
