import { useState, useEffect, useRef, useCallback, useContext, createContext } from "react";
import { Plus, Trash2, Copy, GripVertical, ChevronDown, ChevronUp, Save, Eye, EyeOff, ArrowLeft, ArrowLeftRight, X, ImageIcon, Type, Video, Youtube, LayoutGrid, Columns2, CircleHelp, Pencil, Globe, ChevronsLeftRight, CloudUpload, TriangleAlert, LoaderCircle, CircleCheck, ClipboardCopy, ClipboardCheck } from "lucide-react";
import type { Project, ContentBlock, ColumnContent, MediaItem, CompareItem, LS, LocalizedText, LandingContent } from "../types";

// ─── LANGUE GLOBALE DE L'ÉDITEUR ───────────────────────────────────────────
// Un seul interrupteur FR/EN pilote tous les champs bilingues de la page,
// pour éviter de devoir basculer chaque paragraphe/section individuellement.

const EditLangContext = createContext<{ lang: "fr" | "en"; setLang: (l: "fr" | "en") => void }>({
  lang: "fr",
  setLang: () => {},
});

function useEditLang() {
  return useContext(EditLangContext);
}

// ─── TYPES ÉDITEUR ─────────────────────────────────────────────────────────

type DraftBlock = ContentBlock & { _uid: string };

interface ProjectDraft extends Omit<Project, "content" | "title" | "tags" | "category"> {
  category: LS;
  title: LS;
  tags: LS[];
  content: DraftBlock[];
}

type EditorMode = "project" | "landing";

type ImageHintKind = "cover" | "full" | "half" | "column" | "masonry" | "generic";

const emptyLS = (): LS => ({ fr: "", en: "" });

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function newProject(): ProjectDraft {
  return {
    id: `projet-${Date.now()}`,
    index: "00",
    title: emptyLS(),
    year: new Date().getFullYear().toString(),
    category: { fr: "Identité visuelle", en: "Visual Identity" },
    tags: [],
    excerpt: emptyLS(),
    coverImage: "",
    content: [
      { _uid: uid(), type: "text" as const, primary: { fr: "[Intro] Le brief : qui, quoi, contexte (3 phrases max).", en: "" } },
      { _uid: uid(), type: "text" as const, primary: { fr: "[Défi] Quel problème as-tu résolu ? (1-2 phrases)", en: "" } },
      newBlock("image"),
      { _uid: uid(), type: "text" as const, primary: { fr: "[Approche] Ton rôle et tes décisions créatives (2-3 phrases).", en: "" } },
      { _uid: uid(), type: "text" as const, primary: { fr: "[Résultat] Impact mesurable, si possible (1-2 phrases).", en: "" } },
    ],
  };
}

function toLS(value: LocalizedText | undefined): LS {
  if (!value) return emptyLS();
  return typeof value === "string" ? { fr: value, en: value } : value;
}

function displayLS(value: LS): string {
  return value.fr || value.en || "Sans titre";
}

function fileNameFromSrc(src: LocalizedText): string {
  const s = typeof src === "string" ? src : (src.fr || src.en);
  if (!s) return "";
  const last = s.split("/").pop() || s;
  const withoutQuery = last.split("?")[0];
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

function lsKey(value: LS): string {
  return `${value.fr.trim().toLowerCase()}__${value.en.trim().toLowerCase()}`;
}

function isSameLS(a: LS, b: LS): boolean {
  return lsKey(a) === lsKey(b);
}

function stripUids(draft: ProjectDraft): Project {
  const { content, ...rest } = draft;
  return {
    ...rest,
    content: content.map(({ _uid, ...block }: DraftBlock) => block as ContentBlock),
  };
}

function draftToProject(draft: ProjectDraft): Project {
  return stripUids(draft);
}

const serializeDraft = (draft: ProjectDraft) => JSON.stringify(draftToProject(draft));

// Tout le texte d'un projet dans une langue, dans l'ordre de la page (métadonnées, puis blocs)
const COPY_LABELS = {
  fr: { tags: "Tags", caption: "Légende", alt: "Texte alternatif", image: "Image", video: "Vidéo", youtube: "Vidéo YouTube", website: "Site web", compare: "Avant / Après", gallery: "Galerie", left: "Colonne gauche", right: "Colonne droite" },
  en: { tags: "Tags", caption: "Caption", alt: "Alt text", image: "Image", video: "Video", youtube: "YouTube video", website: "Website", compare: "Before / After", gallery: "Gallery", left: "Left column", right: "Right column" },
} as const;

function projectToPlainText(draft: ProjectDraft, lang: "fr" | "en"): string {
  const L = COPY_LABELS[lang];
  const tr = (v: LocalizedText | undefined) => (v === undefined ? "" : typeof v === "string" ? v : v[lang]).trim();
  const media = (label: string, caption?: LocalizedText, alt?: string, extra?: string) =>
    [`[${label}]${extra ? ` ${extra}` : ""}`, tr(caption) && `${L.caption} : ${tr(caption)}`, alt?.trim() && `${L.alt} : ${alt.trim()}`]
      .filter(Boolean).join("\n");

  const column = (c: ColumnContent): string => {
    if (c.kind === "text") return tr(c.primary);
    if (c.kind === "image") return media(L.image, c.item.caption, c.item.alt);
    if (c.kind === "video") return media(L.video, c.item.caption);
    if (c.kind === "youtube") return media(L.youtube, c.caption);
    if (c.kind === "website") return media(L.website, c.item.caption, c.item.alt, c.url);
    if (c.kind === "compare") return media(L.compare, c.item.caption, c.item.alt);
    return "";
  };

  const block = (b: ContentBlock): string => {
    switch (b.type) {
      case "text": return [tr(b.primary), tr(b.secondary)].filter(Boolean).join("\n\n");
      case "image": return media(L.image, b.item.caption, b.item.alt);
      case "video": return media(L.video, b.item.caption);
      case "youtube": return media(L.youtube, b.caption);
      case "website": return media(L.website, b.item.caption, b.item.alt, b.url);
      case "compare": return media(L.compare, b.item.caption, b.item.alt);
      case "columns": return [`[${L.left}]\n${column(b.left)}`, `[${L.right}]\n${column(b.right)}`].join("\n\n");
      case "masonry": return [`[${L.gallery}]`, ...b.items.map((it) => [tr(it.caption) && `${L.caption} : ${tr(it.caption)}`, it.alt.trim() && `${L.alt} : ${it.alt.trim()}`].filter(Boolean).join("\n")).filter(Boolean)].join("\n");
      default: return "";
    }
  };

  const meta = [
    tr(draft.title),
    [tr(draft.category), draft.year].filter(Boolean).join(" · "),
    draft.tags.length ? `${L.tags} : ${draft.tags.map(tr).filter(Boolean).join(", ")}` : "",
    tr(draft.excerpt),
    tr(draft.credits),
  ];
  return [...meta, ...draft.content.map(block)]
    .filter((part) => part.trim())
    .join("\n\n");
}

function withAutoIndex(projects: ProjectDraft[]): ProjectDraft[] {
  return projects.map((project, i) => ({
    ...project,
    index: String(i + 1).padStart(2, "0"),
  }));
}

// ─── API ───────────────────────────────────────────────────────────────────

// Version = empreinte du fichier sur le disque au moment où l'éditeur l'a lu.
// Le serveur refuse d'écrire si le fichier a changé depuis (409) : rien n'est écrasé en silence.
type FileVersion = string | null;

class ConflictError extends Error {
  constructor() {
    super("Le fichier a été modifié en dehors de l'éditeur");
  }
}

async function apiSave(project: Project, expectedVersion: FileVersion, force = false): Promise<FileVersion> {
  const res = await fetch("/api/save-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, expectedVersion, force }),
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) throw new Error("Erreur lors de la sauvegarde");
  return (await res.json()).version;
}

async function apiDelete(id: string, expectedVersion: FileVersion, force = false): Promise<void> {
  const res = await fetch("/api/delete-project", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, expectedVersion, force }),
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) throw new Error("Erreur lors de la suppression");
}

type UploadResult = {
  path: string;
  converted?: { from: string; originalSize: number; size: number; width: number; height: number };
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

async function apiUpload(file: File, projectId: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, filename: file.name, data: base64 }),
        });
        const json = await res.json();
        if (json.path) resolve(json);
        else reject(new Error(json.error));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function apiList(): Promise<{ project: Project; version: FileVersion }[]> {
  const res = await fetch("/api/list-projects");
  return res.json();
}

async function apiGetLanding(): Promise<{ landing: LandingContent; version: FileVersion }> {
  const res = await fetch("/api/get-landing");
  if (!res.ok) throw new Error("Erreur lors du chargement de la landing page");
  return res.json();
}

async function apiSaveLanding(landing: LandingContent, expectedVersion: FileVersion, force = false): Promise<FileVersion> {
  const res = await fetch("/api/save-landing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landing, expectedVersion, force }),
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) throw new Error("Erreur lors de la sauvegarde de la landing page");
  return (await res.json()).version;
}

type PublishFile = { path: string; status: "added" | "modified" | "deleted"; sizeMB: number | null; title: string | null };
type PublishState = {
  files: PublishFile[];
  unpublishedContent: string[];
  outside: string[];
  ahead: number;
  behind: number;
  offline: boolean;
  blockers: string[];
  warnings: string[];
  lastPublished: string | null;
};

async function apiPublishStatus(fetchRemote: boolean): Promise<PublishState> {
  const res = await fetch(`/api/publish-status?fetch=${fetchRemote ? 1 : 0}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Impossible de lire l'état de publication");
  return data;
}

async function apiPublish(message: string): Promise<{ commit: string; lastPublished: string }> {
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "La publication a échoué. Rien n'a été mis en ligne.");
  return data;
}

// ─── COMPOSANTS UI ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-body text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
      {children}
    </span>
  );
}

function LangTabs({ value, onChange, size = "sm" }: {
  value: "fr" | "en"; onChange: (l: "fr" | "en") => void; size?: "sm" | "lg";
}) {
  return (
    <div className="flex border border-border overflow-hidden">
      {(["fr", "en"] as const).map((l) => (
        <button key={l} onClick={() => onChange(l)}
          className={`font-body tracking-widest uppercase transition-colors ${size === "lg" ? "px-3 py-1 text-[10px]" : "px-2 py-0.5 text-[9px]"}`}
          style={{ background: value === l ? "#0246F3" : "transparent", color: value === l ? "#fff" : "var(--muted-foreground)" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Input({ value, onChange, placeholder, className = "", readOnly = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full bg-secondary border border-border px-3 py-2 font-body text-sm outline-none focus:border-primary transition-colors ${readOnly ? "cursor-not-allowed opacity-70" : ""} ${className}`}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-secondary border border-border px-3 py-2 font-body text-sm outline-none focus:border-primary transition-colors resize-none overflow-hidden"
    />
  );
}

