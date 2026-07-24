"use client";
import { useState } from "react";
import { Camera, X } from "lucide-react";

/**
 * Input photo véhicule — encode en base64 pour stockage direct en DB
 * (comme User.photoUrl). Max ~1 Mo. Champ hidden pour le form parent.
 */
export function PhotoInput({ initial }: { initial?: string | null }) {
  const [preview, setPreview] = useState<string | null>(initial ?? null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_200_000) {
      alert("Photo trop lourde. Compresse-la à < 1 Mo (Preview > Export > Reduce File Size sur macOS).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="label">Photo du véhicule</label>
      <input type="hidden" name="photoUrl" value={preview ?? ""} />
      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Aperçu véhicule" className="max-h-40 rounded-lg border border-border" />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute -top-2 -right-2 bg-white border border-border rounded-full p-1 hover:bg-red-50"
            title="Retirer la photo"
          >
            <X className="w-3 h-3 text-red-600" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 border border-dashed border-c2c3d6 rounded-lg p-3 cursor-pointer hover:bg-midnight-50 text-sm text-midnight-500">
          <Camera className="w-4 h-4" />
          <span>Ajouter une photo (JPG/PNG, max 1 Mo)</span>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
