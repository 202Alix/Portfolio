/// <reference types="vite/client" />

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { ArrowUpRight, ArrowDown, ArrowLeft, X, Sun, Moon, Menu } from "lucide-react";
import Logo from "../imports/Logo";
import { useIsMobile } from "./components/ui/use-mobile";
import { projects as loadedProjects } from "../data/index";
import landingData from "../data/landing.json";

const EditorPage = import.meta.env.DEV ? lazy(() => import("../editor/Editor")) : null;

// ─── TYPES ─────────────────────────────────────────────────────────────────

type Lang = "fr" | "en";
type LS = string | { fr: string; en: string };

function t(s: LS, lang: Lang): string {
  return typeof s === "string" ? s : s[lang];
}

function getYoutubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : url;
}

function getInitialLang(): Lang {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("lang");
    if (stored === "fr" || stored === "en") return stored;
  }
  if (typeof navigator === "undefined") return "en";
  const pref = [...navigator.languages, navigator.language]
    .filter(Boolean)
    .map((l) => l.toLowerCase());
  return pref.some((l) => l.startsWith("fr")) ? "fr" : "en";
}

function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// ─── UI STRINGS ────────────────────────────────────────────────────────────

type UILocale = (typeof landingData)["fr"] & { selectedWorks: (n: number) => string };

const landing = landingData as { fr: typeof landingData.fr; en: typeof landingData.en };

const buildLocale = (l: typeof landingData.fr): UILocale => ({
  ...l,
  selectedWorks: (n: number) => l.selectedWorksPattern.replace("{count}", String(n).padStart(2, "0")),
});

const UI = {
  fr: buildLocale(landing.fr),
  en: buildLocale(landing.en),
} as const;

// ─── CONTENT BLOCK TYPES ───────────────────────────────────────────────────

type MediaItem = { src: LS; alt: string; caption?: LS };
type VideoItem = { src: LS; poster?: string; caption?: LS };

type ColumnContent =
  | { kind: "text"; primary: LS; align?: "left" | "right" }
  | { kind: "image"; item: MediaItem }
  | { kind: "video"; item: VideoItem }
  | { kind: "youtube"; url: LS; caption?: LS };

type ContentBlock =
  | { type: "text"; primary: LS; secondary?: LS; align?: "left" | "right" }
  | { type: "image"; item: MediaItem; position: "left" | "right" | "full" }
  | { type: "video"; item: VideoItem; position: "left" | "right" | "full" }
  | { type: "youtube"; url: LS; caption?: LS; position: "left" | "right" | "full" }
  | { type: "columns"; left: ColumnContent; right: ColumnContent; ratio?: "1:1" | "1:2" | "2:1" }
  | { type: "masonry"; items: MediaItem[] };

// ─── PROJECT DATA ──────────────────────────────────────────────────────────

interface Project {
  id: string;
  index: string;
  title: LS;
  year: string;
  category: LS;
  tags: LS[];
  excerpt: LS;
  coverImage: string;
  coverImagePosition?: number;
  content: ContentBlock[];
}

const projects = loadedProjects as Project[];

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const GRADIENT = "linear-gradient(to right, #0246F3, #4A7DF1)";
const RAIL_W = 60;
const PARALLAX_PX = 50;
const CURRENT_YEAR = new Date().getFullYear();

const gradientBorder = (hov: boolean) =>
  hov
    ? { border: "1px solid transparent", background: `linear-gradient(var(--background), var(--background)) padding-box, ${GRADIENT} border-box`, color: "#0246F3" }
    : { border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)" };

// ─── ANIMATED ARROW ────────────────────────────────────────────────────────

function AnimatedArrow({ hovered, size = 14, color }: { hovered: boolean; size?: number; color?: string }) {
  const d = size + 8;
  return (
    <div className="overflow-hidden shrink-0 relative" style={{ width: size, height: size }}>
      <motion.div className="absolute inset-0 flex items-center justify-center"
        animate={{ x: hovered ? d : 0, y: hovered ? -d : 0 }}
        transition={hovered ? { duration: 0.28, ease: "easeIn" } : { duration: 0 }}>
        <ArrowUpRight size={size} color={color} />
      </motion.div>
      <motion.div className="absolute inset-0 flex items-center justify-center"
        animate={{ x: hovered ? 0 : -d, y: hovered ? 0 : d }}
        transition={hovered ? { duration: 0.42, ease: EASE } : { duration: 0 }}>
        <ArrowUpRight size={size} color={color} />
      </motion.div>
    </div>
  );
}

function ConveyorArrow({ direction = "down", size = 16, hovered }: { direction?: "down" | "left"; size?: number; hovered?: boolean }) {
  const boxH = size + 6;
  const d = boxH;
  const hold = 1.5;
  const exitDur = 0.28;
  const enterDur = 0.42;
  const total = hold + exitDur + enterDur;
  const t1 = hold / total;
  const t2 = (hold + exitDur) / total;
  const Icon = direction === "down" ? ArrowDown : ArrowLeft;
  const axis = direction === "down" ? "y" : "x";
  const sign = direction === "down" ? 1 : -1;
  const boxStyle = direction === "down" ? { width: size, height: boxH } : { width: boxH, height: size };
  const active = hovered === undefined || hovered;

  return (
    <div className="overflow-hidden relative inline-block shrink-0" style={boxStyle}>
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ [axis]: active ? [0, 0, sign * d, sign * d] : 0 }}
        transition={active ? { duration: total, times: [0, t1, t2, 1], repeat: Infinity, ease: ["linear", "easeIn", "linear"] as ("linear" | "easeIn")[] } : { duration: 0 }}
      ><Icon size={size} /></motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ [axis]: active ? [-sign * d, -sign * d, 0] : -sign * d }}
        transition={active ? { duration: total, times: [0, t2, 1], repeat: Infinity, ease: ["linear", EASE] as ("linear" | typeof EASE)[] } : { duration: 0 }}
      ><Icon size={size} /></motion.div>
    </div>
  );
}

