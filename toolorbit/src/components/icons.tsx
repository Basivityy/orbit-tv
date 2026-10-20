import {
  AlarmClock, AlignLeft, ArrowDownUp, ArrowRightLeft, BadgePercent, Barcode, Binary, Blend, Bot, Braces, Briefcase, Brush,
  Cake, Calculator, CalendarClock, CalendarDays, Car, CaseSensitive, CaseUpper, Clipboard, Clock, Code, Coffee, Columns3,
  Combine, Contact, Contrast, Cookie, CopyMinus, Cpu, Crop, Database, Dices, DollarSign, Droplet, Droplets, Eraser, Eye,
  EyeOff, FileCode, FileImage, FileJson, FileMinus, FileOutput, FilePlus, FileSearch, FileStack, FileText, FileType,
  Fingerprint, FlipHorizontal2, Fuel, GitCompare, Globe, Hash, HardDrive, HeartPulse, Hexagon, Home, Hourglass, Image,
  ImageDown, ImageMinus, ImagePlus, Images, Info, Keyboard, KeyRound, Landmark, Languages, Layers, Link, ListOrdered, Lock,
  Mail, Maximize, Megaphone, MessageSquare, Minimize2, Monitor, MonitorSmartphone, MousePointerClick, Network, Palette,
  PenLine, Percent, PiggyBank, Pipette, QrCode, Quote, Ratio, Receipt, Regex, Repeat, Replace, RotateCw, Ruler, Scale,
  ScanLine, ScanQrCode, Scissors, ShieldCheck, Shuffle, Smartphone, Sparkles, Square, SquareDashed, Stamp, Sun, Superscript,
  Table, Tags, Thermometer, Timer, Trash2, TrendingUp, Type, Undo2, Users, Watch, Wifi, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icon set. Admins choose icons by key, so only these icons are bundled
 * (importing the full lucide set would add hundreds of kilobytes).
 */
export const ICONS: Record<string, LucideIcon> = {
  "alarm-clock": AlarmClock, "align-left": AlignLeft, "arrow-down-up": ArrowDownUp, "arrow-right-left": ArrowRightLeft,
  "badge-percent": BadgePercent, barcode: Barcode, binary: Binary, blend: Blend, bot: Bot, braces: Braces,
  briefcase: Briefcase, brush: Brush, cake: Cake, calculator: Calculator, "calendar-clock": CalendarClock,
  "calendar-days": CalendarDays, car: Car, "case-sensitive": CaseSensitive, "case-upper": CaseUpper, clipboard: Clipboard,
  clock: Clock, code: Code, coffee: Coffee, columns: Columns3, combine: Combine, contact: Contact, contrast: Contrast,
  cookie: Cookie, "copy-minus": CopyMinus, cpu: Cpu, crop: Crop, database: Database, dices: Dices, dollar: DollarSign,
  droplet: Droplet, droplets: Droplets, eraser: Eraser, eye: Eye, "eye-off": EyeOff, "file-code": FileCode,
  "file-image": FileImage, "file-json": FileJson, "file-minus": FileMinus, "file-output": FileOutput, "file-plus": FilePlus,
  "file-search": FileSearch, "file-stack": FileStack, "file-text": FileText, "file-type": FileType,
  fingerprint: Fingerprint, flip: FlipHorizontal2, fuel: Fuel, "git-compare": GitCompare, globe: Globe, hash: Hash,
  "hard-drive": HardDrive, "heart-pulse": HeartPulse, hexagon: Hexagon, home: Home, hourglass: Hourglass, image: Image,
  "image-down": ImageDown, "image-minus": ImageMinus, "image-plus": ImagePlus, images: Images, info: Info,
  keyboard: Keyboard, key: KeyRound, landmark: Landmark, languages: Languages, layers: Layers, link: Link,
  "list-ordered": ListOrdered, lock: Lock, mail: Mail, maximize: Maximize, megaphone: Megaphone, message: MessageSquare,
  minimize: Minimize2, monitor: Monitor, "monitor-smartphone": MonitorSmartphone, mouse: MousePointerClick,
  network: Network, palette: Palette, pen: PenLine, percent: Percent, "piggy-bank": PiggyBank, pipette: Pipette,
  "qr-code": QrCode, quote: Quote, ratio: Ratio, receipt: Receipt, regex: Regex, repeat: Repeat, replace: Replace,
  rotate: RotateCw, ruler: Ruler, scale: Scale, scan: ScanLine, "scan-qr": ScanQrCode, scissors: Scissors,
  shield: ShieldCheck, shuffle: Shuffle, smartphone: Smartphone, sparkles: Sparkles, square: Square,
  "square-dashed": SquareDashed, stamp: Stamp, sun: Sun, superscript: Superscript, table: Table, tags: Tags,
  thermometer: Thermometer, timer: Timer, trash: Trash2, "trending-up": TrendingUp, type: Type, undo: Undo2,
  users: Users, watch: Watch, wifi: Wifi, wrench: Wrench, zap: Zap,
};

export const ICON_KEYS = Object.keys(ICONS).sort();

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Wrench;
  return <Icon className={className} aria-hidden="true" />;
}
