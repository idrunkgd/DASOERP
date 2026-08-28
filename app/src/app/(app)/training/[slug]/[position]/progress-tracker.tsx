"use client";
import { useEffect, useRef } from "react";
import { updateCourseProgress } from "@/server/actions/training";

/**
 * Fire-and-forget : marque la slide courante comme vue à l'ouverture.
 * Silencieux — pas de toast, pas de bloquant. Une seule fois par mount
 * grâce à useRef.
 */
export function ProgressTracker({ courseId, slidePosition }: { courseId: string; slidePosition: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    updateCourseProgress(courseId, slidePosition).catch(() => { /* silent */ });
  }, [courseId, slidePosition]);
  return null;
}