// ─── LIGHTBOX ──────────────────────────────────────────────────────────────

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
      className="fixed inset-0 z-100 flex items-center justify-center bg-foreground/90 backdrop-blur-sm p-4 md:p-12"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.28, ease: EASE }} className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
        <img src={src.replace(/w=\d+/, "w=1800").replace(/h=\d+/, "h=1200")} alt={alt} className="w-full h-auto object-contain" style={{ maxHeight: "88vh" }} />
        <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-background text-foreground hover:bg-foreground hover:text-background transition-colors duration-150">
          <X size={15} />
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── MEDIA BLOCKS ──────────────────────────────────────────────────────────

function ImageBlock({ item, onOpen, lang, aspectRatio = "4 / 3" }: { item: MediaItem; onOpen: (s: string, a: string) => void; lang: Lang; aspectRatio?: string }) {
  const src = t(item.src, lang);
  const isFluid = aspectRatio === "unset";
  return (
    <figure className="m-0">
      <button onClick={() => onOpen(src, item.alt)} className="block w-full overflow-hidden bg-muted group relative" style={{ aspectRatio, maxHeight: isFluid ? "70vh" : undefined }} aria-label={item.alt}>
        <img src={src} alt={item.alt} className={`w-full h-full transition-transform duration-500 group-hover:scale-[1.025] ${isFluid ? "object-contain" : "object-cover"}`} />
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-8 h-8 bg-background flex items-center justify-center">
            <ArrowUpRight size={13} />
          </div>
        </div>
      </button>
      {item.caption && <figcaption className="mt-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">{t(item.caption, lang)}</figcaption>}
    </figure>
  );
}

function VideoBlock({ item, lang, aspectRatio = "16 / 9" }: { item: VideoItem; lang: Lang; aspectRatio?: string }) {
  return (
    <figure className="m-0">
      <div className="w-full overflow-hidden bg-muted" style={{ aspectRatio }}>
        <video key={t(item.src, lang)} src={t(item.src, lang)} poster={item.poster} controls className="w-full h-full object-cover" />
      </div>
      {item.caption && <figcaption className="mt-2 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">{t(item.caption, lang)}</figcaption>}
    </figure>
  );
}

function TextCol({ primary, secondary, align, lang }: { primary: LS; secondary?: LS; align?: "left" | "right"; lang: Lang }) {
  return (
    <div className={`flex flex-col justify-center h-full ${align === "right" ? "md:text-right" : ""}`}>
      <p className="text-lg leading-relaxed font-light whitespace-pre-line">{t(primary, lang)}</p>
      {secondary && <p className="mt-4 text-base leading-relaxed font-light text-muted-foreground whitespace-pre-line">{t(secondary, lang)}</p>}
    </div>
  );
}