function BilingualTextarea({ label, value, onChange, rows = 3 }: {
  label: string; value: LS; onChange: (v: LS) => void; rows?: number;
}) {
  const { lang: tab } = useEditLang();
  const otherTab = tab === "fr" ? "en" : "fr";
  const editedRef = useRef({ fr: !!value.fr, en: !!value.en });

  const handleChange = (nextValue: string) => {
    editedRef.current[tab] = true;
    const shouldMirror = !editedRef.current[otherTab];
    const next: LS = {
      ...value,
      [tab]: nextValue,
      ...(shouldMirror ? { [otherTab]: nextValue } : {}),
    };
    onChange(next);
  };

  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        value={value[tab]}
        onChange={handleChange}
        placeholder={tab === "fr" ? "Texte français…" : "English text…"}
        rows={rows}
      />
    </div>
  );
}

function BilingualInput({ label, value, onChange, placeholder }: {
  label: string; value: LS; onChange: (v: LS) => void; placeholder?: string;
}) {
  const { lang: tab } = useEditLang();
  const otherTab = tab === "fr" ? "en" : "fr";
  const editedRef = useRef({ fr: !!value.fr, en: !!value.en });

  const handleChange = (nextValue: string) => {
    editedRef.current[tab] = true;
    const shouldMirror = !editedRef.current[otherTab];
    const next: LS = {
      ...value,
      [tab]: nextValue,
      ...(shouldMirror ? { [otherTab]: nextValue } : {}),
    };
    onChange(next);
  };

  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value[tab]}
        onChange={handleChange}
        placeholder={placeholder ?? (tab === "fr" ? "Texte français…" : "English text…")}
      />
    </div>
  );
}

