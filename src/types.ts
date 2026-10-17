export type Lang = "fr" | "en";
export type LS = { fr: string; en: string };
export type LocalizedText = string | LS;

export type MediaItem = { src: LocalizedText; alt: string; caption?: LS };
export type VideoItem = { src: LocalizedText; poster?: string; caption?: LS };
export type CompareItem = { before: string; after: string; alt: string; caption?: LS };

export type ColumnContent =
  | { kind: "text"; primary: LS; align?: "left" | "right" }
  | { kind: "image"; item: MediaItem }
  | { kind: "video"; item: VideoItem }
  | { kind: "youtube"; url: LocalizedText; caption?: LS }
  | { kind: "website"; url: string; item: MediaItem }
  | { kind: "compare"; item: CompareItem };

export type ContentBlock =
  | { type: "text"; primary: LS; secondary?: LS; align?: "left" | "right" }
  | { type: "image"; item: MediaItem; position: "left" | "right" | "full" }
  | { type: "video"; item: VideoItem; position: "left" | "right" | "full" }
  | { type: "youtube"; url: LocalizedText; caption?: LS; position: "left" | "right" | "full" }
  | { type: "website"; url: string; item: MediaItem; position: "left" | "right" | "full" }
  | { type: "compare"; item: CompareItem; position: "left" | "right" | "full" }
  | { type: "columns"; left: ColumnContent; right: ColumnContent; ratio?: "1:1" | "1:2" | "2:1" }
  | { type: "masonry"; items: MediaItem[] };

export interface Project {
  id: string;
  index: string;
  title: LocalizedText;
  year: string;
  category: LocalizedText;
  tags: LocalizedText[];
  excerpt: LS;
  coverImage: string;
  coverImagePosition?: number;
  hidden?: boolean;
  content: ContentBlock[];
}

export interface LandingLocale {
  title: string;
  location: string;
  portfolio: string;
  tagline: string;
  viewProjects: string;
  selectedWorksPattern: string;
  all: string;
  about: string;
  contact: string;
  projects: string;
  back: string;
  nextProject: string;
  gallery: string;
  year: string;
  tags: string;
  category: string;
  overview: string;
  skills: string;
  tools: string;
  together: string;
  footer: string;
  bio: string;
  bio2: string;
  skillsList: string[];
  toolsList: string[];
  noProjects: string;
  close: string;
  cv: string;
  cvFile: string;
}

export interface ContactLink {
  label: string;
  url: string;
}

export interface LandingContent {
  fr: LandingLocale;
  en: LandingLocale;
  name: string;
  email: string;
  phone: string;
  links: ContactLink[];
}