function YoutubeEmbed({ url, caption, lang }: { url: LS; caption?: LS; lang: Lang }) {
  const embedUrl = getYoutubeEmbedUrl(t(url, lang));
  return (
    <div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe src={embedUrl} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
      </div>
      {caption && <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-2">{t(caption, lang)}</p>}
    </div>
  );
}

function renderColumn(col: ColumnContent, onOpen: (s: string, a: string) => void, lang: Lang) {
  if (col.kind === "text") return <TextCol primary={col.primary} align={col.align} lang={lang} />;
  if (col.kind === "image") return <ImageBlock item={col.item} onOpen={onOpen} lang={lang} aspectRatio="unset" />;
  if (col.kind === "video") return <VideoBlock item={col.item} lang={lang} />;
  if (col.kind === "youtube") return <YoutubeEmbed url={col.url} caption={col.caption} lang={lang} />;
  return null;
}

// ─── CONTENT RENDERER ──────────────────────────────────────────────────────

function ContentRenderer({ blocks, onOpen, lang }: { blocks: ContentBlock[]; onOpen: (s: string, a: string) => void; lang: Lang }) {
  const ui = UI[lang];
  const gapClass = (i: number) => {
    if (i === 0) return "";
    const prev = blocks[i - 1];
    return prev.type === "text" && blocks[i].type === "text" ? "mt-8 md:mt-12" : "mt-14 md:mt-20";
  };
  return (
    <div className="px-6 md:px-12 py-12 md:py-20">
      {blocks.map((block, i) => {
        const gap = gapClass(i);
        if (block.type === "text") return (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className={`grid grid-cols-1 md:grid-cols-12 ${gap}`}>
            <div className={block.align === "right" ? "md:col-start-5 md:col-span-8" : "md:col-span-8"}><TextCol primary={block.primary} secondary={block.secondary} lang={lang} /></div>
          </motion.div>
        );
        if (block.type === "image") {
          const isHalf = block.position === "left" || block.position === "right";
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className={gap}>
              {block.position === "full" && <ImageBlock item={block.item} onOpen={onOpen} lang={lang} aspectRatio="16 / 7" />}
              {isHalf && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{block.position === "right" && <div />}<ImageBlock item={block.item} onOpen={onOpen} lang={lang} />{block.position === "left" && <div />}</div>}
            </motion.div>
          );
        }
        if (block.type === "video") {
          const isHalf = block.position === "left" || block.position === "right";
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className={gap}>
              {block.position === "full" && <VideoBlock item={block.item} lang={lang} aspectRatio="16 / 7" />}
              {isHalf && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{block.position === "right" && <div />}<VideoBlock item={block.item} lang={lang} />{block.position === "left" && <div />}</div>}
            </motion.div>
          );
        }
        if (block.type === "youtube") {
          const isHalf = block.position === "left" || block.position === "right";
          const frame = <YoutubeEmbed url={block.url} caption={block.caption} lang={lang} />;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className={gap}>
              {block.position === "full" && frame}
              {isHalf && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{block.position === "right" && <div />}{frame}{block.position === "left" && <div />}</div>}
            </motion.div>
          );
        }
        if (block.type === "columns") {
          const ratioClass = block.ratio === "1:2" ? "md:grid-cols-[1fr_2fr]" : block.ratio === "2:1" ? "md:grid-cols-[2fr_1fr]" : "md:grid-cols-2";
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className={`grid grid-cols-1 ${ratioClass} gap-8 md:gap-12 items-center ${gap}`}>
              <div>{renderColumn(block.left, onOpen, lang)}</div>
              <div>{renderColumn(block.right, onOpen, lang)}</div>
            </motion.div>
          );
        }
        if (block.type === "masonry") {
          const maxCols = Math.min(3, block.items.length);
          const colsClass =
            maxCols <= 1 ? "columns-1" :
            maxCols === 2 ? "columns-1 md:columns-2" :
            "columns-1 md:columns-2 lg:columns-3";
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }} className={gap}>
              <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground mb-5">{ui.gallery}</div>
              <div className={`${colsClass} gap-3`}>
                {block.items.map((item, j) => (
                  <motion.div key={j} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ duration: 0.4, ease: EASE, delay: j * 0.07 }} style={{ breakInside: "avoid", marginBottom: "12px" }}>
                    <ImageBlock item={item} onOpen={onOpen} lang={lang} aspectRatio="unset" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ─── TOGGLES ───────────────────────────────────────────────────────────────

function VerticalLangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="relative flex flex-col border border-border hover:border-primary transition-colors duration-200 overflow-hidden" style={{ width: 26 }}>
      <motion.div className="absolute left-0 right-0 h-1/2" style={{ background: GRADIENT }}
        animate={{ top: lang === "fr" ? "0%" : "50%" }} transition={{ duration: 0.28, ease: EASE }} />
      {(["fr", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className="relative z-10 font-mono text-[9px] tracking-widest uppercase outline-none transition-colors duration-150 flex items-center justify-center"
          style={{ height: 24, color: lang === l ? "#fff" : "var(--muted-foreground)" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function HorizLangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="relative flex items-center border border-border hover:border-primary transition-colors duration-200 overflow-hidden" style={{ height: 26 }}>
      <motion.div className="absolute top-0 bottom-0 w-1/2" style={{ background: GRADIENT }}
        animate={{ left: lang === "fr" ? "0%" : "50%" }} transition={{ duration: 0.28, ease: EASE }} />
      {(["fr", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className="relative z-10 w-8 font-mono text-[10px] tracking-widest uppercase outline-none transition-colors duration-150 flex items-center justify-center"
          style={{ height: 26, color: lang === l ? "#fff" : "var(--muted-foreground)" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function DarkToggle({ dark, setDark }: { dark: boolean; setDark: (d: boolean) => void }) {
  return (
    <button onClick={() => setDark(!dark)}
      className="flex items-center justify-center border border-border hover:border-primary transition-colors duration-200 outline-none"
      style={{ width: 26, height: 26 }} aria-label="Toggle dark mode">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? "sun" : "moon"} initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
          transition={{ duration: 0.2, ease: EASE }}>
          {dark ? <Sun size={11} /> : <Moon size={11} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// ─── SIDE NAV (desktop) ────────────────────────────────────────────────────

function SideNav({ page, navigate, lang, setLang, dark, setDark }: {
  page: string; navigate: (id: string) => void;
  lang: Lang; setLang: (l: Lang) => void;
  dark: boolean; setDark: (d: boolean) => void;
}) {
  const ui = UI[lang];

  const scrollTo = (id: string) => {
    if (page !== "home") {
      navigate("home");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 480);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navItems = [
    { id: "projets", label: ui.projects },
    { id: "apropos", label: ui.about },
    { id: "contact", label: ui.contact },
  ];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 hidden md:flex flex-col items-center py-6 bg-background border-r border-border"
      style={{ width: RAIL_W }}
    >
      {/* Logo */}
      <button onClick={() => navigate("home")} className="w-8 h-8 shrink-0 hover:opacity-70 transition-opacity duration-200" aria-label="Accueil">
        <Logo />
      </button>

      {/* Nav links — rotated, centred vertically */}
      <nav className="flex-1 flex flex-col items-center justify-center gap-12">
        {navItems.map(({ id, label }) => (
          <NavRailItem key={id} label={label} onClick={() => scrollTo(id)} />
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-2">
        <VerticalLangToggle lang={lang} setLang={setLang} />
        <DarkToggle dark={dark} setDark={setDark} />
      </div>
    </aside>
  );
}

function NavRailItem({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="font-mono text-[10px] tracking-[0.24em] uppercase outline-none transition-colors duration-200"
      style={{
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
        color: hov ? "#0246F3" : "var(--muted-foreground)",
      }}
    >
      {label}
    </button>
  );
}

// ─── MOBILE NAV (top bar) ──────────────────────────────────────────────────

function MobileNav({ page, navigate, lang, setLang, dark, setDark }: {
  page: string; navigate: (id: string) => void;
  lang: Lang; setLang: (l: Lang) => void;
  dark: boolean; setDark: (d: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ui = UI[lang];

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    if (page !== "home") {
      navigate("home");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 480);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 bg-background border-b border-border md:hidden" style={{ height: 52 }}>
        <button onClick={() => navigate("home")} className="relative w-7 h-7 shrink-0 block" aria-label="Accueil">
          <Logo />
        </button>
        <div className="flex items-center gap-2">
          <HorizLangToggle lang={lang} setLang={setLang} />
          <DarkToggle dark={dark} setDark={setDark} />
          <button onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="w-[26px] h-[26px] flex items-center justify-center border border-border outline-none transition-colors duration-200 hover:border-primary">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={menuOpen ? "x" : "menu"} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.15 }}>
                {menuOpen ? <X size={11} /> : <Menu size={11} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="fixed top-[52px] left-0 right-0 z-40 bg-background border-b border-border md:hidden">
            {[{ id: "projets", label: ui.projects }, { id: "apropos", label: ui.about }, { id: "contact", label: ui.contact }].map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="w-full text-left px-5 py-4 font-mono text-[11px] tracking-widest uppercase text-muted-foreground hover:text-primary border-b border-border last:border-0 transition-colors duration-200 outline-none">
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── FILTER & TAG PILLS ────────────────────────────────────────────────────

function FilterPill({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const activeStyle = { border: "1px solid transparent", background: GRADIENT, color: "#fff" };
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="font-mono text-[10px] tracking-widest px-3 py-[5px] outline-none transition-all duration-200"
      style={active ? activeStyle : gradientBorder(hov)}>
      {label}{count !== undefined && <span className="ml-2 opacity-60">{count}</span>}
    </button>
  );
}

function TagPill({ tag, onNavigate }: { tag: string; onNavigate: (filter: string) => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={() => onNavigate(tag)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="px-3 py-[4px] font-mono text-[10px] tracking-widest transition-all duration-200 outline-none"
      style={gradientBorder(hov)}>
      {tag}
    </button>
  );
}

// ─── PROJECT CARD ──────────────────────────────────────────────────────────

function ProjectCard({ project, navigate, onTagClick, idx, lang, centered, registerRef }: {
  project: Project; navigate: (id: string) => void; onTagClick: (filter: string) => void; idx: number; lang: Lang;
  centered: boolean; registerRef: (id: string, el: HTMLElement | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const projectTitle = t(project.title, lang);
  const isActive = hovered || centered;

  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: idx * 0.06 }} className="border-t border-border">
      <div
        ref={(el) => registerRef(project.id, el)}
        role="button"
        tabIndex={0}
        onClick={() => navigate(project.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(project.id); } }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full text-left pt-6 md:pt-8 pb-8 md:pb-12 cursor-pointer"
      >
        <ParallaxImg
          src={project.coverImage} alt={projectTitle} px={30} hovered={isActive}
          aspectRatio="16 / 7"
          objectPosition={`50% ${project.coverImagePosition ?? 50}%`}
          className="w-full bg-muted mb-5"
        />
        <div className="flex items-start justify-between gap-8">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">{project.index}</span>
              <motion.div animate={{ width: isActive ? 14 : 0, opacity: isActive ? 1 : 0 }} transition={{ duration: 0.2, ease: EASE }} style={{ background: GRADIENT }} className="h-px shrink-0" />
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">{t(project.category, lang)}&ensp;·&ensp;{project.year}</span>
            </div>
            <div className="font-display font-black leading-[0.9] transition-colors duration-200" style={{ fontSize: "clamp(26px, 3.5vw, 48px)", letterSpacing: "-0.01em", color: isActive ? "#0246F3" : "var(--foreground)" }}>
              {projectTitle}
            </div>
            <div className="flex flex-wrap gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
              {project.tags.map((tag, i) => {
                const label = t(tag, lang);
                return <TagPill key={`${project.id}-tag-${i}-${label}`} tag={label} onNavigate={onTagClick} />;
              })}
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end gap-4 shrink-0 max-w-xs text-right">
            <p className="text-sm font-light text-muted-foreground leading-relaxed whitespace-pre-line">{t(project.excerpt, lang)}</p>
            <AnimatedArrow hovered={isActive} size={16} color={isActive ? "#0246F3" : "var(--muted-foreground)"} />
          </div>
          <div className="flex md:hidden shrink-0 pt-1">
            <AnimatedArrow hovered={isActive} size={16} color={isActive ? "#0246F3" : "var(--muted-foreground)"} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── PROJECTS SECTION ──────────────────────────────────────────────────────

function ProjectsSection({ navigate, activeFilter, setActiveFilter, lang }: {
  navigate: (id: string) => void; activeFilter: string; setActiveFilter: (f: string) => void; lang: Lang;
}) {
  const ui = UI[lang];
  const ALL = lang === "fr" ? "Tous" : "All";
  const isMobile = useIsMobile();
  const [centeredId, setCenteredId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerCard = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (!isMobile) { setCenteredId(null); return; }
    let raf = 0;
    const update = () => {
      const viewportCenter = window.innerHeight / 2;
      let closestId: string | null = null;
      let closestDist = Infinity;
      cardRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const dist = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (dist < closestDist) { closestDist = dist; closestId = id; }
      });
      setCenteredId(closestId);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isMobile, activeFilter]);

  const availableTags = (() => {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const project of projects) {
      for (const tag of project.tags) {
        const label = t(tag, lang).trim();
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        tags.push(label);
      }
    }
    return tags;
  })();

  const filtered = (activeFilter === "Tous" || activeFilter === "All")
    ? projects
    : projects.filter((p) => p.tags.some((tag) => t(tag, lang) === activeFilter));

  return (
    <section id="projets" className="px-6 md:px-12 pb-24 md:pb-36">
      <div className="mb-10 flex flex-col gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, ease: EASE }}>
          <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground">{ui.selectedWorks(projects.length)}</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, ease: EASE, delay: 0.08 }} className="flex flex-wrap gap-2">
          {[ALL, ...availableTags].map((tag) => {
            const active = tag === ALL ? (activeFilter === "Tous" || activeFilter === "All") : activeFilter === tag;
            return (
              <FilterPill key={tag} label={tag} active={active}
                count={active && tag !== ALL ? filtered.length : undefined}
                onClick={() => setActiveFilter(tag === ALL ? (lang === "fr" ? "Tous" : "All") : tag)} />
            );
          })}
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeFilter} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
          {filtered.length > 0 ? (
            <>{filtered.map((p, i) => <ProjectCard key={p.id} project={p} navigate={navigate} onTagClick={setActiveFilter} idx={i} lang={lang} centered={centeredId === p.id} registerRef={registerCard} />)}<div className="border-t border-border" /></>
          ) : (
            <div className="py-20 text-center"><span className="font-mono text-[11px] tracking-widest uppercase text-muted-foreground">{ui.noProjects}</span></div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ─── ABOUT ─────────────────────────────────────────────────────────────────

function AboutSection({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  return (
    <section id="apropos" className="border-t border-border px-6 md:px-12 py-20 md:py-32">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, ease: EASE }} className="md:col-span-3">
          <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground">{ui.about}</span>
          <div className="mt-8 hidden md:block" style={{ width: 80, height: 80 }}><Logo /></div>
        </motion.div>
        <div className="md:col-span-9 space-y-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }}>
            <p className="text-lg md:text-xl leading-relaxed font-light whitespace-pre-line">{ui.bio}</p>
            <p className="text-base leading-relaxed font-light text-muted-foreground mt-4 whitespace-pre-line">{ui.bio2}</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}>
              <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground block mb-4">{ui.skills}</span>
              <div className="flex flex-wrap gap-2">{ui.skillsList.map((s) => <span key={s} className="border border-border px-3 py-[5px] font-mono text-[10px] tracking-widest uppercase">{s}</span>)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, ease: EASE, delay: 0.14 }}>
              <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground block mb-4">{ui.tools}</span>
              <div className="flex flex-wrap gap-2">{ui.toolsList.map((t) => <span key={t} className="border border-border px-3 py-[5px] font-mono text-[10px] tracking-widest uppercase">{t}</span>)}</div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CONTACT ───────────────────────────────────────────────────────────────

function ContactLink({ href, label, arrow, external }: { href: string; label: string; arrow?: boolean; external?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase transition-colors duration-200"
      style={{ color: hov ? "#0246F3" : "var(--muted-foreground)" }}>
      <span>{label}</span>
      {arrow && <AnimatedArrow hovered={hov} size={11} color={hov ? "#0246F3" : "var(--muted-foreground)"} />}
    </a>
  );
}

function ContactSection({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  const lines = ui.together.split("\n");
  return (
    <section id="contact" className="border-t border-border px-6 md:px-12 py-20 md:py-32">
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, ease: EASE }} className="mb-10">
        <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground">{ui.contact}</span>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-12 items-end gap-10">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="md:col-span-9">
          <h2 className="font-display font-black uppercase tracking-[-0.02em] leading-[0.9]" style={{ fontSize: "clamp(44px, 9vw, 130px)" }}>
            {lines.map((l, i) => <span key={i} className="block">{l}</span>)}
          </h2>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.25 }} className="md:col-span-3 flex flex-col gap-4">
          <ContactLink href={`mailto:${landingData.email}`} label={landingData.email} arrow />
          <ContactLink href={`tel:${landingData.phone.replace(/\s+/g, "")}`} label={landingData.phone} />
          {landingData.links.map((link) => (
            <ContactLink key={link.url} href={link.url} label={link.label} arrow external />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────────────

function Footer({ lang, navigate }: { lang: Lang; navigate: (id: string) => void }) {
  return (
    <footer className="border-t border-border px-6 md:px-12 py-5">
      <div className="flex flex-col items-center md:flex-row md:justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground tracking-[0.22em] uppercase">© {CURRENT_YEAR} {landingData.name}</span>
        <button onClick={() => navigate("mentions-legales")} className="font-mono text-[10px] text-muted-foreground tracking-[0.22em] uppercase hover:text-primary transition-colors duration-200">
          {lang === "fr" ? "Mentions légales" : "Legal notice"}
        </button>
      </div>
    </footer>
  );
}

// ─── LEGAL NOTICE ──────────────────────────────────────────────────────────

function LegalNoticePage({ navigate, lang }: { navigate: (id: string) => void; lang: Lang }) {
  const ui = UI[lang];
  const [backHovered, setBackHovered] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const sections: { title: string; body: React.ReactNode }[] = [
    {
      title: "Éditeur du site",
      body: (
        <p>
          Le présent site est édité par <strong>{landingData.name}</strong>, domicilié au 7 rue Cressent, Noisy-le-Grand 93160.
          <br />
          Contact : <a className="underline hover:text-primary" href={`mailto:${landingData.email}`}>{landingData.email}</a>
          {landingData.phone && <> — {landingData.phone}</>}
          <br />
          Directeur de la publication : {landingData.name}.
        </p>
      ),
    },
    {
      title: "Hébergement",
      body: (
        <p>
          Ce site est déployé et hébergé par <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — <a className="underline hover:text-primary" href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>.
          <br />
          La distribution du contenu et la protection réseau sont assurées par <strong>Cloudflare, Inc.</strong>, 101 Townsend St., San Francisco, CA 94107, États-Unis — <a className="underline hover:text-primary" href="https://cloudflare.com" target="_blank" rel="noopener noreferrer">cloudflare.com</a>.
        </p>
      ),
    },
    {
      title: "Propriété intellectuelle",
      body: (
        <p>
          L'ensemble des contenus présents sur ce site (textes, images, identités visuelles, projets présentés) est la propriété de {landingData.name}, sauf mention contraire, et ne peut être reproduit, distribué ou réutilisé sans autorisation préalable.
        </p>
      ),
    },
    {
      title: "Données personnelles",
      body: (
        <p>
          Ce site ne comporte aucun formulaire de collecte de données et n'utilise aucun outil d'analyse d'audience ou traceur publicitaire. Les seules informations conservées localement dans votre navigateur (langue et thème clair/sombre choisis) servent uniquement à mémoriser votre préférence d'affichage d'une visite à l'autre ; elles ne sont ni transmises, ni partagées, et peuvent être effacées à tout moment via les paramètres de votre navigateur.
          <br />
          Les polices de caractères sont hébergées directement sur ce site (aucune requête vers des serveurs tiers). Les vidéos intégrées utilisent le mode de confidentialité renforcée de YouTube, qui ne dépose pas de cookie tant que vous n'interagissez pas avec le lecteur.
          <br />
          Pour toute question relative à vos données, vous pouvez nous contacter à{" "}
          <a className="underline hover:text-primary" href={`mailto:${landingData.email}`}>{landingData.email}</a>.
        </p>
      ),
    },
    {
      title: "Liens externes",
      body: (
        <p>
          Ce site peut contenir des liens vers des sites tiers (réseaux sociaux, plateformes vidéo). {landingData.name} n'est pas responsable du contenu ni des pratiques de confidentialité de ces sites externes.
        </p>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }}>
      <div className="px-6 md:px-12 pt-10 md:pt-14 pb-16 md:pb-24 max-w-3xl">
        <button onClick={() => navigate("home")} onMouseEnter={() => setBackHovered(true)} onMouseLeave={() => setBackHovered(false)}
          className="mb-10 flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground hover:text-primary transition-colors duration-200">
          <ConveyorArrow direction="left" hovered={backHovered} />
          <span>{ui.back}</span>
        </button>
        <h1 className="font-display font-black tracking-[-0.02em] leading-[0.95] mb-3" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
          {lang === "fr" ? "Mentions légales" : "Legal notice"}
        </h1>
        {lang !== "fr" && (
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-10">
            This legal notice is provided in French, as required under French law.
          </p>
        )}
        <div className="space-y-10 mt-10">
          {sections.map((s) => (
            <div key={s.title} className="border-t border-border pt-6">
              <h2 className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground mb-3">{s.title}</h2>
              <div className="text-sm font-light leading-relaxed text-foreground">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer lang={lang} navigate={navigate} />
    </motion.div>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────

function GradientBar() {
  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ scaleY: { duration: 0.65, ease: EASE, delay: 0.25 } }}
      style={{ originY: "0%" }}
      className="absolute right-0 top-0 bottom-0 w-3 md:w-[14px] overflow-hidden"
    >
      <div className="hero-gradient-track absolute inset-x-0 -top-full h-[200%]">
        <div className="h-1/2 hero-gradient-segment" />
        <div className="h-1/2 hero-gradient-segment" />
      </div>
    </motion.div>
  );
}

function HoverGrid({ cellSize = 40 }: { cellSize?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ cols: 0, rows: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ cols: Math.max(1, Math.floor(width / cellSize)), rows: Math.max(1, Math.floor(height / cellSize)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cellSize]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0"
      style={{ zIndex: 1, display: "grid", gridTemplateColumns: `repeat(${dims.cols || 1}, 1fr)`, gridTemplateRows: `repeat(${dims.rows || 1}, 1fr)` }}
    >
      {Array.from({ length: dims.cols * dims.rows }).map((_, i) => (
        <div key={i} className="hero-grid-cell" />
      ))}
    </div>
  );
}

function Hero({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  return (
    <section className="min-h-screen flex flex-col justify-between px-6 md:px-12 pb-10 relative overflow-hidden" style={{ minHeight: "100svh" }}>
      <HoverGrid />
      <div className="flex justify-between items-start pt-10 md:pt-14">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }} className="max-w-[52%] md:max-w-none font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground leading-relaxed">
          <div>{ui.title}</div>
          <div>{ui.location}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.65 }} className="font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground text-right leading-relaxed">
          <div>{ui.portfolio}</div>
          <div>{CURRENT_YEAR}</div>
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-10">
        <div className="relative">
          <GradientBar />
          <div className="overflow-hidden">
            <motion.div initial={{ y: "110%" }} animate={{ y: "0%" }} transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
              className="font-display font-black leading-[0.9] tracking-[-0.02em] uppercase" style={{ fontSize: "clamp(56px, 13vw, 196px)" }}>
              ALIX
            </motion.div>
          </div>
          <div className="overflow-hidden">
            <motion.div initial={{ y: "110%" }} animate={{ y: "0%" }} transition={{ duration: 0.7, ease: EASE, delay: 0.13 }}
              className="font-display font-black leading-[0.9] tracking-[-0.02em] uppercase" style={{ fontSize: "clamp(56px, 13vw, 196px)" }}>
              LABONNE
            </motion.div>
          </div>
        </div>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.55, ease: EASE, delay: 0.48 }} style={{ originX: "0%" }} className="h-px bg-foreground mt-6 md:mt-8 mb-5 md:mb-7" />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.65 }} className="font-mono text-[11px] tracking-[0.28em] text-muted-foreground">
          {ui.tagline}
        </motion.p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.85 }} className="flex justify-end relative z-10">
        <button onClick={() => document.getElementById("projets")?.scrollIntoView({ behavior: "smooth" })}
          className="group flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground hover:text-primary transition-colors duration-200">
          <span>{ui.viewProjects}</span>
          <ConveyorArrow direction="down" />
        </button>
      </motion.div>
    </section>
  );
}

// ─── HOME PAGE ─────────────────────────────────────────────────────────────

function HomePage({ navigate, activeFilter, setActiveFilter, lang }: {
  navigate: (id: string) => void; activeFilter: string; setActiveFilter: (f: string) => void; lang: Lang;
}) {
  return (
    <motion.div key="home" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }}>
      <Hero lang={lang} />
      <ProjectsSection navigate={navigate} activeFilter={activeFilter} setActiveFilter={setActiveFilter} lang={lang} />
      <AboutSection lang={lang} />
      <ContactSection lang={lang} />
      <Footer lang={lang} navigate={navigate} />
    </motion.div>
  );
}

// ─── PARALLAX IMAGE ────────────────────────────────────────────────────────

function ParallaxImg({ src, alt, px = 40, hovered = false, aspectRatio, className = "", objectPosition, onClick, children }: {
  src: string; alt: string; px?: number; hovered?: boolean;
  aspectRatio?: string; className?: string; objectPosition?: string; onClick?: () => void; children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const effectivePx = isMobile ? Math.min(px, 10) : px;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [effectivePx, -effectivePx]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      <motion.img
        src={src}
        alt={alt}
        className="absolute left-0 w-full object-cover"
        animate={{ scale: hovered ? 1.03 : 1 }}
        transition={{ duration: 0.65, ease: EASE }}
        style={{ y, top: -effectivePx, height: `calc(100% + ${effectivePx * 2}px)`, objectPosition: objectPosition ?? "50% 50%" }}
      />
      {children}
    </div>
  );
}

// ─── PARALLAX COVER ────────────────────────────────────────────────────────

function ParallaxCover({ src, alt, position, onOpen }: { src: string; alt: string; position?: number; onOpen: () => void }) {
  return (
    <ParallaxImg
      src={src} alt={alt} px={PARALLAX_PX}
      aspectRatio="16 / 7"
      objectPosition={`50% ${position ?? 50}%`}
      className="w-full bg-muted cursor-zoom-in group"
      onClick={onOpen}
    >
      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-8 h-8 bg-background flex items-center justify-center">
          <ArrowUpRight size={13} />
        </div>
      </div>
    </ParallaxImg>
  );
}

// ─── NEXT PROJECT ──────────────────────────────────────────────────────────

function NextProjectButton({ project, navigate, lang }: { project: Project; navigate: (id: string) => void; lang: Lang }) {
  const [hov, setHov] = useState(false);
  const projectTitle = t(project.title, lang);
  return (
    <button onClick={() => navigate(project.id)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="w-full px-6 md:px-12 py-12 md:py-16 flex items-center justify-between transition-colors duration-300"
      style={{ backgroundColor: hov ? "var(--secondary)" : "transparent" }}>
      <div className="text-left">
        <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground block mb-3">{UI[lang].nextProject}</span>
        <span className="font-display font-black leading-none block transition-colors duration-200"
          style={{ fontSize: "clamp(32px, 6vw, 72px)", letterSpacing: "-0.01em", color: hov ? "#0246F3" : "var(--foreground)" }}>
          {projectTitle}
        </span>
      </div>
      <AnimatedArrow hovered={hov} size={28} color={hov ? "#0246F3" : "var(--muted-foreground)"} />
    </button>
  );
}

// ─── PROJECT PAGE ──────────────────────────────────────────────────────────

function ProjectPage({ project, navigate, navigateWithFilter, lang }: {
  project: Project; navigate: (id: string) => void; navigateWithFilter: (filter: string) => void; lang: Lang;
}) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const openLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const ui = UI[lang];

  useEffect(() => { window.scrollTo({ top: 0 }); }, [project.id]);

  const currentIdx = projects.findIndex((p) => p.id === project.id);
  const nextProject = projects[(currentIdx + 1) % projects.length];
  const projectTitle = t(project.title, lang);

  return (
    <>
      <motion.div key={project.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }}>
        <div className="px-6 md:px-12 pt-8 md:pt-14 pb-0">
          <div className="flex items-start justify-between mb-6">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground">
              {project.index}&nbsp;/&nbsp;0{projects.length}
            </motion.span>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="font-mono text-[11px] tracking-[0.28em] uppercase text-muted-foreground">
              {project.year}
            </motion.span>
          </div>
          <div className="overflow-hidden mb-2 pb-[0.12em]">
            <motion.h1 initial={{ y: "105%" }} animate={{ y: "0%" }} transition={{ duration: 0.65, ease: EASE }}
              className="font-display font-black tracking-[-0.02em] leading-[0.88]" style={{ fontSize: "clamp(56px, 11vw, 168px)" }}>
              {projectTitle}
            </motion.h1>
          </div>
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.22 }} className="flex items-center gap-4 mb-10 md:mb-14">
            <div className="w-8 h-px" style={{ background: GRADIENT }} />
            <span className="font-mono text-[11px] tracking-[0.28em] text-muted-foreground">{t(project.category, lang)}</span>
          </motion.div>
        </div>

        <ParallaxCover src={project.coverImage} alt={projectTitle} position={project.coverImagePosition} onOpen={() => openLightbox(project.coverImage, projectTitle)} />

        <div className="px-6 md:px-12 py-8 md:py-10 flex flex-col md:flex-row gap-6 md:gap-10 border-b border-border">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.28 }} className="shrink-0">
            <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-3">{ui.year}</span>
            <span className="font-mono text-sm font-medium">{project.year}</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.35 }} className="shrink-0">
            <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-3">{ui.tags}</span>
            <div className="flex flex-wrap gap-2">{project.tags.map((tag, i) => {
              const label = t(tag, lang);
              return <TagPill key={`${project.id}-tag-${i}-${label}`} tag={label} onNavigate={navigateWithFilter} />;
            })}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.42 }} className="flex-1 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-muted-foreground block mb-3">{ui.overview}</span>
            <p className="text-sm font-light text-muted-foreground leading-relaxed whitespace-pre-line">{t(project.excerpt, lang)}</p>
          </motion.div>
        </div>

        <ContentRenderer blocks={project.content} onOpen={openLightbox} lang={lang} />

        <div className="border-t border-border">
          <NextProjectButton project={nextProject} navigate={navigate} lang={lang} />
        </div>
        <Footer lang={lang} navigate={navigate} />
      </motion.div>

      <AnimatePresence>
        {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />}
      </AnimatePresence>
    </>
  );
}

// ─── PREVIEW APP (editor preview) ─────────────────────────────────────────

function PreviewApp({ project }: { project: Project }) {
  const [lang, setLang] = useState<Lang>(() => getInitialLang());
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "var(--font-body)" }}>
      <style>{`.font-display { font-family: var(--font-display); } .font-mono { font-family: var(--font-mono); }`}</style>
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground border border-border bg-background px-2 py-1">Aperçu éditeur</span>
        <button onClick={() => setLang((l) => l === "fr" ? "en" : "fr")} className="font-mono text-[9px] tracking-widest uppercase border border-border bg-background px-2 py-1 text-muted-foreground hover:text-foreground transition-colors">{lang.toUpperCase()}</button>
        <button onClick={() => setDark((d) => !d)} className="border border-border bg-background px-2 py-1 text-muted-foreground hover:text-foreground transition-colors">{dark ? <Sun size={11} /> : <Moon size={11} />}</button>
      </div>
      <ProjectPage project={project} navigate={() => window.close()} navigateWithFilter={() => {}} lang={lang} />
    </div>
  );
}

// ─── APP ───────────────────────────────────────────────────────────────────

function PortfolioApp() {
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get("p") ?? "home");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [lang, setLang] = useState<Lang>(() => getInitialLang());
  const [dark, setDark] = useState(() => getInitialDark());
  const pendingScrollRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.lang = lang;
    localStorage.setItem("theme", dark ? "dark" : "light");
    localStorage.setItem("lang", lang);
  }, [dark, lang]);

  const navigate = useCallback((id: string) => {
    setPage(id);
    const url = new URL(window.location.href);
    if (id === "home") url.searchParams.delete("p");
    else url.searchParams.set("p", id);
    window.history.pushState({ page: id }, "", url);
  }, []);

  const navigateWithFilter = useCallback((filter: string) => {
    setActiveFilter(filter);
    navigate("home");
    pendingScrollRef.current = true;
  }, [navigate]);

  useEffect(() => {
    const onPopState = () => setPage(new URLSearchParams(window.location.search).get("p") ?? "home");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (page === "home" && pendingScrollRef.current) {
      pendingScrollRef.current = false;
      const id = setTimeout(() => document.getElementById("projets")?.scrollIntoView({ behavior: "smooth" }), 500);
      return () => clearTimeout(id);
    }
  }, [page]);

  const currentProject = projects.find((p) => p.id === page);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "var(--font-body)" }}>
      <style>{`
        .font-display { font-family: var(--font-display); }
        .font-mono { font-family: var(--font-mono); }
        .hero-gradient-segment {
          background: linear-gradient(to bottom, #0246F3 0%, #4A7DF1 50%, #0246F3 100%);
        }
        @keyframes heroStripeShift {
          from { transform: translateY(0%); }
          to { transform: translateY(50%); }
        }
        .hero-gradient-track {
          animation: heroStripeShift 3.2s linear infinite;
          will-change: transform;
        }
      `}</style>

      {/* Desktop: fixed left rail */}
      <SideNav page={page} navigate={navigate} lang={lang} setLang={setLang} dark={dark} setDark={setDark} />

      {/* Mobile: top bar */}
      <MobileNav page={page} navigate={navigate} lang={lang} setLang={setLang} dark={dark} setDark={setDark} />

      {/* Page content — offset from left rail on desktop, from top bar on mobile */}
      <div className="pt-[52px] md:pt-0 md:pl-[60px]">

        <AnimatePresence mode="wait">
          {page === "home" ? (
            <HomePage key="home" navigate={navigate} activeFilter={activeFilter} setActiveFilter={setActiveFilter} lang={lang} />
          ) : page === "mentions-legales" ? (
            <LegalNoticePage key="mentions-legales" navigate={navigate} lang={lang} />
          ) : currentProject ? (
            <ProjectPage key={page} project={currentProject} navigate={navigate} navigateWithFilter={navigateWithFilter} lang={lang} />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isEditorRoute = import.meta.env.DEV && (params.get("editor") === "true" || params.get("preview") === "editor");

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    if (isEditorRoute) {
      if (robots) {
        robots.setAttribute("content", "noindex, nofollow");
      } else {
        const meta = document.createElement("meta");
        meta.name = "robots";
        meta.content = "noindex, nofollow";
        document.head.appendChild(meta);
      }
      return;
    }
    if (robots?.getAttribute("content") === "noindex, nofollow") {
      robots.remove();
    }
  }, [isEditorRoute]);

  if (import.meta.env.DEV && EditorPage) {
    if (params.get("editor") === "true") {
      return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center font-mono text-muted-foreground text-xs tracking-widest uppercase">Chargement…</div>}>
          <EditorPage />
        </Suspense>
      );
    }
    if (params.get("preview") === "editor") {
      const raw = localStorage.getItem("editor-preview");
      if (raw) {
        try {
          const previewProject = JSON.parse(raw) as Project;
          return <PreviewApp project={previewProject} />;
        } catch {
          localStorage.removeItem("editor-preview");
        }
      }
    }
  }
  return <PortfolioApp />;
}
