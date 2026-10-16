// Apen-themed prompt components built on the headless @clack/core prompts.
import { TextPrompt, SelectPrompt, MultiSelectPrompt, ConfirmPrompt, isCancel } from "@clack/core";
import { S, blue, orange, gradient, bold, dim, red, yellow, green, strikethrough } from "./theme.js";

export { isCancel };

const bar = blue(S.bar);
const out = process.stdout;

function stepSymbol(state) {
  switch (state) {
    case "submit":
      return blue(S.stepDone);
    case "cancel":
      return red(S.stepCancel);
    case "error":
      return yellow(S.warn);
    default:
      return orange(S.step);
  }
}

function header(state, message, hint) {
  return `${dim(S.bar)}\n${stepSymbol(state)}  ${bold(message)}${hint ? `  ${dim(hint)}` : ""}\n`;
}

export function intro(title) {
  out.write(`${blue(S.barStart)}  ${gradient(` ${title} `)}\n`);
}

export function outro(message) {
  out.write(`${dim(S.bar)}\n${blue(S.barEnd)}  ${message}\n\n`);
}

export function cancel(message = "Cancelled.") {
  out.write(`${red(S.barEnd)}  ${red(message)}\n\n`);
}

export const log = {
  message(msg, symbol = dim(S.bar)) {
    const [first, ...rest] = String(msg).split("\n");
    out.write(`${dim(S.bar)}\n${symbol}  ${first}\n${rest.map((l) => `${dim(S.bar)}  ${l}`).join("\n")}${rest.length ? "\n" : ""}`);
  },
  info: (m) => log.message(m, blue(S.info)),
  step: (m) => log.message(m, blue(S.stepDone)),
  success: (m) => log.message(m, green(S.success)),
  warn: (m) => log.message(m, yellow(S.warn)),
  error: (m) => log.message(m, red(S.error)),
};

/** A titled box, used for summaries and "next steps". */
export function note(body, title = "") {
  const lines = String(body).split("\n");
  const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const width = Math.max(visible(title).length + 2, ...lines.map((l) => visible(l).length)) + 2;
  const top = `${blue(S.stepDone)}  ${bold(orange(title))} ${dim("─".repeat(Math.max(width - visible(title).length - 1, 1)) + "╮")}`;
  const body_ = lines.map((l) => `${dim(S.bar)}  ${l}${" ".repeat(width - visible(l).length)}${dim("│")}`);
  const bottom = `${dim("├" + "─".repeat(width + 2) + "╯")}`;
  out.write([dim(S.bar), top, `${dim(S.bar)}${" ".repeat(width + 2)}${dim("│")}`, ...body_, `${dim(S.bar)}${" ".repeat(width + 2)}${dim("│")}`, bottom, ""].join("\n"));
}

export function text({ message, placeholder, defaultValue, initialValue, validate }) {
  return new TextPrompt({
    placeholder,
    defaultValue,
    initialValue,
    validate,
    render() {
      const head = header(this.state, message);
      const ph = placeholder ? dim(placeholder) : "";
      const value = this.userInput ? this.userInputWithCursor : `${placeholder ? inverseFirst(placeholder) : "█"}`;
      switch (this.state) {
        case "error":
          return `${head}${yellow(S.bar)}  ${value}\n${yellow(S.barEnd)}  ${yellow(this.error)}\n`;
        case "submit":
          return `${head}${dim(S.bar)}  ${dim(this.value || ph)}`;
        case "cancel":
          return `${head}${dim(S.bar)}  ${strikethrough(dim(this.value ?? ""))}`;
        default:
          return `${head}${bar}  ${value}\n${blue(S.barEnd)}\n`;
      }
    },
  }).prompt();
}

function inverseFirst(s) {
  return `\x1b[7m${s[0]}\x1b[27m${dim(s.slice(1))}`;
}

function optionLine(opt, active, selected, multi) {
  const label = opt.label ?? String(opt.value);
  const hint = opt.hint ? dim(`  ${opt.hint}`) : "";
  if (multi) {
    const box = selected ? orange(S.checkOn) : dim(S.checkOff);
    return active ? `${box} ${bold(label)}${hint}` : `${box} ${dim(label)}`;
  }
  return active ? `${orange(S.radioOn)} ${bold(label)}${hint}` : `${dim(S.radioOff)} ${dim(label)}`;
}