function ImageGuidelines({ kind = "generic" }: { kind?: ImageHintKind }) {
  const [open, setOpen] = useState(false);
  const hints: Record<ImageHintKind, { title: string; lines: string[] }> = {
    cover: {
      title: "Image de couverture",
      lines: [
        "1400 x 800 px (16/9 approx)",
        "Utilisee pour la carte projet + tete de fiche",
        "Haute resolution recommandee",
      ],
    },
    full: {
      title: "Image pleine page",
      lines: [
        "1400 x 800 px minimum",
        "Ratio libre, paysage prefere",
        "Affichage bord a bord sur desktop",
      ],
    },
    half: {
      title: "Image demi-page",
      lines: [
        "900 x 680 px (4/3 approx)",
        "Pour position left / right",
        "Le portrait fonctionne bien",
      ],
    },
    column: {
      title: "Image de colonne",
      lines: [
        "900 x 680 px (4/3 approx)",
        "Equivalent demi-page",
        "Chaque colonne fait environ 50% de largeur",
      ],
    },
    masonry: {
      title: "Images masonry",
      lines: [
        "Portrait: 800 x 1000 px",
        "Paysage: 800 x 600 px",
        "Carre: 800 x 800 px",
        "Melanger les ratios pour un rendu naturel",
      ],
    },
    generic: {
      title: "Conseils image",
      lines: [
        "Preferer des images nettes en format paysage",
      ],
    },
  };

  const { title, lines } = hints[kind];

  return (
    <div className="mt-2 relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="inline-flex items-center gap-1.5 font-body text-[10px] tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors"
        aria-expanded={open}
        aria-label="Afficher les recommandations image"
      >
        <CircleHelp size={12} /> Recommandations image
      </button>

      <div
        className={`absolute left-0 top-full mt-2 w-[320px] max-w-[calc(100vw-4rem)] border border-border bg-background shadow-lg z-20 transition-all duration-150 ${open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="px-3 py-2">
          <span className="block font-body text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">{title}</span>
          <div className="space-y-0.5">
            {lines.map((line) => (
              <p key={line} className="font-body text-[10px] leading-relaxed text-muted-foreground">{line}</p>
            ))}
          </div>
          <div className="h-px bg-border/60 my-2" />
          <p className="font-body text-[10px] leading-relaxed text-muted-foreground">
            PNG et JPG sont convertis automatiquement en WebP (qualité 85, 2560 px max). Seul le .webp est gardé.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── IMAGE UPLOAD ──────────────────────────────────────────────────────────

function ImageUpload({ src, onChange, projectId, label = "Image", hintKind = "generic" }: {
  src: string;
  onChange: (path: string) => void;
  projectId: string;
  label?: string;
  hintKind?: ImageHintKind;
}) {
  const showLabel = label !== "";
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit etre une image");
      return;
    }
    setUploading(true);
    setError("");
    setNote("");
    try {
      const { path, converted } = await apiUpload(file, projectId);
      onChange(path);
      if (converted) {
        setNote(`Converti en WebP : ${formatSize(converted.originalSize)} → ${formatSize(converted.size)} (${converted.width}×${converted.height})`);
      }
    } catch (e) {
      setError("Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {showLabel && <Label>{label}</Label>}
      <div
        className="border border-dashed border-border bg-secondary flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary transition-colors"
        style={{ minHeight: 80 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {src ? (
          <div className="relative w-full">
            <img src={src} alt="" className="w-full object-cover" style={{ maxHeight: 120 }} />
            <div className="absolute inset-0 bg-foreground/0 hover:bg-foreground/30 transition-colors flex items-center justify-center">
              <span className="opacity-0 hover:opacity-100 font-body text-[10px] text-white tracking-widest uppercase">Changer</span>
            </div>
          </div>
        ) : (
          <>
            <ImageIcon size={20} className="text-muted-foreground" />
            <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
              {uploading ? "Upload…" : "Glisser ou cliquer"}
            </span>
          </>
        )}
      </div>
      {error && <p className="font-body text-[10px] text-red-500 mt-1">{error}</p>}
      {note && <p className="font-body text-[10px] text-green-500 mt-1">{note}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {src && (
        <div className="mt-1">
          <Input value={src} onChange={onChange} placeholder="Ou coller une URL…" />
        </div>
      )}
      {!src && (
        <div className="mt-1">
          <Input value={src} onChange={onChange} placeholder="Ou coller une URL distante…" />
        </div>
      )}
      <ImageGuidelines kind={hintKind} />
    </div>
  );
}

function LocalizedImageUpload({ value, onChange, projectId, label = "Image", hintKind = "generic", actions }: {
  value: LS;
  onChange: (v: LS) => void;
  projectId: string;
  label?: string;
  hintKind?: ImageHintKind;
  actions?: React.ReactNode;
}) {
  const { lang: tab } = useEditLang();
  const otherTab = tab === "fr" ? "en" : "fr";
  const editedRef = useRef({ fr: !!value.fr, en: !!value.en });

  const handleChange = (nextValue: string) => {
    editedRef.current[tab] = true;
    const shouldMirror = !editedRef.current[otherTab];
    onChange({
      ...value,
      [tab]: nextValue,
      ...(shouldMirror ? { [otherTab]: nextValue } : {}),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        {actions}
      </div>
      <ImageUpload key={tab} src={value[tab]} onChange={handleChange} projectId={projectId} label="" hintKind={hintKind} />
    </div>
  );
}

// ─── VIDEO UPLOAD ──────────────────────────────────────────────────────────

function VideoUpload({ src, onChange, projectId, label = "Vidéo" }: {
  src: string;
  onChange: (path: string) => void;
  projectId: string;
  label?: string;
}) {
  const showLabel = label !== "";
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Le fichier doit être une vidéo");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const { path } = await apiUpload(file, projectId);
      onChange(path);
    } catch (e) {
      setError("Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {showLabel && <Label>{label}</Label>}
      <div
        className="border border-dashed border-border bg-secondary flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary transition-colors"
        style={{ minHeight: 80 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {src ? (
          <div className="relative w-full">
            <video key={src} src={src} controls className="w-full object-cover" style={{ maxHeight: 160 }} />
            <div className="absolute inset-0 bg-foreground/0 hover:bg-foreground/20 transition-colors flex items-center justify-center pointer-events-none">
              <span className="opacity-0 hover:opacity-100 font-body text-[10px] text-white tracking-widest uppercase">Changer</span>
            </div>
          </div>
        ) : (
          <>
            <Video size={20} className="text-muted-foreground" />
            <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
              {uploading ? "Upload…" : "Glisser ou cliquer"}
            </span>
          </>
        )}
      </div>
      {error && <p className="font-body text-[10px] text-red-500 mt-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="mt-1">
        <Input value={src} onChange={onChange} placeholder="Ou coller une URL…" />
      </div>
    </div>
  );
}

function PdfUpload({ src, onChange, folder, label = "PDF" }: {
  src: string;
  onChange: (path: string) => void;
  folder: string;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Le fichier doit être un PDF");
      return;
    }
    setUploading(true);
    setError("");
    try {
      onChange((await apiUpload(file, folder)).path);
    } catch (e) {
      setError("Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div
        className="border border-dashed border-border bg-secondary flex items-center justify-center gap-2 px-3 cursor-pointer hover:border-primary transition-colors"
        style={{ minHeight: 56 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground truncate">
          {uploading ? "Upload…" : src ? `${fileNameFromSrc(src)} — changer` : "Glisser ou cliquer"}
        </span>
      </div>
      {error && <p className="font-body text-[10px] text-red-500 mt-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="mt-1">
        <Input value={src} onChange={onChange} placeholder="Ou coller un chemin…" />
      </div>
    </div>
  );
}

function LocalizedVideoUpload({ value, onChange, projectId, label = "Vidéo" }: {
  value: LS;
  onChange: (v: LS) => void;
  projectId: string;
  label?: string;
}) {
  const { lang: tab } = useEditLang();
  const otherTab = tab === "fr" ? "en" : "fr";
  const editedRef = useRef({ fr: !!value.fr, en: !!value.en });

  const handleChange = (nextValue: string) => {
    editedRef.current[tab] = true;
    const shouldMirror = !editedRef.current[otherTab];
    onChange({
      ...value,
      [tab]: nextValue,
      ...(shouldMirror ? { [otherTab]: nextValue } : {}),
    });
  };

  return (
    <div>
      <Label>{label}</Label>
      <VideoUpload key={tab} src={value[tab]} onChange={handleChange} projectId={projectId} label="" />
    </div>
  );
}

function PositionSelect({ value, onChange }: {
  value: "left" | "right" | "full"; onChange: (v: "left" | "right" | "full") => void;
}) {
  return (
    <div>
      <Label>Position</Label>
      <div className="flex border border-border overflow-hidden">
        {(["left", "right", "full"] as const).map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className="flex-1 py-1.5 font-body text-[10px] tracking-widest uppercase transition-colors"
            style={{ background: value === p ? "#0246F3" : "transparent", color: value === p ? "#fff" : "var(--muted-foreground)" }}>
            {p === "left" ? "Gauche" : p === "right" ? "Droite" : "Pleine page"}
          </button>
        ))}
      </div>
    </div>
  );
}

function RatioSelect({ value, onChange }: {
  value: "1:1" | "1:2" | "2:1"; onChange: (v: "1:1" | "1:2" | "2:1") => void;
}) {
  const options = [
    { v: "1:1" as const, label: "Égal" },
    { v: "2:1" as const, label: "Gauche 2/3" },
    { v: "1:2" as const, label: "Droite 2/3" },
  ];
  return (
    <div>
      <Label>Répartition</Label>
      <div className="flex border border-border overflow-hidden">
        {options.map(({ v, label }) => (
          <button key={v} onClick={() => onChange(v)}
            className="flex-1 py-1.5 font-body text-[10px] tracking-widest uppercase transition-colors"
            style={{ background: value === v ? "#0246F3" : "transparent", color: value === v ? "#fff" : "var(--muted-foreground)" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlignSelect({ value, onChange }: {
  value: "left" | "right"; onChange: (v: "left" | "right") => void;
}) {
  return (
    <div>
      <Label>Alignement</Label>
      <div className="flex border border-border overflow-hidden">
        {(["left", "right"] as const).map((a) => (
          <button key={a} onClick={() => onChange(a)}
            className="flex-1 py-1.5 font-body text-[10px] tracking-widest uppercase transition-colors"
            style={{ background: value === a ? "#0246F3" : "transparent", color: value === a ? "#fff" : "var(--muted-foreground)" }}>
            {a === "left" ? "Gauche" : "Droite"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ÉDITEURS DE BLOCS ────────────────────────────────────────────────────

function MediaItemEditor({ value, onChange, projectId, label = "Image", hintKind = "generic", actions }: {
  value: MediaItem;
  onChange: (v: MediaItem) => void;
  projectId: string;
  label?: string;
  hintKind?: ImageHintKind;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <LocalizedImageUpload value={toLS(value.src)} onChange={(src) => onChange({ ...value, src })} projectId={projectId} label={label} hintKind={hintKind} actions={actions} />
      <div>
        <Label>Alt</Label>
        <Input value={value.alt} onChange={(alt) => onChange({ ...value, alt })} placeholder="Description de l'image" />
      </div>
      <BilingualInput label="Légende (optionnel)" value={value.caption ?? emptyLS()} onChange={(caption) => onChange({ ...value, caption })} />
    </div>
  );
}

function CompareItemEditor({ value, onChange, projectId, hintKind = "generic" }: {
  value: CompareItem;
  onChange: (v: CompareItem) => void;
  projectId: string;
  hintKind?: ImageHintKind;
}) {
  return (
    <div className="space-y-3">
      <ImageUpload src={value.before} onChange={(before) => onChange({ ...value, before })} projectId={projectId} label="Avant" hintKind={hintKind} />
      <ImageUpload src={value.after} onChange={(after) => onChange({ ...value, after })} projectId={projectId} label="Après" hintKind={hintKind} />
      <p className="font-body text-[10px] text-muted-foreground">Images communes au FR et à l'EN. Les deux doivent avoir exactement les mêmes dimensions et le même cadrage.</p>
      <div>
        <Label>Alt</Label>
        <Input value={value.alt} onChange={(alt) => onChange({ ...value, alt })} placeholder="Description de l'image" />
      </div>
      <BilingualInput label="Légende (optionnel)" value={value.caption ?? emptyLS()} onChange={(caption) => onChange({ ...value, caption })} />
    </div>
  );
}

const emptyCompare = (): CompareItem => ({ before: "", after: "", alt: "", caption: emptyLS() });

const COLUMN_KINDS = [
  { k: "text", label: "Texte", icon: <Type size={12} /> },
  { k: "image", label: "Image", icon: <ImageIcon size={12} /> },
  { k: "video", label: "Vidéo", icon: <Video size={12} /> },
  { k: "youtube", label: "YouTube", icon: <Youtube size={12} /> },
  { k: "website", label: "Site web", icon: <Globe size={12} /> },
  { k: "compare", label: "Avant / Après", icon: <ChevronsLeftRight size={12} /> },
] as const;

function ColumnEditor({ value, onChange, projectId }: {
  value: ColumnContent; onChange: (v: ColumnContent) => void; projectId: string;
}) {
  const [kindOpen, setKindOpen] = useState(false);
  const current = COLUMN_KINDS.find((o) => o.k === value.kind) ?? COLUMN_KINDS[0];

  const setKind = (k: string) => {
    if (k === "text") onChange({ kind: "text", primary: emptyLS() });
    if (k === "image") onChange({ kind: "image", item: { src: "", alt: "", caption: emptyLS() } });
    if (k === "video") onChange({ kind: "video", item: { src: "", caption: emptyLS() } });
    if (k === "youtube") onChange({ kind: "youtube", url: "", caption: emptyLS() });
    if (k === "website") onChange({ kind: "website", url: "", item: { src: "", alt: "", caption: emptyLS() } });
    if (k === "compare") onChange({ kind: "compare", item: emptyCompare() });
    setKindOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Label>Type</Label>
        <button onClick={() => setKindOpen((o) => !o)}
          className="w-full flex items-center gap-2 border border-border px-3 py-1.5 font-body text-[10px] tracking-wider uppercase text-left hover:border-primary transition-colors">
          <span className="text-muted-foreground">{current.icon}</span>
          {current.label}
          <ChevronDown size={12} className="ml-auto text-muted-foreground" />
        </button>
        {kindOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-background z-10">
            {COLUMN_KINDS.map(({ k, label, icon }) => (
              <button key={k} onClick={() => setKind(k)}
                className="w-full flex items-center gap-2 px-3 py-2 font-body text-[10px] tracking-wider uppercase hover:bg-secondary transition-colors text-left"
                style={{ color: value.kind === k ? "#0246F3" : undefined }}>
                {icon}{label}
              </button>
            ))}
          </div>
        )}
      </div>

      {value.kind === "text" && (
        <>
          <BilingualTextarea label="Texte principal" value={value.primary} onChange={(primary) => onChange({ ...value, primary })} />
          <AlignSelect value={value.align ?? "left"} onChange={(align) => onChange({ ...value, align })} />
        </>
      )}
      {value.kind === "image" && (
        <MediaItemEditor value={value.item} onChange={(item) => onChange({ ...value, item })} projectId={projectId} hintKind="column" />
      )}
      {value.kind === "video" && (
        <div className="space-y-2">
          <LocalizedVideoUpload label="Vidéo" value={toLS(value.item.src)} onChange={(src) => onChange({ ...value, item: { ...value.item, src } })} projectId={projectId} />
          <BilingualInput label="Légende (optionnel)" value={value.item.caption ?? emptyLS()} onChange={(caption) => onChange({ ...value, item: { ...value.item, caption } })} />
        </div>
      )}
      {value.kind === "youtube" && (
        <div className="space-y-2">
          <BilingualInput label="URL YouTube" value={toLS(value.url)} onChange={(url) => onChange({ ...value, url })} placeholder="https://youtube.com/watch?v=…" />
          <BilingualInput label="Légende (optionnel)" value={value.caption ?? emptyLS()} onChange={(caption) => onChange({ ...value, caption })} />
        </div>
      )}
      {value.kind === "website" && (
        <div className="space-y-3">
          <div>
            <Label>URL du site</Label>
            <Input value={value.url} onChange={(url) => onChange({ ...value, url })} placeholder="https://…" />
          </div>
          <MediaItemEditor value={value.item} onChange={(item) => onChange({ ...value, item })} projectId={projectId} label="Capture d'écran" hintKind="column" />
        </div>
      )}
      {value.kind === "compare" && (
        <CompareItemEditor value={value.item} onChange={(item) => onChange({ ...value, item })} projectId={projectId} hintKind="column" />
      )}
    </div>
  );
}

function BlockEditor({ block, onChange, onDelete, onDuplicate, projectId, dragHandleProps }: {
  block: DraftBlock;
  onChange: (b: DraftBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  projectId: string;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [open, setOpen] = useState(true);

  const BLOCK_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    text: { label: "Texte", icon: <Type size={13} /> },
    image: { label: "Image", icon: <ImageIcon size={13} /> },
    video: { label: "Vidéo", icon: <Video size={13} /> },
    youtube: { label: "YouTube", icon: <Youtube size={13} /> },
    website: { label: "Site web", icon: <Globe size={13} /> },
    compare: { label: "Avant / Après", icon: <ChevronsLeftRight size={13} /> },
    columns: { label: "Colonnes", icon: <Columns2 size={13} /> },
    masonry: { label: "Masonry", icon: <LayoutGrid size={13} /> },
  };

  const meta = BLOCK_LABELS[block.type];

  return (
    <div className="border border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div {...dragHandleProps} className="cursor-grab text-muted-foreground hover:text-foreground transition-colors">
          <GripVertical size={14} />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-muted-foreground">{meta?.icon}</span>
          <span className="font-body text-[10px] tracking-[0.2em] uppercase">{meta?.label}</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground hover:text-foreground transition-colors">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={onDuplicate} className="text-muted-foreground hover:text-foreground transition-colors ml-1" aria-label="Dupliquer le bloc">
          <Copy size={13} />
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 transition-colors ml-1">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="p-4 space-y-4">
          {block.type === "text" && (
            <>
              <BilingualTextarea label="Texte principal" value={block.primary} onChange={(primary) => onChange({ ...block, primary })} />
              <AlignSelect value={block.align ?? "left"} onChange={(align) => onChange({ ...block, align })} />
            </>
          )}

          {block.type === "image" && (
            <>
              <MediaItemEditor
                value={block.item}
                onChange={(item) => onChange({ ...block, item })}
                projectId={projectId}
                hintKind={block.position === "full" ? "full" : "half"}
              />
              <PositionSelect value={block.position} onChange={(position) => onChange({ ...block, position })} />
            </>
          )}

          {block.type === "video" && (
            <>
              <LocalizedVideoUpload label="Vidéo" value={toLS(block.item.src)} onChange={(src) => onChange({ ...block, item: { ...block.item, src } })} projectId={projectId} />
              <BilingualInput label="Légende (optionnel)" value={block.item.caption ?? emptyLS()} onChange={(caption) => onChange({ ...block, item: { ...block.item, caption } })} />
              <PositionSelect value={block.position} onChange={(position) => onChange({ ...block, position })} />
            </>
          )}

          {block.type === "youtube" && (
            <>
              <BilingualInput label="URL YouTube" value={toLS(block.url)} onChange={(url) => onChange({ ...block, url })} placeholder="https://youtube.com/watch?v=…" />
              <BilingualInput label="Légende (optionnel)" value={block.caption ?? emptyLS()} onChange={(caption) => onChange({ ...block, caption })} />
              <PositionSelect value={block.position} onChange={(position) => onChange({ ...block, position })} />
            </>
          )}

          {block.type === "website" && (
            <>
              <div>
                <Label>URL du site</Label>
                <Input value={block.url} onChange={(url) => onChange({ ...block, url })} placeholder="https://…" />
              </div>
              <MediaItemEditor
                value={block.item}
                onChange={(item) => onChange({ ...block, item })}
                projectId={projectId}
                label="Capture d'écran"
                hintKind={block.position === "full" ? "full" : "half"}
              />
              <PositionSelect value={block.position} onChange={(position) => onChange({ ...block, position })} />
            </>
          )}

          {block.type === "compare" && (
            <>
              <CompareItemEditor
                value={block.item}
                onChange={(item) => onChange({ ...block, item })}
                projectId={projectId}
                hintKind={block.position === "full" ? "full" : "half"}
              />
              <PositionSelect value={block.position} onChange={(position) => onChange({ ...block, position })} />
            </>
          )}

          {block.type === "columns" && (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <RatioSelect value={block.ratio ?? "1:1"} onChange={(ratio) => onChange({ ...block, ratio })} />
                </div>
                <button
                  onClick={() => {
                    const flipped = block.ratio === "1:2" ? "2:1" : block.ratio === "2:1" ? "1:2" : "1:1";
                    onChange({ ...block, left: block.right, right: block.left, ratio: flipped });
                  }}
                  className="flex items-center gap-1.5 border border-border px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors shrink-0"
                >
                  <ArrowLeftRight size={12} /> Inverser
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Colonne gauche</Label>
                  <div className="border border-border p-3">
                    <ColumnEditor value={block.left} onChange={(left) => onChange({ ...block, left })} projectId={projectId} />
                  </div>
                </div>
                <div>
                  <Label>Colonne droite</Label>
                  <div className="border border-border p-3">
                    <ColumnEditor value={block.right} onChange={(right) => onChange({ ...block, right })} projectId={projectId} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {block.type === "masonry" && (
            <div className="space-y-3">
              {block.items.map((item, i) => (
                <div key={i} className="border border-border p-3">
                  <MediaItemEditor
                    value={item}
                    onChange={(updated) => {
                      const items = [...block.items];
                      items[i] = updated;
                      onChange({ ...block, items });
                    }}
                    projectId={projectId}
                    label={fileNameFromSrc(item.src) || `Image ${i + 1}`}
                    hintKind="masonry"
                    actions={
                      <div className="flex items-center border border-border overflow-hidden">
                        <button
                          onClick={() => {
                            if (i === 0) return;
                            const items = [...block.items];
                            [items[i - 1], items[i]] = [items[i], items[i - 1]];
                            onChange({ ...block, items });
                          }}
                          disabled={i === 0}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-25 disabled:hover:text-muted-foreground border-r border-border"
                          aria-label="Monter l'image"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => {
                            if (i === block.items.length - 1) return;
                            const items = [...block.items];
                            [items[i], items[i + 1]] = [items[i + 1], items[i]];
                            onChange({ ...block, items });
                          }}
                          disabled={i === block.items.length - 1}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-25 disabled:hover:text-muted-foreground border-r border-border"
                          aria-label="Descendre l'image"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                          aria-label="Supprimer l'image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    }
                  />
                </div>
              ))}
              <button onClick={() => onChange({ ...block, items: [...block.items, { src: "", alt: "", caption: emptyLS() }] })}
                className="w-full border border-dashed border-border py-2 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2">
                <Plus size={12} /> Ajouter une image
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BOUTON AJOUTER BLOC ───────────────────────────────────────────────────

const BLOCK_TYPES = [
  { type: "text", label: "Texte", icon: <Type size={14} /> },
  { type: "image", label: "Image", icon: <ImageIcon size={14} /> },
  { type: "video", label: "Vidéo", icon: <Video size={14} /> },
  { type: "youtube", label: "YouTube", icon: <Youtube size={14} /> },
  { type: "website", label: "Site web", icon: <Globe size={14} /> },
  { type: "compare", label: "Avant / Après", icon: <ChevronsLeftRight size={14} /> },
  { type: "columns", label: "Colonnes", icon: <Columns2 size={14} /> },
  { type: "masonry", label: "Masonry", icon: <LayoutGrid size={14} /> },
] as const;

function newBlock(type: string): DraftBlock {
  const base = { _uid: uid() };
  if (type === "text") return { ...base, type: "text", primary: emptyLS() };
  if (type === "image") return { ...base, type: "image", item: { src: "", alt: "", caption: emptyLS() }, position: "full" };
  if (type === "video") return { ...base, type: "video", item: { src: "", caption: emptyLS() }, position: "full" };
  if (type === "youtube") return { ...base, type: "youtube", url: "", position: "full" };
  if (type === "website") return { ...base, type: "website", url: "", item: { src: "", alt: "", caption: emptyLS() }, position: "full" };
  if (type === "compare") return { ...base, type: "compare", item: emptyCompare(), position: "full" };
  if (type === "columns") return { ...base, type: "columns", ratio: "1:1", left: { kind: "text", primary: emptyLS() }, right: { kind: "image", item: { src: "", alt: "", caption: emptyLS() } } };
  return { ...base, type: "masonry", items: [] };
}

function AddBlockMenu({ onAdd }: { onAdd: (b: DraftBlock) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full border border-dashed border-border py-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2">
        <Plus size={13} /> Ajouter un bloc
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-background z-10">
          {BLOCK_TYPES.map(({ type, label, icon }) => (
            <button key={type} onClick={() => { onAdd(newBlock(type)); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left">
              <span className="text-muted-foreground">{icon}</span>
              <span className="font-body text-[11px] tracking-widest uppercase">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PANNEAU MÉTADONNÉES ───────────────────────────────────────────────────

type PanelSectionId = "infos" | "cover" | "credits" | "publication";
const SECTION_DEFAULTS: Record<PanelSectionId, boolean> = { infos: true, cover: true, credits: true, publication: false };
const SECTIONS_STORAGE_KEY = "editor-meta-sections";

function useSectionsOpen() {
  const [open, setOpen] = useState<Record<PanelSectionId, boolean>>(() => {
    try {
      return { ...SECTION_DEFAULTS, ...JSON.parse(localStorage.getItem(SECTIONS_STORAGE_KEY) ?? "{}") };
    } catch {
      return SECTION_DEFAULTS;
    }
  });
  const toggle = (id: PanelSectionId) => setOpen((prev) => {
    const next = { ...prev, [id]: !prev[id] };
    try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
    return next;
  });
  return [open, toggle] as const;
}

function PanelSection({ title, badge, open, onToggle, children }: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary transition-colors">
        <span className="flex items-center gap-2 font-body text-[10px] tracking-[0.28em] uppercase">
          {title}
          {badge && <span className="px-1.5 py-0.5 text-[9px] tracking-wider text-white" style={{ background: "#0246F3" }}>{badge}</span>}
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && <div className="px-4 pb-5 pt-1 space-y-5">{children}</div>}
    </div>
  );
}

function MetaPanel({
  draft,
  onChange,
  projectId,
  categorySuggestions,
  tagSuggestions,
  onRenameCategoryEverywhere,
  onDeleteCategoryEverywhere,
  onRenameTagEverywhere,
  onDeleteTagEverywhere,
}: {
  draft: ProjectDraft;
  onChange: (d: ProjectDraft) => void;
  projectId: string;
  categorySuggestions: LS[];
  tagSuggestions: LS[];
  onRenameCategoryEverywhere: (target: LS, next: LS) => void;
  onDeleteCategoryEverywhere: (target: LS) => void;
  onRenameTagEverywhere: (target: LS, next: LS) => void;
  onDeleteTagEverywhere: (target: LS) => void;
}) {
  const { lang: titleLang } = useEditLang();
  const categoryLang = titleLang;
  const tagsLang = titleLang;
  const [tagInput, setTagInput] = useState("");
  const [sections, toggleSection] = useSectionsOpen();

  const otherTitleLang = titleLang === "fr" ? "en" : "fr";
  const otherCategoryLang = categoryLang === "fr" ? "en" : "fr";
  const otherTagsLang = tagsLang === "fr" ? "en" : "fr";

  const titleEditedRef = useRef({ fr: !!draft.title.fr, en: !!draft.title.en });
  const categoryEditedRef = useRef({ fr: !!draft.category.fr, en: !!draft.category.en });
  const tagsEditedRef = useRef<Record<number, { fr: boolean; en: boolean }>>({});

  const updateTitle = (value: string) => {
    titleEditedRef.current[titleLang] = true;
    const shouldMirror = !titleEditedRef.current[otherTitleLang];
    const nextTitle: LS = {
      ...draft.title,
      [titleLang]: value,
      ...(shouldMirror ? { [otherTitleLang]: value } : {}),
    };
    onChange({ ...draft, title: nextTitle });
  };

  const updateTag = (index: number, value: string) => {
    if (!tagsEditedRef.current[index]) {
      const current = draft.tags[index];
      tagsEditedRef.current[index] = { fr: !!current.fr, en: !!current.en };
    }
    tagsEditedRef.current[index][tagsLang] = true;
    const shouldMirror = !tagsEditedRef.current[index][otherTagsLang];

    const nextTags = [...draft.tags];
    const current = nextTags[index];
    nextTags[index] = {
      ...current,
      [tagsLang]: value,
      ...(shouldMirror ? { [otherTagsLang]: value } : {}),
    };
    onChange({ ...draft, tags: nextTags });
  };

  const updateCategory = (value: string) => {
    categoryEditedRef.current[categoryLang] = true;
    const shouldMirror = !categoryEditedRef.current[otherCategoryLang];
    const nextCategory: LS = {
      ...draft.category,
      [categoryLang]: value,
      ...(shouldMirror ? { [otherCategoryLang]: value } : {}),
    };
    onChange({ ...draft, category: nextCategory });
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) {
      setTagInput("");
      return;
    }
    const exists = draft.tags.some((tag) =>
      tag.fr.toLowerCase() === t.toLowerCase() || tag.en.toLowerCase() === t.toLowerCase()
    );
    if (!exists) {
      onChange({ ...draft, tags: [...draft.tags, { fr: t, en: t }] });
    }
    setTagInput("");
  };

  const renameCategoryEverywhere = (target: LS) => {
    const next = prompt(`Nouveau nom ${categoryLang.toUpperCase()} de la categorie`, target[categoryLang]);
    if (next === null) return;
    onRenameCategoryEverywhere(target, { ...target, [categoryLang]: next.trim() });
  };

  const renameTagEverywhere = (target: LS) => {
    const next = prompt(`Nouveau nom ${tagsLang.toUpperCase()} du tag`, target[tagsLang]);
    if (next === null) return;
    onRenameTagEverywhere(target, { ...target, [tagsLang]: next.trim() });
  };

  const visibleCategorySuggestions = categorySuggestions
    .filter((c) => !isSameLS(c, draft.category))
    .filter((c, i, arr) => {
      const label = (c[categoryLang] || c[otherCategoryLang] || "").trim().toLowerCase();
      return arr.findIndex((x) => ((x[categoryLang] || x[otherCategoryLang] || "").trim().toLowerCase() === label)) === i;
    });

  const visibleTagSuggestions = tagSuggestions
    .filter((t, i, arr) => {
      const label = (t[tagsLang] || t[otherTagsLang] || "").trim().toLowerCase();
      return arr.findIndex((x) => ((x[tagsLang] || x[otherTagsLang] || "").trim().toLowerCase() === label)) === i;
    });

  return (
    <div>
      <PanelSection title="Informations" open={sections.infos} onToggle={() => toggleSection("infos")}>
        <div>
          <Label>Titre</Label>
          <Input value={draft.title[titleLang]} onChange={updateTitle} placeholder={titleLang === "fr" ? "Titre du projet" : "Project title"} />
        </div>
        <div>
          <Label>Categorie</Label>
          <Input value={draft.category[categoryLang]} onChange={updateCategory} placeholder={categoryLang === "fr" ? "Categorie francaise" : "English category"} />
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleCategorySuggestions.map((c) => (
              <div key={`${c.fr}-${c.en}`} className="inline-flex items-center border border-border/50 hover:border-primary transition-colors">
                <button onClick={() => onChange({ ...draft, category: c })}
                  className="font-body text-[9px] tracking-wider uppercase text-muted-foreground px-1.5 py-0.5 hover:text-primary transition-colors">
                  {c[categoryLang] || c[otherCategoryLang]}
                </button>
                <button onClick={() => renameCategoryEverywhere(c)} className="px-1 py-0.5 text-muted-foreground hover:text-primary transition-colors" aria-label="Renommer categorie">
                  <Pencil size={9} />
                </button>
                <button onClick={() => onDeleteCategoryEverywhere(c)} className="px-1 py-0.5 text-muted-foreground hover:text-red-500 transition-colors" aria-label="Supprimer categorie">
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Année</Label>
            <Input value={draft.year} onChange={(year) => onChange({ ...draft, year })} placeholder="2024" />
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <div className="space-y-1.5 mb-2">
            {draft.tags.map((tag, i) => (
              <div key={`tag-row-${i}`} className="flex items-center gap-2">
                <Input value={tag[tagsLang]} onChange={(value) => updateTag(i, value)} placeholder={tagsLang === "fr" ? "Tag français" : "English tag"} className="flex-1" />
                <button onClick={() => onChange({ ...draft, tags: draft.tags.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-red-500 ml-0.5 shrink-0">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={setTagInput} placeholder="Nouveau tag…"
              className="flex-1" />
            <button onClick={addTag}
              className="border border-border px-3 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Plus size={13} />
            </button>
          </div>
          {/* Common tags */}
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleTagSuggestions.map((t) => (
              <div key={`${t.fr}-${t.en}`} className="inline-flex items-center border border-border/50 hover:border-primary transition-colors">
                <button onClick={() => {
                  if (draft.tags.some((tag) => isSameLS(tag, t))) return;
                  onChange({ ...draft, tags: [...draft.tags, t] });
                }}
                  className="font-body text-[9px] tracking-wider uppercase text-muted-foreground px-1.5 py-0.5 hover:text-primary transition-colors">
                  + {t[tagsLang] || t[otherTagsLang]}
                </button>
                <button onClick={() => renameTagEverywhere(t)} className="px-1 py-0.5 text-muted-foreground hover:text-primary transition-colors" aria-label="Renommer tag">
                  <Pencil size={9} />
                </button>
                <button onClick={() => onDeleteTagEverywhere(t)} className="px-1 py-0.5 text-muted-foreground hover:text-red-500 transition-colors" aria-label="Supprimer tag">
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <BilingualTextarea label="Présentation (carte + page projet)" value={draft.excerpt} onChange={(excerpt) => onChange({ ...draft, excerpt })} rows={3} />
      </PanelSection>

      <PanelSection title="Couverture" open={sections.cover} onToggle={() => toggleSection("cover")}>
        <ImageUpload src={draft.coverImage} onChange={(coverImage) => onChange({ ...draft, coverImage })} projectId={projectId} label="Image de couverture" hintKind="cover" />

        {draft.coverImage && (
          <div>
            <Label>Position verticale de la couverture</Label>
            <div className="relative w-full bg-muted overflow-hidden border border-border" style={{ aspectRatio: "16 / 7" }}>
              <img
                src={draft.coverImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: `50% ${draft.coverImagePosition ?? 50}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-body text-[9px] tracking-widest uppercase text-muted-foreground shrink-0">Haut</span>
              <input
                type="range"
                min={0}
                max={100}
                value={draft.coverImagePosition ?? 50}
                onChange={(e) => onChange({ ...draft, coverImagePosition: Number(e.target.value) })}
                className="w-full accent-[#0246F3]"
              />
              <span className="font-body text-[9px] tracking-widest uppercase text-muted-foreground shrink-0">Bas</span>
            </div>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Mentions" open={sections.credits} onToggle={() => toggleSection("credits")}>
        <div>
          <BilingualTextarea label="Droits, crédits (optionnel)" value={draft.credits ?? emptyLS()} onChange={(credits) => onChange({ ...draft, credits })} rows={2} />
          <p className="font-body text-[10px] text-muted-foreground mt-1">Affiché en tête du projet, avant le premier bloc.</p>
        </div>
      </PanelSection>

      <PanelSection title="Publication" badge={draft.hidden ? "Masqué" : undefined} open={sections.publication} onToggle={() => toggleSection("publication")}>
        <div>
          <Label>Visibilité</Label>
          <div className="flex border border-border overflow-hidden">
            {[{ v: false, label: "Visible" }, { v: true, label: "Masqué" }].map(({ v, label }) => (
              <button key={label} onClick={() => onChange({ ...draft, hidden: v })}
                className="flex-1 py-1.5 font-body text-[10px] tracking-wider uppercase transition-colors"
                style={{ background: (draft.hidden ?? false) === v ? "#0246F3" : "transparent", color: (draft.hidden ?? false) === v ? "#fff" : "var(--muted-foreground)" }}>
                {label}
              </button>
            ))}
          </div>
          {(draft.hidden ?? false) && (
            <p className="mt-1.5 font-body text-[9px] tracking-wide text-muted-foreground">
              Ce projet reste modifiable ici mais n'apparaît pas sur le site public.
            </p>
          )}
        </div>
        <div>
          <Label>Ordre</Label>
          <Input value={draft.index} onChange={() => {}} placeholder="Automatique" readOnly />
          <p className="mt-1.5 font-body text-[9px] tracking-wide text-muted-foreground">Se règle en glissant les projets dans la liste.</p>
        </div>
        <div>
          <Label>ID (slug URL)</Label>
          <Input value={draft.id} onChange={(id) => onChange({ ...draft, id: id.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="nom-du-projet" />
        </div>
      </PanelSection>
    </div>
  );
}

function LandingPanel({ draft, onChange }: {
  draft: LandingContent;
  onChange: (d: LandingContent) => void;
}) {
  const { lang } = useEditLang();
  const locale = draft[lang];
  const otherLang = lang === "fr" ? "en" : "fr";
  const otherLocale = draft[otherLang];
  const editedRef = useRef<Partial<Record<string, { fr: boolean; en: boolean }>>>({});

  const updateField = (field: keyof LandingContent["fr"], value: string) => {
    if (!editedRef.current[field]) {
      editedRef.current[field] = { fr: !!draft.fr[field], en: !!draft.en[field] };
    }
    const flags = editedRef.current[field]!;
    flags[lang] = true;
    const shouldMirror = !flags[otherLang];

    onChange({
      ...draft,
      [lang]: {
        ...locale,
        [field]: value,
      },
      ...(shouldMirror
        ? {
            [otherLang]: {
              ...otherLocale,
              [field]: value,
            },
          }
        : {}),
    });
  };

  const updateList = (field: "skillsList" | "toolsList", value: string) => {
    const next = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!editedRef.current[field]) {
      editedRef.current[field] = { fr: draft.fr[field].length > 0, en: draft.en[field].length > 0 };
    }
    const flags = editedRef.current[field]!;
    flags[lang] = true;
    const shouldMirror = !flags[otherLang];

    onChange({
      ...draft,
      [lang]: {
        ...locale,
        [field]: next,
      },
      ...(shouldMirror
        ? {
            [otherLang]: {
              ...otherLocale,
              [field]: next,
            },
          }
        : {}),
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-body text-[10px] tracking-[0.28em] uppercase text-muted-foreground">Contenu Landing</span>
      </div>

      <div>
        <Label>Disponibilité</Label>
        <Input value={locale.availability ?? ""} onChange={(v) => updateField("availability", v)} placeholder="Disponible dès maintenant pour un CDI." />
        <p className="font-body text-[10px] text-muted-foreground mt-1">Remplace la tagline sous le nom. Laisser vide pour réafficher la tagline.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lien CV</Label>
          <Input value={locale.cv ?? ""} onChange={(v) => updateField("cv", v)} placeholder="Télécharger le CV" />
          <p className="font-body text-[10px] text-muted-foreground mt-1">Le lien n'apparaît dans Contact que si un PDF est défini.</p>
        </div>
        <PdfUpload label="Fichier CV (PDF)" src={locale.cvFile ?? ""} onChange={(v) => updateField("cvFile", v)} folder="cv" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Titre</Label>
          <Input value={locale.title} onChange={(v) => updateField("title", v)} />
        </div>
        <div>
          <Label>Localisation</Label>
          <Input value={locale.location} onChange={(v) => updateField("location", v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Label Portfolio</Label>
          <Input value={locale.portfolio} onChange={(v) => updateField("portfolio", v)} />
        </div>
        <div>
          <Label>Tagline</Label>
          <Input value={locale.tagline} onChange={(v) => updateField("tagline", v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Bouton Projets</Label>
          <Input value={locale.viewProjects} onChange={(v) => updateField("viewProjects", v)} />
        </div>
        <div>
          <Label>Pattern Titre Projets</Label>
          <Input value={locale.selectedWorksPattern} onChange={(v) => updateField("selectedWorksPattern", v)} placeholder="Ex : Projets : {count}" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>About</Label>
          <Input value={locale.about} onChange={(v) => updateField("about", v)} />
        </div>
        <div>
          <Label>Contact</Label>
          <Input value={locale.contact} onChange={(v) => updateField("contact", v)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Projects</Label>
          <Input value={locale.projects} onChange={(v) => updateField("projects", v)} />
        </div>
        <div>
          <Label>Back</Label>
          <Input value={locale.back} onChange={(v) => updateField("back", v)} />
        </div>
        <div>
          <Label>Next project</Label>
          <Input value={locale.nextProject} onChange={(v) => updateField("nextProject", v)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Gallery</Label>
          <Input value={locale.gallery} onChange={(v) => updateField("gallery", v)} />
        </div>
        <div>
          <Label>Year</Label>
          <Input value={locale.year} onChange={(v) => updateField("year", v)} />
        </div>
        <div>
          <Label>Tags</Label>
          <Input value={locale.tags} onChange={(v) => updateField("tags", v)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Overview (fiche projet)</Label>
          <Input value={locale.overview} onChange={(v) => updateField("overview", v)} />
        </div>
        <div>
          <Label>Skills</Label>
          <Input value={locale.skills} onChange={(v) => updateField("skills", v)} />
        </div>
        <div>
          <Label>Tools</Label>
          <Input value={locale.tools} onChange={(v) => updateField("tools", v)} />
        </div>
      </div>

      <div>
        <Label>CTA Contact</Label>
        <Input value={locale.together} onChange={(v) => updateField("together", v)} />
      </div>

      <div>
        <Label>Bio</Label>
        <Textarea value={locale.bio} onChange={(v) => updateField("bio", v)} rows={6} />
      </div>

      <div>
        <Label>Bio 2</Label>
        <Textarea value={locale.bio2} onChange={(v) => updateField("bio2", v)} rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Liste compétences (1 par ligne)</Label>
          <Textarea value={locale.skillsList.join("\n")} onChange={(v) => updateList("skillsList", v)} rows={6} />
        </div>
        <div>
          <Label>Liste outils (1 par ligne)</Label>
          <Textarea value={locale.toolsList.join("\n")} onChange={(v) => updateList("toolsList", v)} rows={6} />
        </div>
      </div>

      <div>
        <Label>Message aucun projet</Label>
        <Input value={locale.noProjects} onChange={(v) => updateField("noProjects", v)} />
      </div>

      <div className="pt-6 border-t border-border space-y-4">
        <span className="font-body text-[10px] tracking-[0.28em] uppercase text-muted-foreground block">Contact (partagé FR/EN)</span>

        <div>
          <Label>Nom (footer)</Label>
          <Input value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input value={draft.email} onChange={(email) => onChange({ ...draft, email })} placeholder="vous@exemple.com" />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={draft.phone} onChange={(phone) => onChange({ ...draft, phone })} placeholder="+33 6 12 34 56 78" />
          </div>
        </div>

        <div>
          <Label>Liens (LinkedIn, Instagram, Behance…)</Label>
          <div className="space-y-1.5 mt-1">
            {draft.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={link.label}
                  onChange={(label) => {
                    const links = [...draft.links];
                    links[i] = { ...links[i], label };
                    onChange({ ...draft, links });
                  }}
                  placeholder="Label (ex: Instagram)"
                  className="flex-[2] min-w-0"
                />
                <Input
                  value={link.url}
                  onChange={(url) => {
                    const links = [...draft.links];
                    links[i] = { ...links[i], url };
                    onChange({ ...draft, links });
                  }}
                  placeholder="https://…"
                  className="flex-[3] min-w-0"
                />
                <button
                  onClick={() => onChange({ ...draft, links: draft.links.filter((_, j) => j !== i) })}
                  className="text-muted-foreground hover:text-red-500 shrink-0"
                  aria-label="Supprimer le lien"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => onChange({ ...draft, links: [...draft.links, { label: "", url: "" }] })}
            className="w-full mt-2 border border-dashed border-border py-2 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={12} /> Ajouter un lien
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ÉDITEUR PRINCIPAL ─────────────────────────────────────────────────────

// ─── PUBLICATION ───────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function describeFile(f: PublishFile): { group: "projects" | "landing" | "cv" | "media" | "other"; label: string } {
  if (f.path === "src/data/landing.json") return { group: "landing", label: "Page d'accueil" };
  if (f.path.startsWith("src/data/projects/")) return { group: "projects", label: f.title ?? f.path.split("/").pop()! };
  if (f.path.startsWith("public/projects/cv/")) return { group: "cv", label: f.path.split("/").pop()! };
  if (f.path.startsWith("public/projects/")) return { group: "media", label: f.path.replace("public/projects/", "") };
  return { group: "other", label: f.path };
}

const STATUS_WORD = { added: "Nouveau", modified: "Modifié", deleted: "Supprimé" } as const;
const GROUP_TITLES = { projects: "Projets", landing: "Page d'accueil", cv: "CV", media: "Images et vidéos", other: "Autres contenus" } as const;

function suggestMessage(files: PublishFile[]): string {
  const described = files.map(describeFile);
  const parts = [
    ...described.filter((d) => d.group === "projects").map((d) => d.label),
    ...(described.some((d) => d.group === "landing") ? ["page d'accueil"] : []),
    ...(described.some((d) => d.group === "cv") ? ["CV"] : []),
  ];
  const media = described.filter((d) => d.group === "media").length;
  if (!parts.length && media) parts.push(`${media} média${media > 1 ? "s" : ""}`);
  return parts.length ? `Edited : ${[...new Set(parts)].join(", ")}` : "Content edited";
}

function PublishDialog({ unsavedNames, onClose, onPublished }: {
  unsavedNames: string[];
  onClose: () => void;
  onPublished: (lastPublished: string) => void;
}) {
  const [state, setState] = useState<PublishState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [result, setResult] = useState("");
  const [showMedia, setShowMedia] = useState(false);

  useEffect(() => {
    apiPublishStatus(true)
      .then((s) => { setState(s); setMessage(suggestMessage(s.files)); })
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && phase !== "publishing") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose, phase]);

  const publish = async () => {
    setPhase("publishing");
    try {
      const r = await apiPublish(message);
      setResult(r.commit);
      setPhase("done");
      onPublished(r.lastPublished);
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const groups = state
    ? (Object.keys(GROUP_TITLES) as (keyof typeof GROUP_TITLES)[])
        .map((g) => ({ g, items: state.files.map((f) => ({ f, d: describeFile(f) })).filter(({ d }) => d.group === g) }))
        .filter(({ items }) => items.length)
    : [];
  const nothing = state && !state.files.length && !state.ahead;
  const blocked = !!state && (state.blockers.length > 0 || unsavedNames.length > 0 || state.offline || !!nothing || !message.trim());

  const sectionTitle = "font-body text-[10px] tracking-[0.28em] uppercase text-muted-foreground mb-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-6" onClick={() => phase !== "publishing" && onClose()}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-background border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-display font-black uppercase tracking-tight text-lg">Publier sur le site</span>
          <button onClick={onClose} disabled={phase === "publishing"} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Fermer">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!state && !loadError && (
            <p className="flex items-center gap-2 font-body text-[11px] text-muted-foreground"><LoaderCircle size={13} className="animate-spin" /> Vérification avec GitHub…</p>
          )}
          {loadError && <p className="font-body text-[11px] text-red-500 whitespace-pre-line">{loadError}</p>}

          {phase === "done" && (
            <div className="flex items-start gap-2 border border-green-500/40 bg-green-500/10 px-3 py-3">
              <CircleCheck size={15} className="text-green-500 shrink-0 mt-px" />
              <p className="text-sm">Envoyé ! Le site sera à jour d'ici une à deux minutes. <span className="font-body text-[10px] text-muted-foreground">({result})</span></p>
            </div>
          )}
          {phase === "error" && (
            <div className="flex items-start gap-2 border border-red-500/40 bg-red-500/10 px-3 py-3">
              <TriangleAlert size={15} className="text-red-500 shrink-0 mt-px" />
              <p className="text-sm whitespace-pre-line">{result}</p>
            </div>
          )}

          {state && phase !== "done" && (
            <>
              {(unsavedNames.length > 0 || state.blockers.length > 0) && (
                <div className="border border-red-500/40 bg-red-500/10 px-3 py-3 space-y-1.5">
                  {unsavedNames.length > 0 && (
                    <p className="text-sm">Modifications non enregistrées dans l'éditeur : <strong>{unsavedNames.join(", ")}</strong>. Clique sur « Enregistrer » avant de publier.</p>
                  )}
                  {state.blockers.map((b) => <p key={b} className="text-sm whitespace-pre-line">{b}</p>)}
                </div>
              )}
              {state.warnings.length > 0 && (
                <div className="border border-amber-500/40 bg-amber-500/10 px-3 py-3 space-y-1.5">
                  {state.warnings.map((w) => <p key={w} className="flex items-start gap-2 text-sm"><TriangleAlert size={13} className="text-amber-500 shrink-0 mt-0.5" />{w}</p>)}
                </div>
              )}

              {nothing ? (
                <p className="text-sm text-muted-foreground">Rien à publier : le site en ligne est déjà à jour.</p>
              ) : (
                <div className="space-y-4">
                  <span className={sectionTitle}>Ce qui va être mis en ligne</span>
                  {groups.map(({ g, items }) => (
                    <div key={g}>
                      <div className="text-sm font-medium mb-1">{GROUP_TITLES[g]}{g === "media" && ` (${items.length})`}</div>
                      {(g !== "media" || showMedia || items.length <= 4 ? items : items.slice(0, 4)).map(({ f, d }) => (
                        <div key={f.path} className="flex items-center justify-between gap-3 py-0.5">
                          <span className="text-sm truncate">{d.label}</span>
                          <span className="shrink-0 font-body text-[9px] tracking-wider uppercase text-muted-foreground">
                            {STATUS_WORD[f.status]}{f.sizeMB !== null && g !== "projects" && g !== "landing" ? ` · ${f.sizeMB < 1 ? `${Math.round(f.sizeMB * 1024)} Ko` : `${f.sizeMB.toFixed(1)} Mo`}` : ""}
                          </span>
                        </div>
                      ))}
                      {g === "media" && items.length > 4 && (
                        <button onClick={() => setShowMedia((v) => !v)} className="font-body text-[10px] tracking-wider uppercase text-primary mt-1">
                          {showMedia ? "Réduire" : `Voir les ${items.length}`}
                        </button>
                      )}
                    </div>
                  ))}
                  {state.unpublishedContent.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1">Déjà enregistré sur ton Mac, pas encore en ligne</div>
                      {state.unpublishedContent.map((m) => <div key={m} className="text-sm text-muted-foreground truncate">{m}</div>)}
                    </div>
                  )}
                </div>
              )}

              {state.outside.length > 0 && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-body text-[10px] tracking-wider uppercase">Non publié : {state.outside.length} fichier{state.outside.length > 1 ? "s" : ""} du code du site</summary>
                  <p className="mt-2">Ces fichiers ne partent jamais depuis l'éditeur, pour ne pas risquer de casser le site.</p>
                  {state.outside.map((o) => <div key={o} className="font-body text-[10px] truncate">{o}</div>)}
                </details>
              )}

              {!nothing && (
                <div>
                  <Label>Description de la mise à jour</Label>
                  <Input value={message} onChange={setMessage} placeholder="Ex : Ajout du projet Beyond" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border">
          <span className="font-body text-[10px] tracking-wider text-muted-foreground">Dernière publication : {formatDate(state?.lastPublished ?? null)}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={phase === "publishing"}
              className="border border-border px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40">
              {phase === "done" ? "Fermer" : "Annuler"}
            </button>
            {phase !== "done" && (
              <button onClick={publish} disabled={blocked || phase === "publishing"}
                className="flex items-center gap-2 px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-white transition-opacity disabled:opacity-40"
                style={{ background: "linear-gradient(to right, #0246F3, #4A7DF1)" }}>
                {phase === "publishing" ? <LoaderCircle size={12} className="animate-spin" /> : <CloudUpload size={12} />}
                {phase === "publishing" ? "Publication…" : phase === "error" ? "Réessayer" : "Publier"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Editor() {
  const [editLang, setEditLang] = useState<"fr" | "en">("fr");
  const [mode, setMode] = useState<EditorMode>(() => {
    const saved = sessionStorage.getItem("editor-mode");
    return saved === "landing" || saved === "project" ? saved : "project";
  });
  const [projects, setProjects] = useState<ProjectDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => sessionStorage.getItem("editor-selected-id"));
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [landingDraft, setLandingDraft] = useState<LandingContent | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragProjectIndex, setDragProjectIndex] = useState<number | null>(null);
  const [dropProjectIndex, setDropProjectIndex] = useState<number | null>(null);
  const isProjectDragging = useRef(false);
  // Version de chaque fichier telle que lue ou écrite par l'éditeur, et contenu de référence
  // pour savoir ce qui a changé : seuls les projets modifiés sont enregistrés.
  const versions = useRef<Record<string, FileVersion>>({});
  const [baselines, setBaselines] = useState<Record<string, string>>({});
  const landingVersion = useRef<FileVersion>(null);
  const [landingBaseline, setLandingBaseline] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Charger les projets existants
  useEffect(() => {
    apiList().then((entries) => {
      entries.forEach(({ project, version }) => { versions.current[project.id] = version; });
      const data = entries.map((e) => e.project);
      const sorted = [...data].sort((a, b) => a.index.localeCompare(b.index));
      const drafts = withAutoIndex(sorted.map((p) => ({
        ...p,
        title: toLS(p.title),
        category: toLS(p.category),
        tags: (p.tags ?? []).map((tag) => toLS(tag)),
        content: p.content.map((b) => ({ ...b, _uid: uid() } as DraftBlock)),
      })));
      setBaselines(Object.fromEntries(drafts.map((p) => [p.id, serializeDraft(p)])));
      setProjects(drafts);

      // Restaure le projet sélectionné avant un éventuel rechargement de page
      // (Vite recharge la page quand la sauvegarde modifie src/data/projects/*.json)
      const savedId = sessionStorage.getItem("editor-selected-id");
      if (savedId) {
        const match = drafts.find((p) => p.id === savedId);
        if (match) {
          setDraft(JSON.parse(JSON.stringify(match)));
          setSelectedId(match.id);
        } else {
          sessionStorage.removeItem("editor-selected-id");
          setSelectedId(null);
        }
      }
    });
    apiGetLanding().then(({ landing, version }) => {
      landingVersion.current = version;
      setLandingDraft(landing);
      setLandingBaseline(JSON.stringify(landing));
    });
    apiPublishStatus(false).then((s) => setLastPublished(s.lastPublished)).catch(() => {});
  }, []);

  useEffect(() => {
    sessionStorage.setItem("editor-mode", mode);
  }, [mode]);

  useEffect(() => {
    if (selectedId) sessionStorage.setItem("editor-selected-id", selectedId);
    else sessionStorage.removeItem("editor-selected-id");
  }, [selectedId]);

  const selectProject = (d: ProjectDraft) => {
    setDraft(JSON.parse(JSON.stringify(d)));
    setSelectedId(d.id);
    setStatus("idle");
  };

  const createNew = () => {
    const p = newProject();
    setProjects((prev) => {
      const normalized = withAutoIndex([...prev, p]);
      const created = normalized.find((x) => x.id === p.id) ?? p;
      setDraft(JSON.parse(JSON.stringify(created)));
      setSelectedId(created.id);
      return normalized;
    });
    setStatus("idle");
  };

  const updateDraft = useCallback((d: ProjectDraft) => {
    setDraft(d);
    setStatus("idle");
  }, []);

  const projectMatchId = selectedId ?? draft?.id ?? null;
  const effectiveProjects = draft && projectMatchId
    ? projects.map((p) => (p.id === projectMatchId ? draft : p))
    : projects;

  const categorySuggestions = effectiveProjects
    .map((p) => p.category)
    .filter((c) => c.fr.trim() || c.en.trim())
    .filter((c, i, arr) => arr.findIndex((x) => isSameLS(x, c)) === i);

  const tagSuggestions = effectiveProjects
    .flatMap((p) => p.tags)
    .filter((t) => t.fr.trim() || t.en.trim())
    .filter((t, i, arr) => arr.findIndex((x) => isSameLS(x, t)) === i);

  const onRenameCategoryEverywhere = (target: LS, next: LS) => {
    if (!next.fr && !next.en) return;
    const updated = projects.map((p) => (isSameLS(p.category, target) ? { ...p, category: next } : p));
    setProjects(updated);
    setDraft((current) => {
      if (!current) return current;
      return isSameLS(current.category, target) ? { ...current, category: next } : current;
    });
    setStatus("idle");
  };

  const onDeleteCategoryEverywhere = (target: LS) => {
    if (!confirm(`Supprimer la categorie \"${target.fr || target.en}\" de tous les projets ?`)) return;
    const cleared = { fr: "", en: "" };
    const updated = projects.map((p) => (isSameLS(p.category, target) ? { ...p, category: cleared } : p));
    setProjects(updated);
    setDraft((current) => {
      if (!current) return current;
      return isSameLS(current.category, target) ? { ...current, category: cleared } : current;
    });
    setStatus("idle");
  };

  const onRenameTagEverywhere = (target: LS, next: LS) => {
    if (!next.fr && !next.en) return;
    const updated = projects.map((p) => ({
      ...p,
      tags: p.tags.map((tag) => (isSameLS(tag, target) ? next : tag)),
    }));
    setProjects(updated);
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tags: current.tags.map((tag) => (isSameLS(tag, target) ? next : tag)),
      };
    });
    setStatus("idle");
  };

  const onDeleteTagEverywhere = (target: LS) => {
    if (!confirm(`Supprimer le tag \"${target.fr || target.en}\" de tous les projets ?`)) return;
    const updated = projects.map((p) => ({
      ...p,
      tags: p.tags.filter((tag) => !isSameLS(tag, target)),
    }));
    setProjects(updated);
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tags: current.tags.filter((tag) => !isSameLS(tag, target)),
      };
    });
    setStatus("idle");
  };

  // Enregistre les projets dont le contenu diffère de la version de référence.
  // Si un fichier a changé sur le disque depuis sa lecture, on demande avant d'écraser.
  const persistProjects = async (list: ProjectDraft[]): Promise<boolean> => {
    const changed = list.filter((p) => baselines[p.id] === undefined || serializeDraft(p) !== baselines[p.id]);
    const saved: ProjectDraft[] = [];
    const conflicts: ProjectDraft[] = [];
    let failed = false;

    const saveOne = async (p: ProjectDraft, force = false) => {
      versions.current[p.id] = await apiSave(draftToProject(p), versions.current[p.id] ?? null, force);
      saved.push(p);
    };

    await Promise.all(changed.map((p) => saveOne(p).catch((e) => {
      if (e instanceof ConflictError) conflicts.push(p);
      else failed = true;
    })));

    // Identifiant déjà pris par un autre projet : jamais d'écrasement
    const slugTaken = conflicts.filter((p) => !(p.id in versions.current));
    const modifiedOutside = conflicts.filter((p) => p.id in versions.current);
    if (slugTaken.length) {
      alert(`Un autre projet utilise déjà l'identifiant « ${slugTaken.map((p) => p.id).join(", ")} ». Choisis un autre slug.`);
      failed = true;
    }
    if (modifiedOutside.length) {
      const names = modifiedOutside.map((p) => displayLS(p.title)).join(", ");
      const overwrite = confirm(
        `${names} : modifié en dehors de l'éditeur depuis son ouverture (traduction, modification manuelle…).\n\n` +
        `OK : remplacer par la version de l'éditeur (les changements faits ailleurs seront perdus).\n` +
        `Annuler : ne pas enregistrer ce projet. Recharge ensuite la page pour récupérer la version à jour (copie d'abord tes modifications).`
      );
      if (overwrite) {
        await Promise.all(modifiedOutside.map((p) => saveOne(p, true).catch(() => { failed = true; })));
      } else {
        failed = true;
      }
    }

    if (saved.length) setBaselines((prev) => ({ ...prev, ...Object.fromEntries(saved.map((p) => [p.id, serializeDraft(p)])) }));
    return !failed && saved.length === changed.length;
  };

  const deleteProjectFile = async (id: string): Promise<boolean> => {
    try {
      await apiDelete(id, versions.current[id] ?? null);
    } catch (e) {
      if (!(e instanceof ConflictError)) return false;
      if (!confirm(`Le fichier du projet « ${id} » a été modifié en dehors de l'éditeur depuis son ouverture. Le supprimer quand même ?`)) return false;
      await apiDelete(id, null, true);
    }
    delete versions.current[id];
    setBaselines((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
  };

  const save = async () => {
    if (mode === "project" && !draft) return;
    if (mode === "landing" && !landingDraft) return;
    setStatus("saving");
    try {
      if (mode === "landing") {
        if (!landingDraft) return;
        try {
          landingVersion.current = await apiSaveLanding(landingDraft, landingVersion.current);
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e;
          const overwrite = confirm(
            "La page d'accueil a été modifiée en dehors de l'éditeur depuis son ouverture.\n\n" +
            "OK : remplacer par la version de l'éditeur (les changements faits ailleurs seront perdus).\n" +
            "Annuler : ne pas enregistrer. Recharge ensuite la page pour récupérer la version à jour."
          );
          if (!overwrite) { setStatus("error"); return; }
          landingVersion.current = await apiSaveLanding(landingDraft, null, true);
        }
        setLandingBaseline(JSON.stringify(landingDraft));
      } else if (draft) {
        const previousId = selectedId ?? draft.id;
        const slugChanged = previousId !== draft.id;
        const updatedProjects = withAutoIndex(
          projects.map((p) => (p.id === previousId ? draft : p))
        );

        const ok = await persistProjects(updatedProjects);
        if (!ok) { setStatus("error"); return; }
        if (slugChanged && !(await deleteProjectFile(previousId))) { setStatus("error"); return; }

        setProjects(updatedProjects);
        const refreshedDraft = updatedProjects.find((p) => p.id === draft.id) ?? draft;
        setDraft(JSON.parse(JSON.stringify(refreshedDraft)));
        setSelectedId(draft.id);
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Supprimer ce projet ?")) return;
    if (!(await deleteProjectFile(id))) return;
    setProjects((prev) => withAutoIndex(prev.filter((p) => p.id !== id)));
    if (selectedId === id) { setDraft(null); setSelectedId(null); }
  };

  // Modifications pas encore enregistrées (bloquent la publication)
  const unsavedNames = [
    ...effectiveProjects
      .filter((p) => {
        const key = draft && p === draft ? (selectedId ?? p.id) : p.id;
        return baselines[key] === undefined || serializeDraft(p) !== baselines[key];
      })
      .map((p) => displayLS(p.title)),
    ...(landingDraft && landingBaseline !== null && JSON.stringify(landingDraft) !== landingBaseline ? ["Page d'accueil"] : []),
  ];
  const hasUnsaved = unsavedNames.length > 0;

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  const copyText = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(projectToPlainText(draft, editLang));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Impossible d'accéder au presse-papiers.");
    }
  };

  const preview = () => {
    if (mode === "landing") {
      window.open(`/`, "_blank");
      return;
    }
    if (!draft) return;
    localStorage.setItem("editor-preview", JSON.stringify(draftToProject(draft)));
    window.open(`/?preview=editor`, "_blank");
  };

  // Drag to reorder blocks — tracks the gap (not the item) the cursor is nearest to,
  // so a line can indicate exactly where the block will land.
  const handleDragStart = (i: number) => { setDragIndex(i); };
  const handleBlockDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropIndex(e.clientY < midpoint ? i : i + 1);
  };
  const handleDragEnd = () => { setDragIndex(null); setDropIndex(null); };
  const handleDrop = () => {
    if (!draft || dragIndex === null || dropIndex === null) { handleDragEnd(); return; }
    const content = [...draft.content];
    const [removed] = content.splice(dragIndex, 1);
    const insertAt = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
    content.splice(insertAt, 0, removed);
    handleDragEnd();
    updateDraft({ ...draft, content });
  };

  const updateBlock = (i: number, b: DraftBlock) => {
    if (!draft) return;
    const content = [...draft.content];
    content[i] = b;
    updateDraft({ ...draft, content });
  };

  const deleteBlock = (i: number) => {
    if (!draft) return;
    updateDraft({ ...draft, content: draft.content.filter((_, j) => j !== i) });
  };

  const duplicateBlock = (i: number) => {
    if (!draft) return;
    const copy: DraftBlock = { ...draft.content[i], _uid: uid() };
    const content = [...draft.content];
    content.splice(i + 1, 0, copy);
    updateDraft({ ...draft, content });
  };

  const addBlock = (b: DraftBlock) => {
    if (!draft) return;
    updateDraft({ ...draft, content: [...draft.content, b] });
  };

  const handleProjectDragStart = (e: React.DragEvent, i: number) => {
    setDragProjectIndex(i);
    isProjectDragging.current = true;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleProjectDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropProjectIndex(e.clientY < midpoint ? i : i + 1);
  };

  const handleProjectDragEnd = () => {
    setDragProjectIndex(null);
    setDropProjectIndex(null);
    setTimeout(() => {
      isProjectDragging.current = false;
    }, 0);
  };

  const handleProjectDrop = () => {
    if (dragProjectIndex === null || dropProjectIndex === null) { handleProjectDragEnd(); return; }

    const reordered = [...projects];
    const [moved] = reordered.splice(dragProjectIndex, 1);
    const insertAt = dropProjectIndex > dragProjectIndex ? dropProjectIndex - 1 : dropProjectIndex;
    reordered.splice(insertAt, 0, moved);
    const normalized = withAutoIndex(reordered);
    setProjects(normalized);

    if (selectedId && draft?.id === selectedId) {
      const selected = normalized.find((p) => p.id === selectedId);
      if (selected) setDraft((current) => (current ? { ...current, index: selected.index } : current));
    }

    setStatus("saving");
    persistProjects(normalized)
      .then((ok) => {
        setStatus(ok ? "saved" : "error");
        if (ok) setTimeout(() => setStatus("idle"), 2000);
      })
      .catch(() => setStatus("error"));

    handleProjectDragEnd();
  };

  const STATUS_LABELS = { idle: "", saving: "Sauvegarde…", saved: "✓ Sauvegardé", error: "Erreur" };

  return (
    <EditLangContext.Provider value={{ lang: editLang, setLang: setEditLang }}>
    <div className="flex h-screen bg-background text-foreground overflow-hidden" style={{ fontFamily: "var(--font-body)" }}>
      <style>{`
        select option { background: var(--background); }
      `}</style>

      {/* Sidebar projets */}
      <aside className="w-56 border-r border-border flex flex-col bg-secondary shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <span className="font-body text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-2">Edition</span>
          <div className="flex border border-border overflow-hidden mb-3">
            <button onClick={() => { setMode("landing"); setStatus("idle"); }}
              className="flex-1 py-1.5 font-body text-[9px] tracking-widest uppercase transition-colors"
              style={{ background: mode === "landing" ? "#0246F3" : "transparent", color: mode === "landing" ? "#fff" : "var(--muted-foreground)" }}>
              Landing
            </button>
            <button onClick={() => { setMode("project"); setStatus("idle"); }}
              className="flex-1 py-1.5 font-body text-[9px] tracking-widest uppercase transition-colors"
              style={{ background: mode === "project" ? "#0246F3" : "transparent", color: mode === "project" ? "#fff" : "var(--muted-foreground)" }}>
              Projets
            </button>
          </div>

          {mode === "project" && (
            <>
          <span className="font-body text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-3">Projets</span>
          <button onClick={createNew}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-border py-2 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            <Plus size={11} /> Nouveau
          </button>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {mode === "landing" && (
            <div className="px-4 py-3 border-b border-border bg-background/50">
              <div className="font-body text-[10px] text-muted-foreground tracking-wider uppercase">Page d'accueil</div>
              <div className="text-sm font-medium truncate">Contenu global</div>
            </div>
          )}
          {mode === "project" && (
            <>
          {effectiveProjects.map((p, i) => (
            <div key={p.id} className="relative">
              {dragProjectIndex !== null && dropProjectIndex === i && (
                <div className="absolute -top-[2px] left-0 right-0 h-[3px] bg-primary rounded-full z-10" />
              )}
              <div
                draggable
                onDragStart={(e) => handleProjectDragStart(e, i)}
                onDragOver={(e) => handleProjectDragOver(e, i)}
                onDrop={handleProjectDrop}
                onDragEnd={handleProjectDragEnd}
                className={`group flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer transition-colors ${dragProjectIndex === i ? "opacity-40" : p.hidden ? "opacity-50" : ""} ${selectedId === p.id ? "bg-background border-l-2 border-l-primary" : "hover:bg-background/50"}`}
                onClick={() => {
                  if (isProjectDragging.current) return;
                  selectProject(p);
                }}>
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical size={12} className="text-muted-foreground/70 shrink-0" />
                  {p.hidden && <EyeOff size={11} className="text-muted-foreground shrink-0" aria-label="Masqué" />}
                  <div className="min-w-0">
                  <div className="font-body text-[10px] text-muted-foreground">{p.index}</div>
                  <div className="text-sm font-medium truncate">{displayLS(p.title)}</div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all ml-2 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
              {dragProjectIndex !== null && i === projects.length - 1 && dropProjectIndex === projects.length && (
                <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-primary rounded-full z-10" />
              )}
            </div>
          ))}
          <div className="px-4 py-2 border-b border-border bg-background/40">
            <p className="font-body text-[9px] tracking-wide uppercase text-muted-foreground">
              Glisser les projets pour definir l'ordre. L'index est calcule automatiquement.
            </p>
          </div>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border space-y-3">
          <div>
            <button onClick={() => setPublishOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 font-body text-[10px] tracking-widest uppercase text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(to right, #0246F3, #4A7DF1)" }}>
              <CloudUpload size={12} /> Publier
            </button>
            <p className="mt-1.5 font-body text-[9px] tracking-wide text-muted-foreground">
              {hasUnsaved ? "Modifications non enregistrées" : `En ligne : ${formatDate(lastPublished)}`}
            </p>
          </div>
          <a href="/" className="flex items-center gap-2 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={11} /> Portfolio
          </a>
        </div>
      </aside>

      {publishOpen && (
        <PublishDialog
          unsavedNames={unsavedNames}
          onClose={() => setPublishOpen(false)}
          onPublished={setLastPublished}
        />
      )}

      {/* Zone principale */}
      {mode === "landing" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-display font-black uppercase tracking-tight text-lg">Landing page</span>
            </div>
            <div className="flex items-center gap-3">
              <LangTabs value={editLang} onChange={setEditLang} size="lg" />
              {status !== "idle" && (
                <span className={`font-body text-[10px] tracking-widest uppercase ${status === "saved" ? "text-green-500" : status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                  {STATUS_LABELS[status]}
                </span>
              )}
              <button onClick={preview}
                className="flex items-center gap-2 border border-border px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
                <Eye size={12} /> Aperçu
              </button>
              <button onClick={save} disabled={status === "saving" || !landingDraft}
                className="flex items-center gap-2 px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-white transition-opacity disabled:opacity-50"
                style={{ background: "linear-gradient(to right, #0246F3, #4A7DF1)" }}>
                <Save size={12} /> Enregistrer
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {landingDraft ? (
              <LandingPanel draft={landingDraft} onChange={(d) => { setLandingDraft(d); setStatus("idle"); }} />
            ) : (
              <div className="text-center py-16">
                <p className="font-body text-[11px] tracking-[0.28em] uppercase text-muted-foreground">Chargement landing…</p>
              </div>
            )}
          </div>
        </div>
      ) : draft ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-display font-black uppercase tracking-tight text-lg">{displayLS(draft.title)}</span>
              <span className="font-body text-[10px] text-muted-foreground tracking-widest uppercase">{draft.year}</span>
            </div>
            <div className="flex items-center gap-3">
              <LangTabs value={editLang} onChange={setEditLang} size="lg" />
              {status !== "idle" && (
                <span className={`font-body text-[10px] tracking-widest uppercase ${status === "saved" ? "text-green-500" : status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                  {STATUS_LABELS[status]}
                </span>
              )}
              <button onClick={preview}
                className="flex items-center gap-2 border border-border px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
                <Eye size={12} /> Aperçu
              </button>
              <button onClick={copyText} title={`Copier tout le texte de la page en ${editLang === "fr" ? "français" : "anglais"}`}
                className="flex items-center gap-2 border border-border px-3 py-1.5 font-body text-[10px] tracking-widest uppercase transition-colors hover:text-foreground hover:border-foreground"
                style={{ color: copied ? "#0246F3" : "var(--muted-foreground)" }}>
                {copied ? <ClipboardCheck size={12} /> : <ClipboardCopy size={12} />} {copied ? "Copié" : `Copier ${editLang.toUpperCase()}`}
              </button>
              <button onClick={save} disabled={status === "saving"}
                className="flex items-center gap-2 px-3 py-1.5 font-body text-[10px] tracking-widest uppercase text-white transition-opacity disabled:opacity-50"
                style={{ background: "linear-gradient(to right, #0246F3, #4A7DF1)" }}>
                <Save size={12} /> Enregistrer
              </button>
            </div>
          </div>

          {/* Content — two cols */}
          <div className="flex-1 flex overflow-hidden">
            {/* Métadonnées — clé stable (projet sélectionné) pour ne pas remonter le panneau quand on modifie le slug */}
            <div className="w-80 border-r border-border shrink-0 overflow-y-auto">
              <MetaPanel
                key={selectedId ?? draft.id}
                draft={draft}
                onChange={updateDraft}
                projectId={draft.id}
                categorySuggestions={categorySuggestions}
                tagSuggestions={tagSuggestions}
                onRenameCategoryEverywhere={onRenameCategoryEverywhere}
                onDeleteCategoryEverywhere={onDeleteCategoryEverywhere}
                onRenameTagEverywhere={onRenameTagEverywhere}
                onDeleteTagEverywhere={onDeleteTagEverywhere}
              />
            </div>

            {/* Blocs de contenu */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-body text-[10px] tracking-[0.28em] uppercase text-muted-foreground">
                    Contenu — {draft.content.length} bloc{draft.content.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {draft.content.map((block, i) => (
                  <div key={block._uid}
                    className={`relative ${dragIndex === i ? "opacity-40" : ""}`}
                    onDragOver={(e) => handleBlockDragOver(e, i)}
                    onDrop={handleDrop}>
                    {dragIndex !== null && dropIndex === i && (
                      <div className="absolute -top-[7px] left-0 right-0 h-[3px] bg-primary rounded-full z-10" />
                    )}
                    <BlockEditor
                      block={block}
                      onChange={(b) => updateBlock(i, b)}
                      onDelete={() => deleteBlock(i)}
                      onDuplicate={() => duplicateBlock(i)}
                      projectId={draft.id}
                      dragHandleProps={{ draggable: true, onDragStart: () => handleDragStart(i), onDragEnd: handleDragEnd }}
                    />
                    {dragIndex !== null && i === draft.content.length - 1 && dropIndex === draft.content.length && (
                      <div className="absolute -bottom-[7px] left-0 right-0 h-[3px] bg-primary rounded-full z-10" />
                    )}
                  </div>
                ))}

                <AddBlockMenu onAdd={addBlock} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-body text-[11px] tracking-[0.28em] uppercase text-muted-foreground mb-4">
              Sélectionner ou créer un projet
            </p>
            <button onClick={createNew}
              className="flex items-center gap-2 mx-auto border border-border px-5 py-2.5 font-body text-[11px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Plus size={13} /> Nouveau projet
            </button>
          </div>
        </div>
      )}
    </div>
    </EditLangContext.Provider>
  );
}
