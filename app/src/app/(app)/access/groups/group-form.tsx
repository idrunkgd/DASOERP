"use client";
// Édition d'un groupe d'accès — UI organisée comme la sidebar :
//   Section sidebar (Pilotage, Commerciale, ...)
//     └─ Entrée de menu (Entreprises, Contacts, ...)
//          └─ Permissions associées (lecture, écriture, ...)
// Toggle "tout cocher / décocher" disponible à la section ET à l'entrée.
// Les pages sans permission requise sont affichées en grisé avec une note.
import { useState, useTransition } from "react";
import {
  createAccessGroup,
  updateAccessGroup
} from "@/server/actions/access-groups";
import { MENU_PERMISSIONS, type Permission } from "@/lib/rbac";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

type Initial = {
  id?: string;
  name?: string;
  description?: string | null;
  permissions?: string[];
  isSystem?: boolean;
};

export function AccessGroupForm({ initial }: { initial?: Initial }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [perms, setPerms] = useState<Set<string>>(
    new Set(initial?.permissions ?? [])
  );
  // Par défaut toutes les sections ouvertes pour la découverte
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(MENU_PERMISSIONS.map((s) => s.section))
  );
  const isSystem = initial?.isSystem ?? false;

  function togglePerm(p: Permission) {
    const next = new Set(perms);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPerms(next);
  }

  function toggleEntry(entryPerms: { value: Permission }[]) {
    const next = new Set(perms);
    const allOn = entryPerms.every((p) => next.has(p.value));
    for (const p of entryPerms) {
      if (allOn) next.delete(p.value);
      else next.add(p.value);
    }
    setPerms(next);
  }

  function toggleSection(section: (typeof MENU_PERMISSIONS)[number]) {
    const next = new Set(perms);
    const allPerms = section.entries.flatMap((e) => e.perms.map((p) => p.value));
    const uniquePerms = Array.from(new Set(allPerms));
    const allOn = uniquePerms.length > 0 && uniquePerms.every((p) => next.has(p));
    for (const p of uniquePerms) {
      if (allOn) next.delete(p);
      else next.add(p);
    }
    setPerms(next);
  }

  function toggleSectionOpen(name: string) {
    const next = new Set(openSections);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setOpenSections(next);
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          try {
            fd.delete("permissions");
            for (const p of perms) fd.append("permissions", p);
            if (initial?.id) {
              await updateAccessGroup(initial.id, fd);
              toast.success("Groupe mis à jour");
              router.refresh();
            } else {
              await createAccessGroup(fd);
            }
          } catch (e: any) {
            toast.error(e.message);
          }
        })
      }
      className="card p-6 space-y-5 max-w-5xl"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5">
          <label className="label">Nom du groupe *</label>
          <input
            name="name"
            defaultValue={initial?.name ?? ""}
            required
            className="input"
            placeholder="ex: Administrateur, Lecture seule, Manager projet"
          />
        </div>
        <div className="col-span-12 md:col-span-7">
          <label className="label">Description</label>
          <input
            name="description"
            defaultValue={initial?.description ?? ""}
            className="input"
          />
        </div>
      </div>

      {isSystem && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Ce groupe est marqué <strong>système</strong> : vous pouvez modifier
          ses permissions mais pas le supprimer.
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="label">
            Permissions par entrée de menu ({perms.size} sélectionnée
            {perms.size > 1 ? "s" : ""})
          </label>
          <div className="flex items-center gap-2 text-[10px]">
            <button
              type="button"
              onClick={() =>
                setOpenSections(
                  new Set(MENU_PERMISSIONS.map((s) => s.section))
                )
              }
              className="text-midnight-500 hover:text-indigoaccent"
            >
              Tout ouvrir
            </button>
            <span className="text-midnight-300">·</span>
            <button
              type="button"
              onClick={() => setOpenSections(new Set())}
              className="text-midnight-500 hover:text-indigoaccent"
            >
              Tout fermer
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {MENU_PERMISSIONS.map((section) => {
            const sectionPermValues = Array.from(
              new Set(
                section.entries.flatMap((e) =>
                  e.perms.map((p) => p.value)
                )
              )
            );
            const sectionSelected = sectionPermValues.filter((p) =>
              perms.has(p)
            ).length;
            const sectionTotal = sectionPermValues.length;
            const isOpen = openSections.has(section.section);

            return (
              <div
                key={section.section}
                className="border border-border rounded-lg overflow-hidden bg-white"
              >
                <div
                  className="flex items-center justify-between px-3 py-2 bg-midnight-50/50 cursor-pointer hover:bg-midnight-100/50"
                  onClick={() => toggleSectionOpen(section.section)}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-midnight-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-midnight-500" />
                    )}
                    <span className="font-semibold text-sm text-midnight-900">
                      {section.section}
                    </span>
                    <span className="text-[11px] text-midnight-500">
                      {sectionTotal > 0
                        ? `${sectionSelected}/${sectionTotal} permission(s)`
                        : `${section.entries.length} entrée(s)`}
                    </span>
                  </div>
                  {sectionTotal > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section);
                      }}
                      className="text-[11px] text-indigoaccent hover:underline"
                    >
                      {sectionSelected === sectionTotal
                        ? "Tout décocher"
                        : "Tout cocher"}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="divide-y divide-midnight-100">
                    {section.entries.map((entry) => {
                      const entrySelected = entry.perms.filter((p) =>
                        perms.has(p.value)
                      ).length;
                      const entryTotal = entry.perms.length;
                      return (
                        <div
                          key={entry.href}
                          className={
                            "px-4 py-2.5 " +
                            (entryTotal === 0 ? "bg-midnight-50/30" : "")
                          }
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-midnight-900">
                                  {entry.menuLabel}
                                </span>
                                <code className="text-[10px] text-midnight-400">
                                  {entry.href}
                                </code>
                              </div>
                              {entry.note && (
                                <div className="text-[11px] text-midnight-500 mt-0.5 flex items-center gap-1">
                                  <Info className="w-3 h-3" /> {entry.note}
                                </div>
                              )}
                            </div>
                            {entryTotal > 1 && (
                              <button
                                type="button"
                                onClick={() => toggleEntry(entry.perms)}
                                className="text-[10px] text-indigoaccent hover:underline shrink-0"
                              >
                                {entrySelected === entryTotal
                                  ? "Tout décocher"
                                  : "Tout cocher"}
                              </button>
                            )}
                          </div>

                          {entryTotal > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-2 pl-1">
                              {entry.perms.map((p) => (
                                <label
                                  key={`${entry.href}-${p.value}`}
                                  className="flex items-center gap-2 text-[13px] hover:bg-midnight-50/40 rounded px-1.5 py-1 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={perms.has(p.value)}
                                    onChange={() => togglePerm(p.value)}
                                  />
                                  <span className="text-midnight-800">
                                    {p.label}
                                  </span>
                                  <code className="ml-auto text-[10px] text-midnight-400">
                                    {p.value}
                                  </code>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/access")}
          className="btn-ghost"
        >
          Annuler
        </button>
        <button disabled={pending} className="btn-primary">
          {pending ? "..." : initial?.id ? "Enregistrer" : "Créer le groupe"}
        </button>
      </div>
    </form>
  );
}
