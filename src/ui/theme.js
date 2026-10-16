// Apen Apps terminal theme.
// Brand palette (from the Apen Apps brand kit):
//   Brand Blue   #00aeef  — secondary accent
//   Brand Orange #f15a29  — primary accent, "Apps" text
//   Primary gradient: Brand Blue → Brand Orange
import pc from "picocolors";

export const BRAND = {
  blue: [0, 174, 239],
  orange: [241, 90, 41],
};

const enabled = pc.isColorSupported;
const truecolor =
  enabled &&
  (/truecolor|24bit/i.test(process.env.COLORTERM ?? "") ||
    ["iTerm.app", "vscode", "WarpTerminal", "WezTerm", "ghostty", "Hyper"].includes(process.env.TERM_PROGRAM ?? "") ||
    Boolean(process.env.WT_SESSION));

// Closest xterm-256 colors when the terminal has no truecolor support.
const FALLBACK_256 = { "0,174,239": 39, "241,90,41": 202 };

function rgb([r, g, b]) {
  if (!enabled) return (s) => String(s);
  if (truecolor) return (s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
  const code = FALLBACK_256[`${r},${g},${b}`] ?? 208;
  return (s) => `\x1b[38;5;${code}m${s}\x1b[39m`;
}

export const blue = rgb(BRAND.blue);
export const orange = rgb(BRAND.orange);
export const { bold, dim, gray, red, green, yellow, inverse, underline, strikethrough } = pc;
export const muted = (s) => pc.dim(s);

/** Paints text with the Apen blue → orange gradient, column by column. */
export function gradient(text) {
  if (!enabled) return text;
  const lines = text.split("\n");
  const width = Math.max(...lines.map((l) => [...l].length), 2);
  return lines
    .map((line) =>
      [...line]
        .map((ch, i) => {
          if (ch === " ") return ch;
          const t = i / (width - 1);
          const mix = BRAND.blue.map((c, k) => Math.round(c + (BRAND.orange[k] - c) * t));
          return truecolor ? rgb(mix)(ch) : (t < 0.5 ? blue : orange)(ch);
        })
        .join("")
    )
    .join("\n");
}

const LOGO = [
  " █████╗ ██████╗ ███████╗███╗   ██╗",
  "██╔══██╗██╔══██╗██╔════╝████╗  ██║",
  "███████║██████╔╝█████╗  ██╔██╗ ██║",
  "██╔══██║██╔═══╝ ██╔══╝  ██║╚██╗██║",
  "██║  ██║██║     ███████╗██║ ╚████║",
  "╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═══╝",
].join("\n");

export function banner(version) {
  const lines = [
    "",
    gradient(LOGO),
    `  ${bold(orange("A P P S"))}   ${dim("·")}   ${bold("create-apen")} ${dim(`v${version}`)}`,
    `  ${dim("Scaffold production-ready stacks — your structure, your conventions.")}`,
    "",
  ];
  return lines.join("\n");
}

// Symbols used across the prompt UI.
export const S = {
  bar: "│",
  barStart: "┌",
  barEnd: "└",
  step: "◆",
  stepDone: "◇",
  stepCancel: "■",
  radioOn: "●",
  radioOff: "○",
  checkOn: "◼",
  checkOff: "◻",
  info: "●",
  success: "✔",
  warn: "▲",
  error: "✖",
  pointer: "›",
};
