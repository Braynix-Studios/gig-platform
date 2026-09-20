"use client";

export interface SavedTask {
  id: string;
  title: string;
  repo: string;
  reward: number;
  difficulty: string;
  technology?: string | null;
  issueUrl?: string | null;
  savedAt: string;
}

const STORAGE_KEY = "gig_saved_tasks";

export function getSavedTasks(): SavedTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isTaskSaved(id: string): boolean {
  if (typeof window === "undefined") return false;
  const tasks = getSavedTasks();
  return tasks.some((t) => t.id === id);
}

export function toggleSavedTask(taskInput: {
  id: string;
  title: string;
  repo: string;
  reward: number;
  difficulty: string;
  technology?: string | null;
  issueUrl?: string | null;
}): boolean {
  if (typeof window === "undefined") return false;
  try {
    const tasks = getSavedTasks();
    const exists = tasks.some((t) => t.id === taskInput.id);
    let updated: SavedTask[];
    if (exists) {
      updated = tasks.filter((t) => t.id !== taskInput.id);
    } else {
      updated = [
        ...tasks,
        {
          id: taskInput.id,
          title: taskInput.title,
          repo: taskInput.repo,
          reward: taskInput.reward,
          difficulty: taskInput.difficulty,
          technology: taskInput.technology,
          issueUrl: taskInput.issueUrl,
          savedAt: new Date().toISOString(),
        },
      ];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("gig_tasks_updated", { detail: { count: updated.length } }));
    return !exists;
  } catch {
    return false;
  }
}