export function select({ message, options, initialValue, hint }) {
  return new SelectPrompt({
    options,
    initialValue,
    render() {
      const head = header(this.state, message, hint);
      const current = this.options[this.cursor];
      switch (this.state) {
        case "submit":
          return `${head}${dim(S.bar)}  ${dim(current.label ?? current.value)}`;
        case "cancel":
          return `${head}${dim(S.bar)}  ${strikethrough(dim(current.label ?? current.value))}`;
        default:
          return `${head}${this.options.map((o, i) => `${bar}  ${optionLine(o, i === this.cursor)}`).join("\n")}\n${blue(S.barEnd)}\n`;
      }
    },
  }).prompt();
}

export function multiselect({ message, options, initialValues = [], required = false }) {
  return new MultiSelectPrompt({
    options,
    initialValues,
    required,
    render() {
      const done = this.state === "submit" || this.state === "cancel";
      const head = header(this.state, message, done ? "" : "space to toggle · enter to confirm");
      const chosen = this.options.filter((o) => this.value?.includes(o.value)).map((o) => o.label ?? o.value);
      switch (this.state) {
        case "submit":
          return `${head}${dim(S.bar)}  ${dim(chosen.join(", ") || "none")}`;
        case "cancel":
          return `${head}${dim(S.bar)}  ${strikethrough(dim(chosen.join(", ")))}`;
        default: {
          const lines = this.options.map((o, i) => `${bar}  ${optionLine(o, i === this.cursor, this.value?.includes(o.value), true)}`);
          const err = this.state === "error" ? `\n${yellow(S.barEnd)}  ${yellow(this.error)}` : `\n${blue(S.barEnd)}`;
          return `${head}${lines.join("\n")}${err}\n`;
        }
      }
    },
  }).prompt();
}

export function confirm({ message, initialValue = true }) {
  return new ConfirmPrompt({
    active: "Yes",
    inactive: "No",
    initialValue,
    render() {
      const head = header(this.state, message);
      const value = this.value ? "Yes" : "No";
      switch (this.state) {
        case "submit":
          return `${head}${dim(S.bar)}  ${dim(value)}`;
        case "cancel":
          return `${head}${dim(S.bar)}  ${strikethrough(dim(value))}`;
        default:
          return `${head}${bar}  ${this.value ? `${orange(S.radioOn)} ${bold("Yes")}` : `${dim(S.radioOff)} ${dim("Yes")}`} ${dim("/")} ${!this.value ? `${orange(S.radioOn)} ${bold("No")}` : `${dim(S.radioOff)} ${dim("No")}`}\n${blue(S.barEnd)}\n`;
      }
    },
  }).prompt();
}

const FRAMES = ["◐", "◓", "◑", "◒"];

/** Brand-colored spinner. Falls back to plain log lines when stdout is not a TTY. */
export function spinner() {
  let timer;
  let msg = "";
  let i = 0;
  const tty = out.isTTY;
  const render = () => {
    const frame = (i++ % 2 ? orange : blue)(FRAMES[i % FRAMES.length]);
    out.write(`\r\x1b[2K${frame}  ${msg}${dim("…")}`);
  };
  return {
    start(m) {
      msg = m;
      out.write(`${dim(S.bar)}\n`);
      if (!tty) return out.write(`${orange(S.step)}  ${m}…\n`);
      out.write("\x1b[?25l");
      render();
      timer = setInterval(render, 90);
    },
    message(m) {
      msg = m;
      if (!tty) out.write(`${dim(S.bar)}  ${m}…\n`);
    },
    stop(m = msg, ok = true) {
      clearInterval(timer);
      const symbol = ok ? blue(S.stepDone) : red(S.error);
      if (tty) out.write(`\r\x1b[2K${symbol}  ${m}\n\x1b[?25h`);
      else out.write(`${symbol}  ${m}\n`);
    },
  };
}
