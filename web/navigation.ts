// 四个公众模块共用现有展馆界面；草稿预览始终留在受保护的 /preview 下。
export const sectionIds = ['crown', 'culture', 'films', 'voices'] as const;
export type Section = typeof sectionIds[number];
type GalleryLocation = { pathname: string; search: string; hash: string };

export function isSection(value: string): value is Section {
  return sectionIds.some(section => section === value);
}

export function sectionFromPath(pathname: string): Section | undefined {
  const section = pathname.replace(/\/$/, '').slice(1);
  return isSection(section) ? section : undefined;
}

export function sectionFromLocation(location: Pick<GalleryLocation, 'pathname' | 'hash'>, entering = false): Section {
  const section = sectionFromPath(location.pathname);
  if (section) return section;
  // 保留 1.4 首页规则：首次进入 / 或旧 /#culture 等链接时先显示凤冠。
  const anchor = location.hash.slice(1);
  return !entering && isSection(anchor) ? anchor : 'crown';
}

export function sectionUrl(section: Section, location: Pick<GalleryLocation, 'pathname' | 'search'>, preview = false): string {
  return preview ? location.pathname + location.search + '#' + section : '/' + section + location.search;
}
