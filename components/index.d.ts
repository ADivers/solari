import type * as React from 'react';

/** Characters a flap can show, in drum order. Anything else renders blank. */
export declare const DRUM: string;

export interface SplitFlapProps {
  /** One message. Uppercased; characters outside the drum render blank. */
  text?: string;
  /** Several messages; the board flips to the next every `interval` ms. Overrides `text`. */
  messages?: string[];
  /** Milliseconds each message holds once its flaps have landed, when cycling. Default 3500. */
  interval?: number;
  /** Number of flap cells. Default: the longest message. Longer text is cut off. */
  length?: number;
  /** Cell height: a token step or any CSS length / px number. Ignored when `fit` is set. Default 'md'. */
  size?: 'sm' | 'md' | 'lg' | number | string;
  /** Stretch the board to its parent's width; cells scale to fit. */
  fit?: boolean;
  /** Largest cell height in px when `fit` is set. Default 120. */
  maxHeight?: number;
  /** Character colour. Default 'white' (flap-ink). */
  color?: 'white' | 'yellow';
  /** Per-cell colour override, by index. */
  cellColors?: Array<'yellow' | null | undefined>;
  align?: 'left' | 'center' | 'right';
  /** Milliseconds per flip. Default 70. */
  speed?: number;
  /** Delay before each successive cell starts moving, ms. Default 35. */
  stagger?: number;
  /** Start blank and flip the first message in on mount. Default true. */
  boot?: boolean;
  /** No housing: cells only. Used inside DepartureBoard. */
  bare?: boolean;
  /** Announce message changes politely to screen readers. Default false. */
  live?: boolean;
  /** Accessible text. Default: the current message. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SplitFlap(props: SplitFlapProps): React.ReactElement;

export interface DepartureColumn {
  key: string;
  /** Header, set in mono capitals on the housing. */
  label: string;
  /** Column width in flap cells. */
  width: number;
  align?: 'left' | 'center' | 'right';
  color?: 'white' | 'yellow';
}
export type DepartureCell = string | number | { text: string; color?: 'white' | 'yellow' | null };
export interface DepartureBoardProps {
  columns: DepartureColumn[];
  rows: Array<Record<string, DepartureCell>>;
  /** Minimum rows shown; missing rows are blank flaps. */
  rowCount?: number;
  size?: 'sm' | 'md' | 'lg' | number | string;
  /** Small caption above the board, left. */
  title?: string;
  /** Slot above the board, right — usually a StatusFlap or Clock. */
  aside?: React.ReactNode;
  /** Table name for assistive tech. Default: title. */
  label?: string;
  speed?: number;
  stagger?: number;
  className?: string;
}
export declare function DepartureBoard(props: DepartureBoardProps): React.ReactElement;

export interface ClockProps {
  /** Mono caption above the clock. */
  caption?: string;
  /** Show HH:MM:SS. Default false (HH:MM). */
  seconds?: boolean;
  size?: 'sm' | 'md' | 'lg' | number | string;
  color?: 'white' | 'yellow';
  speed?: number;
  boot?: boolean;
}
export declare function Clock(props: ClockProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  /** Trailing arrow, for buttons that move you on (Buy tickets →). */
  arrow?: boolean;
  /** Renders an <a> instead of a <button>. */
  href?: string;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface NavLink { label: string; href?: string; active?: boolean }
export interface NavBarProps {
  /** Wordmark text, rendered as a small SplitFlap. */
  brand: string;
  brandHref?: string;
  brandColor?: 'white' | 'yellow';
  brandSize?: 'sm' | 'md' | number;
  links?: NavLink[];
  /** Right-hand slot, usually one Button. */
  action?: React.ReactNode;
  boot?: boolean;
  className?: string;
}
export declare function NavBar(props: NavBarProps): React.ReactElement;

export interface PanelProps {
  /** Mono capital label above the title. */
  label?: string;
  title?: string;
  /** 'board' sets the panel on the black housing in every theme. */
  tone?: 'default' | 'board';
  children?: React.ReactNode;
  className?: string;
}
export declare function Panel(props: PanelProps): React.ReactElement;

export interface StatusFlapProps {
  /** ok: white on flap · warn: black on yellow · alert: white on red · off: muted. */
  state?: 'ok' | 'warn' | 'alert' | 'off';
  /** The status word — always provide one. */
  children: React.ReactNode;
  className?: string;
}
export declare function StatusFlap(props: StatusFlapProps): React.ReactElement;

declare global {
  interface Window {
    Solari: {
      SplitFlap: typeof SplitFlap; DepartureBoard: typeof DepartureBoard; Clock: typeof Clock;
      Button: typeof Button; NavBar: typeof NavBar; Panel: typeof Panel; StatusFlap: typeof StatusFlap;
      DRUM: string;
    };
  }
}
