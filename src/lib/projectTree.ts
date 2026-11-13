import type { Project } from "./tasks";

/**
 * Тушаал ба дэд тушаалын мод — жагсаалтаас нэг удаа байгуулж, UI бүхэлдээ
 * ашиглана. Эх нь харагдахгүй (жагсаалтад байхгүй) тушаалыг үндэс гэж үзнэ.
 */
export type ProjectTree = {
  roots: Project[];
  childrenOf: (id: string) => Project[];
  /** Үндэснээс энэ тушаал хүртэлх зам (өөрийг нь оруулаад) */
  pathOf: (id: string) => Project[];
  /** Өөрийг нь оруулаад доорх бүх тушаалын id */
  subtreeIds: (id: string) => Set<string>;
  /** Модны дарааллаар, гүнтэй нь — жагсаалт/сонголтод */
  flat: { project: Project; depth: number }[];
};

export function buildProjectTree(projects: Project[]): ProjectTree {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const children = new Map<string, Project[]>();
  const roots: Project[] = [];

  for (const project of projects) {
    if (project.parentId && byId.has(project.parentId)) {
      const list = children.get(project.parentId) ?? [];
      list.push(project);
      children.set(project.parentId, list);
    } else {
      roots.push(project);
    }
  }

  const childrenOf = (id: string) => children.get(id) ?? [];

  const pathOf = (id: string) => {
    const path: Project[] = [];
    const seen = new Set<string>();
    let current = byId.get(id);

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  };

  const subtreeIds = (id: string) => {
    const ids = new Set<string>();
    const stack = [id];

    while (stack.length > 0) {
      const next = stack.pop()!;
      if (ids.has(next)) continue;
      ids.add(next);
      for (const child of childrenOf(next)) stack.push(child.id);
    }
    return ids;
  };

  const flat: ProjectTree["flat"] = [];
  const walk = (list: Project[], depth: number) => {
    for (const project of list) {
      flat.push({ project, depth });
      walk(childrenOf(project.id), depth + 1);
    }
  };
  walk(roots, 0);

  return { roots, childrenOf, pathOf, subtreeIds, flat };
}

/** "Эх › Дэд › Дэд" хэлбэрийн нэр */
export const pathLabel = (tree: ProjectTree, id: string) =>
  tree
    .pathOf(id)
    .map((project) => project.name)
    .join(" › ");
