import type { Project } from "../types";

const modules = import.meta.glob("./projects/*.json", { eager: true });

export const projects: Project[] = (Object.values(modules) as { default: Project }[])
  .map((m) => m.default)
  .sort((a, b) => a.index.localeCompare(b.index));
