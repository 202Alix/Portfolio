import { useState, useEffect, useRef, useCallback, useContext, createContext } from "react";
import { Plus, Trash2, Copy, GripVertical, ChevronDown, ChevronUp, Save, Eye, EyeOff, ArrowLeft, ArrowLeftRight, X, ImageIcon, Type, Video, Youtube, LayoutGrid, Columns2, CircleHelp, Pencil, Globe, ChevronsLeftRight } from "lucide-react";
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
    category: { fr: "Identite visuelle", en: "Visual Identity" },
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

function withAutoIndex(projects: ProjectDraft[]): ProjectDraft[] {
  return projects.map((project, i) => ({
    ...project,
    index: String(i + 1).padStart(2, "0"),
  }));
}

// ─── API ───────────────────────────────────────────────────────────────────

async function apiSave(project: Project): Promise<void> {
  const res = await fetch("/api/save-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error("Erreur lors de la sauvegarde");
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch("/api/delete-project", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression");
}

async function apiUpload(file: File, projectId: string): Promise<string> {
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
        if (json.path) resolve(json.path);
        else reject(new Error(json.error));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function apiList(): Promise<Project[]> {
  const res = await fetch("/api/list-projects");
  return res.json();
}

async function apiGetLanding(): Promise<LandingContent> {
  const res = await fetch("/api/get-landing");
  if (!res.ok) throw new Error("Erreur lors du chargement de la landing page");
  return res.json();
}

async function apiSaveLanding(landing: LandingContent): Promise<void> {
  const res = await fetch("/api/save-landing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(landing),
  });
  if (!res.ok) throw new Error("Erreur lors de la sauvegarde de la landing page");
}

// ─── COMPOSANTS UI ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
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
          className={`font-mono tracking-widest uppercase transition-colors ${size === "lg" ? "px-3 py-1 text-[10px]" : "px-2 py-0.5 text-[9px]"}`}
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
      className={`w-full bg-secondary border border-border px-3 py-2 font-mono text-sm outline-none focus:border-primary transition-colors ${readOnly ? "cursor-not-allowed opacity-70" : ""} ${className}`}
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
      className="w-full bg-secondary border border-border px-3 py-2 font-mono text-sm outline-none focus:border-primary transition-colors resize-none overflow-hidden"
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
        className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors"
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
          <span className="block font-mono text-[9px] tracking-[0.18em] uppercase text-muted-foreground mb-1">{title}</span>
          <div className="space-y-0.5">
            {lines.map((line) => (
              <p key={line} className="font-mono text-[10px] leading-relaxed text-muted-foreground">{line}</p>
            ))}
          </div>
          <div className="h-px bg-border/60 my-2" />
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            Regle generale: WebP recommande, qualite 80-85%, cible inferieure a 400 Ko.
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit etre une image");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const path = await apiUpload(file, projectId);
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
            <img src={src} alt="" className="w-full object-cover" style={{ maxHeight: 120 }} />
            <div className="absolute inset-0 bg-foreground/0 hover:bg-foreground/30 transition-colors flex items-center justify-center">
              <span className="opacity-0 hover:opacity-100 font-mono text-[10px] text-white tracking-widest uppercase">Changer</span>
            </div>
          </div>
        ) : (
          <>
            <ImageIcon size={20} className="text-muted-foreground" />
            <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
              {uploading ? "Upload…" : "Glisser ou cliquer"}
            </span>
          </>
        )}
      </div>
      {error && <p className="font-mono text-[10px] text-red-500 mt-1">{error}</p>}
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
      const path = await apiUpload(file, projectId);
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
              <span className="opacity-0 hover:opacity-100 font-mono text-[10px] text-white tracking-widest uppercase">Changer</span>
            </div>
          </div>
        ) : (
          <>
            <Video size={20} className="text-muted-foreground" />
            <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
              {uploading ? "Upload…" : "Glisser ou cliquer"}
            </span>
          </>
        )}
      </div>
      {error && <p className="font-mono text-[10px] text-red-500 mt-1">{error}</p>}
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
      onChange(await apiUpload(file, folder));
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
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground truncate">
          {uploading ? "Upload…" : src ? `${fileNameFromSrc(src)} — changer` : "Glisser ou cliquer"}
        </span>
      </div>
      {error && <p className="font-mono text-[10px] text-red-500 mt-1">{error}</p>}
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
            className="flex-1 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors"
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
            className="flex-1 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors"
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
            className="flex-1 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors"
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
      <p className="font-mono text-[10px] text-muted-foreground">Images communes au FR et à l'EN. Les deux doivent avoir exactement les mêmes dimensions et le même cadrage.</p>
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
          className="w-full flex items-center gap-2 border border-border px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase text-left hover:border-primary transition-colors">
          <span className="text-muted-foreground">{current.icon}</span>
          {current.label}
          <ChevronDown size={12} className="ml-auto text-muted-foreground" />
        </button>
        {kindOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-background z-10">
            {COLUMN_KINDS.map(({ k, label, icon }) => (
              <button key={k} onClick={() => setKind(k)}
                className="w-full flex items-center gap-2 px-3 py-2 font-mono text-[10px] tracking-wider uppercase hover:bg-secondary transition-colors text-left"
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
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase">{meta?.label}</span>
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
              <BilingualTextarea label="Texte secondaire (optionnel)" value={block.secondary ?? emptyLS()} onChange={(secondary) => onChange({ ...block, secondary })} rows={2} />
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
                  className="flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors shrink-0"
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
                className="w-full border border-dashed border-border py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2">
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
        className="w-full border border-dashed border-border py-3 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2">
        <Plus size={13} /> Ajouter un bloc
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-background z-10">
          {BLOCK_TYPES.map(({ type, label, icon }) => (
            <button key={type} onClick={() => { onAdd(newBlock(type)); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary transition-colors text-left">
              <span className="text-muted-foreground">{icon}</span>
              <span className="font-mono text-[11px] tracking-widest uppercase">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PANNEAU MÉTADONNÉES ───────────────────────────────────────────────────

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
    <div className="space-y-5">
      <div>
        <Label>Titre</Label>
        <Input value={draft.title[titleLang]} onChange={updateTitle} placeholder={titleLang === "fr" ? "Titre du projet" : "Project title"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Année</Label>
          <Input value={draft.year} onChange={(year) => onChange({ ...draft, year })} placeholder="2024" />
        </div>
        <div>
          <Label>Ordre</Label>
          <Input value={draft.index} onChange={() => {}} placeholder="Automatique" readOnly />
        </div>
      </div>

      <div>
        <Label>Visibilité</Label>
        <div className="flex border border-border overflow-hidden">
          {[{ v: false, label: "Visible" }, { v: true, label: "Masqué" }].map(({ v, label }) => (
            <button key={label} onClick={() => onChange({ ...draft, hidden: v })}
              className="flex-1 py-1.5 font-mono text-[10px] tracking-wider uppercase transition-colors"
              style={{ background: (draft.hidden ?? false) === v ? "#0246F3" : "transparent", color: (draft.hidden ?? false) === v ? "#fff" : "var(--muted-foreground)" }}>
              {label}
            </button>
          ))}
        </div>
        {(draft.hidden ?? false) && (
          <p className="mt-1.5 font-mono text-[9px] tracking-wide text-muted-foreground">
            Ce projet reste modifiable ici mais n'apparaît pas sur le site public.
          </p>
        )}
      </div>

      <div>
        <Label>Categorie</Label>
        <Input value={draft.category[categoryLang]} onChange={updateCategory} placeholder={categoryLang === "fr" ? "Categorie francaise" : "English category"} />
        <div className="flex flex-wrap gap-1 mt-2">
          {visibleCategorySuggestions.map((c) => (
            <div key={`${c.fr}-${c.en}`} className="inline-flex items-center border border-border/50 hover:border-primary transition-colors">
              <button onClick={() => onChange({ ...draft, category: c })}
                className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground px-1.5 py-0.5 hover:text-primary transition-colors">
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

      <div>
        <Label>ID (slug URL)</Label>
        <Input value={draft.id} onChange={(id) => onChange({ ...draft, id: id.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="nom-du-projet" />
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
            className="border border-border px-3 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors">
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
                className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground px-1.5 py-0.5 hover:text-primary transition-colors">
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

      <BilingualTextarea label="Extrait (carte projet)" value={draft.excerpt} onChange={(excerpt) => onChange({ ...draft, excerpt })} rows={3} />

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
            <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground shrink-0">Haut</span>
            <input
              type="range"
              min={0}
              max={100}
              value={draft.coverImagePosition ?? 50}
              onChange={(e) => onChange({ ...draft, coverImagePosition: Number(e.target.value) })}
              className="w-full accent-[#0246F3]"
            />
            <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground shrink-0">Bas</span>
          </div>
        </div>
      )}
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
        <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground">Contenu Landing</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Disponibilité</Label>
          <Input value={locale.availability ?? ""} onChange={(v) => updateField("availability", v)} placeholder="Disponible" />
          <p className="font-mono text-[10px] text-muted-foreground mt-1">Remplace la tagline sous le nom. Laisser vide pour réafficher la tagline.</p>
        </div>
        <div>
          <Label>Disponibilité — détail</Label>
          <Input value={locale.availabilityDetail ?? ""} onChange={(v) => updateField("availabilityDetail", v)} placeholder="CDI · Nov. 2026" />
          <p className="font-mono text-[10px] text-muted-foreground mt-1">Affiché après « · » sur la même ligne.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lien CV</Label>
          <Input value={locale.cv ?? ""} onChange={(v) => updateField("cv", v)} placeholder="Télécharger le CV" />
          <p className="font-mono text-[10px] text-muted-foreground mt-1">Le lien n'apparaît dans Contact que si un PDF est défini.</p>
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
          <Input value={locale.selectedWorksPattern} onChange={(v) => updateField("selectedWorksPattern", v)} placeholder="Ex: Projets — {count}" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>All</Label>
          <Input value={locale.all} onChange={(v) => updateField("all", v)} />
        </div>
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

      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label>Category</Label>
          <Input value={locale.category} onChange={(v) => updateField("category", v)} />
        </div>
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
        <Label>Footer</Label>
        <Input value={locale.footer} onChange={(v) => updateField("footer", v)} />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Message aucun projet</Label>
          <Input value={locale.noProjects} onChange={(v) => updateField("noProjects", v)} />
        </div>
        <div>
          <Label>Bouton fermer</Label>
          <Input value={locale.close} onChange={(v) => updateField("close", v)} />
        </div>
      </div>

      <div className="pt-6 border-t border-border space-y-4">
        <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground block">Contact (partagé FR/EN)</span>

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
            className="w-full mt-2 border border-dashed border-border py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={12} /> Ajouter un lien
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ÉDITEUR PRINCIPAL ─────────────────────────────────────────────────────

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
  const [metaOpen, setMetaOpen] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragProjectIndex, setDragProjectIndex] = useState<number | null>(null);
  const [dropProjectIndex, setDropProjectIndex] = useState<number | null>(null);
  const isProjectDragging = useRef(false);

  // Charger les projets existants
  useEffect(() => {
    apiList().then((data) => {
      const sorted = [...data].sort((a, b) => a.index.localeCompare(b.index));
      const drafts = withAutoIndex(sorted.map((p) => ({
        ...p,
        title: toLS(p.title),
        category: toLS(p.category),
        tags: (p.tags ?? []).map((tag) => toLS(tag)),
        content: p.content.map((b) => ({ ...b, _uid: uid() } as DraftBlock)),
      })));
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
    apiGetLanding().then((data) => setLandingDraft(data));
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

  const save = async () => {
    if (mode === "project" && !draft) return;
    if (mode === "landing" && !landingDraft) return;
    setStatus("saving");
    try {
      if (mode === "landing") {
        if (!landingDraft) return;
        await apiSaveLanding(landingDraft);
      } else if (draft) {
        const previousId = selectedId ?? draft.id;
        const slugChanged = previousId !== draft.id;
        const updatedProjects = withAutoIndex(
          projects.map((p) => (p.id === previousId ? draft : p))
        );

        await Promise.all(updatedProjects.map((p) => apiSave(draftToProject(p))));
        if (slugChanged) {
          await apiDelete(previousId);
        }

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
    await apiDelete(id);
    setProjects((prev) => withAutoIndex(prev.filter((p) => p.id !== id)));
    if (selectedId === id) { setDraft(null); setSelectedId(null); }
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

    setProjects((prev) => {
      const reordered = [...prev];
      const [moved] = reordered.splice(dragProjectIndex, 1);
      const insertAt = dropProjectIndex > dragProjectIndex ? dropProjectIndex - 1 : dropProjectIndex;
      reordered.splice(insertAt, 0, moved);
      const normalized = withAutoIndex(reordered);

      if (selectedId && draft?.id === selectedId) {
        const selected = normalized.find((p) => p.id === selectedId);
        if (selected) {
          setDraft((current) => (current ? { ...current, index: selected.index } : current));
        }
      }

      setStatus("saving");
      Promise.all(normalized.map((p) => apiSave(draftToProject(p))))
        .then(() => {
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        })
        .catch(() => setStatus("error"));

      return normalized;
    });

    handleProjectDragEnd();
  };

  const STATUS_LABELS = { idle: "", saving: "Sauvegarde…", saved: "✓ Sauvegardé", error: "Erreur" };

  return (
    <EditLangContext.Provider value={{ lang: editLang, setLang: setEditLang }}>
    <div className="flex h-screen bg-background text-foreground overflow-hidden" style={{ fontFamily: "var(--font-body)" }}>
      <style>{`
        .font-mono { font-family: var(--font-mono); }
        select option { background: var(--background); }
      `}</style>

      {/* Sidebar projets */}
      <aside className="w-56 border-r border-border flex flex-col bg-secondary shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-2">Edition</span>
          <div className="flex border border-border overflow-hidden mb-3">
            <button onClick={() => { setMode("landing"); setStatus("idle"); }}
              className="flex-1 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors"
              style={{ background: mode === "landing" ? "#0246F3" : "transparent", color: mode === "landing" ? "#fff" : "var(--muted-foreground)" }}>
              Landing
            </button>
            <button onClick={() => { setMode("project"); setStatus("idle"); }}
              className="flex-1 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors"
              style={{ background: mode === "project" ? "#0246F3" : "transparent", color: mode === "project" ? "#fff" : "var(--muted-foreground)" }}>
              Projets
            </button>
          </div>

          {mode === "project" && (
            <>
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-3">Projets</span>
          <button onClick={createNew}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-border py-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            <Plus size={11} /> Nouveau
          </button>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {mode === "landing" && (
            <div className="px-4 py-3 border-b border-border bg-background/50">
              <div className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">Page d'accueil</div>
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
                  <div className="font-mono text-[10px] text-muted-foreground">{p.index}</div>
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
            <p className="font-mono text-[9px] tracking-wide uppercase text-muted-foreground">
              Glisser les projets pour definir l'ordre. L'index est calcule automatiquement.
            </p>
          </div>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border">
          <a href="/" className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={11} /> Portfolio
          </a>
        </div>
      </aside>

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
                <span className={`font-mono text-[10px] tracking-widest uppercase ${status === "saved" ? "text-green-500" : status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                  {STATUS_LABELS[status]}
                </span>
              )}
              <button onClick={preview}
                className="flex items-center gap-2 border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
                <Eye size={12} /> Aperçu
              </button>
              <button onClick={save} disabled={status === "saving" || !landingDraft}
                className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-white transition-opacity disabled:opacity-50"
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
                <p className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground">Chargement landing…</p>
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
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{draft.year}</span>
            </div>
            <div className="flex items-center gap-3">
              <LangTabs value={editLang} onChange={setEditLang} size="lg" />
              {status !== "idle" && (
                <span className={`font-mono text-[10px] tracking-widest uppercase ${status === "saved" ? "text-green-500" : status === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                  {STATUS_LABELS[status]}
                </span>
              )}
              <button onClick={preview}
                className="flex items-center gap-2 border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
                <Eye size={12} /> Aperçu
              </button>
              <button onClick={save} disabled={status === "saving"}
                className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-white transition-opacity disabled:opacity-50"
                style={{ background: "linear-gradient(to right, #0246F3, #4A7DF1)" }}>
                <Save size={12} /> Enregistrer
              </button>
            </div>
          </div>

          {/* Content — two cols */}
          <div className="flex-1 flex overflow-hidden">
            {/* Métadonnées */}
            <div className="w-80 border-r border-border flex flex-col shrink-0">
              <button onClick={() => setMetaOpen((o) => !o)}
                className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary transition-colors">
                <span className="font-mono text-[10px] tracking-[0.28em] uppercase">Métadonnées</span>
                {metaOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {metaOpen && (
                <div className="flex-1 overflow-y-auto p-4">
                  <MetaPanel
                    key={draft.id}
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
              )}
            </div>

            {/* Blocs de contenu */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground">
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
            <p className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground mb-4">
              Sélectionner ou créer un projet
            </p>
            <button onClick={createNew}
              className="flex items-center gap-2 mx-auto border border-border px-5 py-2.5 font-mono text-[11px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Plus size={13} /> Nouveau projet
            </button>
          </div>
        </div>
      )}
    </div>
    </EditLangContext.Provider>
  );
}
