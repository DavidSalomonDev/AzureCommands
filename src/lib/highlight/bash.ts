/**
 * Tokenizador mínimo de Bash para colorear los scripts en la UI.
 *
 * No usamos un resaltador externo (Shiki, highlight.js) porque el código se
 * muestra con los <token> de parámetro sustituidos en vivo en el cliente:
 * necesitamos emitir los placeholders como piezas propias, incluso cuando
 * aparecen dentro de una cadena, y no HTML ya resaltado.
 */

import { PLACEHOLDER_PATTERN } from "@/lib/params/template-engine";

export type CodeTokenType =
  | "plain"
  | "comment"
  | "string"
  | "variable"
  | "keyword"
  | "builtin"
  | "command"
  | "function"
  | "number"
  | "flag"
  | "operator"
  | "param";

export interface CodeToken {
  type: CodeTokenType;
  /** Texto literal del script, o el nombre del parámetro si type === "param". */
  value: string;
}

/** Palabras reservadas del lenguaje (control de flujo). */
const KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done",
  "case", "esac", "in", "function", "select", "time", "return", "break",
  "continue",
]);

/** Builtins del shell. */
const BUILTINS = new Set([
  "echo", "printf", "read", "cd", "pwd", "exit", "set", "unset", "export",
  "local", "declare", "typeset", "readonly", "shift", "source", "eval", "exec",
  "trap", "wait", "test", "let", "mapfile", "readarray", "true", "false",
  "type", "command", "getopts", "shopt", "umask", "alias", "jobs", "hash",
  "ulimit", "times",
]);

/** Operadores tras los que empieza un comando nuevo. */
const COMMAND_OPENERS = new Set([";", ";;", "|", "||", "&", "&&", "(", "{", "!", "`"]);

/** Keywords tras las que empieza un comando nuevo. */
const KEYWORD_OPENERS = new Set([
  "if", "then", "else", "elif", "while", "until", "do", "in", "function",
  "time",
]);

/** Builtins que declaran variables: `local X=1`, `export Y=2`. */
const DECLARATIONS = new Set(["local", "declare", "export", "readonly", "typeset"]);

// Expresiones adheridas (y): sólo casan si empiezan exactamente en lastIndex.
const RE_PARAM = new RegExp(PLACEHOLDER_PATTERN, "y");
const RE_HEREDOC = /<<-?[ \t]*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/y;
const RE_DOLLAR_NAME = /\$[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?/y;
const RE_DOLLAR_SPECIAL = /\$[0-9@*#?$!_-]/y;
const RE_FLAG = /--?[A-Za-z][A-Za-z0-9_-]*/y;
const RE_WORD = /[A-Za-z_][A-Za-z0-9_]*/y;
/** Palabra completa, incluyendo nombres de archivo y rutas: `mana-vms.sh`. */
const RE_BAREWORD = /[A-Za-z_][A-Za-z0-9_.@/-]*/y;
const RE_FUNC_PARENS = /[ \t]*\([ \t]*\)/y;
const RE_ASSIGN = /(?:\[[^\]]*\])?\+?=(?!=)/y;
const RE_NUMBER = /\d+(?:\.\d+)?/y;
const RE_PATH = /[.~/][A-Za-z0-9_.@/-]*/y;
const RE_OPERATOR = /\|\||&&|>>|<<<|;;|[|&;<>=!(){}[\]:,?~^*/%+\\-]/y;
const RE_FUNC_DEF = /^[ \t]*(?:function[ \t]+)?([A-Za-z_][A-Za-z0-9_-]*)[ \t]*\([ \t]*\)/gm;

function matchAt(re: RegExp, code: string, index: number): RegExpExecArray | null {
  re.lastIndex = index;
  return re.exec(code);
}

/** Nombres de las funciones declaradas, para colorear también sus llamadas. */
function collectFunctionNames(code: string): Set<string> {
  const names = new Set<string>();
  RE_FUNC_DEF.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RE_FUNC_DEF.exec(code)) !== null) names.add(match[1]);
  return names;
}

type Push = (type: CodeTokenType, value: string) => void;
type PushParam = (name: string) => void;

interface Heredoc {
  delimiter: string;
  /** Un delimitador citado desactiva la expansión del cuerpo. */
  interpolate: boolean;
}

/** Devuelve el texto de ${...}, $(...), $NAME o $1 que empieza en index, o null. */
function readDollarRegion(code: string, index: number, limit: number): string | null {
  if (code[index] !== "$") return null;

  const next = code[index + 1];
  if (next === "{" || next === "(") {
    const open = next;
    const close = open === "{" ? "}" : ")";
    let depth = 0;
    let i = index + 1;
    while (i < limit) {
      const ch = code[i];
      if (ch === "\\") i += 1;
      else if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) return code.slice(index, i + 1);
      }
      i += 1;
    }
    return code.slice(index, limit);
  }

  const name = matchAt(RE_DOLLAR_NAME, code, index);
  if (name && index + name[0].length <= limit) return name[0];
  const special = matchAt(RE_DOLLAR_SPECIAL, code, index);
  if (special && index + special[0].length <= limit) return special[0];
  return null;
}

/**
 * Recorre una región literal con expansión (cuerpo de heredoc) emitiendo
 * cadena, variables y placeholders. Devuelve `to`.
 */
function readInterpolated(
  code: string,
  from: number,
  to: number,
  push: Push,
  pushParam: PushParam
): number {
  let i = from;
  let literal = "";

  while (i < to) {
    const ch = code[i];

    if (ch === "\\" && i + 1 < to) {
      literal += code.slice(i, i + 2);
      i += 2;
      continue;
    }

    const param = matchAt(RE_PARAM, code, i);
    if (param && i + param[0].length <= to) {
      push("string", literal);
      literal = "";
      pushParam(param[1].trim());
      i += param[0].length;
      continue;
    }

    if (ch === "$") {
      const variable = readDollarRegion(code, i, to);
      if (variable) {
        push("string", literal);
        literal = "";
        push("variable", variable);
        i += variable.length;
        continue;
      }
    }

    literal += ch;
    i += 1;
  }

  push("string", literal);
  return to;
}

/** Lee una cadena entre comillas dobles. Devuelve el índice tras la comilla final. */
function readDoubleQuoted(
  code: string,
  start: number,
  push: Push,
  pushParam: PushParam
): number {
  push("string", '"');
  let i = start + 1;
  let literal = "";

  while (i < code.length) {
    const ch = code[i];

    if (ch === "\\" && i + 1 < code.length) {
      literal += code.slice(i, i + 2);
      i += 2;
      continue;
    }

    if (ch === '"') {
      literal += '"';
      i += 1;
      break;
    }

    const param = matchAt(RE_PARAM, code, i);
    if (param) {
      push("string", literal);
      literal = "";
      pushParam(param[1].trim());
      i += param[0].length;
      continue;
    }

    if (ch === "$") {
      const variable = readDollarRegion(code, i, code.length);
      if (variable) {
        push("string", literal);
        literal = "";
        push("variable", variable);
        i += variable.length;
        continue;
      }
    }

    literal += ch;
    i += 1;
  }

  push("string", literal);
  return i;
}

/** Lee el cuerpo de un heredoc hasta su delimitador. */
function readHeredoc(
  code: string,
  start: number,
  heredoc: Heredoc,
  push: Push,
  pushParam: PushParam
): number {
  let i = start;

  while (i < code.length) {
    const lineEnd = code.indexOf("\n", i);
    const stop = lineEnd === -1 ? code.length : lineEnd;

    if (code.slice(i, stop).trim() === heredoc.delimiter) {
      push("string", code.slice(i, stop));
      return stop; // el salto de línea lo consume el bucle principal
    }

    if (heredoc.interpolate) readInterpolated(code, i, stop, push, pushParam);
    else push("string", code.slice(i, stop));
    i = stop;

    if (i < code.length) {
      push("string", "\n");
      i += 1;
    }
  }

  return i;
}

/** Convierte un script de Bash en tokens coloreables. */
export function tokenizeBash(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const functions = collectFunctionNames(code);

  const push: Push = (type, value) => {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === type && type !== "param") last.value += value;
    else tokens.push({ type, value });
  };
  const pushParam: PushParam = (name) => tokens.push({ type: "param", value: name });

  const pending: Heredoc[] = [];
  let i = 0;
  let commandStart = true;
  /** `VAR=valor comando ...`: el comando sigue tras la asignación. */
  let assignmentPrefix = false;
  /** Última palabra vista, para distinguir `local X=1` de `alias x=1`. */
  let lastWord = "";

  while (i < code.length) {
    const ch = code[i];

    if (ch === "\n") {
      push("plain", "\n");
      i += 1;
      commandStart = true;
      assignmentPrefix = false;
      while (pending.length > 0) {
        i = readHeredoc(code, i, pending.shift()!, push, pushParam);
        if (code[i] === "\n") {
          push("plain", "\n");
          i += 1;
        }
      }
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      push("plain", ch);
      i += 1;
      if (assignmentPrefix) {
        commandStart = true;
        assignmentPrefix = false;
      }
      continue;
    }

    // Continuación de línea: el comando sigue en la línea siguiente.
    if (ch === "\\" && code[i + 1] === "\n") {
      push("operator", "\\");
      push("plain", "\n");
      i += 2;
      continue;
    }

    // Comentario: sólo cuando # abre una palabra.
    if (ch === "#" && (i === 0 || /[\s;|&({]/.test(code[i - 1]))) {
      const lineEnd = code.indexOf("\n", i);
      const stop = lineEnd === -1 ? code.length : lineEnd;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }

    // Placeholder de parámetro.
    const param = matchAt(RE_PARAM, code, i);
    if (param) {
      pushParam(param[1].trim());
      i += param[0].length;
      commandStart = false;
      continue;
    }

    if (ch === "'") {
      const end = code.indexOf("'", i + 1);
      const stop = end === -1 ? code.length : end + 1;
      push("string", code.slice(i, stop));
      i = stop;
      commandStart = false;
      continue;
    }

    if (ch === '"') {
      i = readDoubleQuoted(code, i, push, pushParam);
      commandStart = false;
      continue;
    }

    if (ch === "$") {
      if (code[i + 1] === "(" && code[i + 2] === "(") {
        push("operator", "$((");
        i += 3;
        commandStart = false;
        assignmentPrefix = false;
        continue;
      }
      if (code[i + 1] === "(") {
        push("operator", "$(");
        i += 2;
        commandStart = true;
        assignmentPrefix = false;
        continue;
      }
      const variable = readDollarRegion(code, i, code.length);
      if (variable) {
        push("variable", variable);
        i += variable.length;
        commandStart = false;
        continue;
      }
      push("operator", "$");
      i += 1;
      continue;
    }

    // Apertura de heredoc: el cuerpo se lee al terminar la línea.
    if (ch === "<" && code[i + 1] === "<" && code[i + 2] !== "<") {
      const heredoc = matchAt(RE_HEREDOC, code, i);
      if (heredoc) {
        push("operator", heredoc[0]);
        pending.push({
          delimiter: heredoc[1] ?? heredoc[2] ?? heredoc[3],
          interpolate: heredoc[1] === undefined && heredoc[2] === undefined,
        });
        i += heredoc[0].length;
        commandStart = false;
        continue;
      }
    }

    const prev = i > 0 ? code[i - 1] : "\n";
    const atWordStart = i === 0 || /[\s;|&(){}[\]<>=!]/.test(prev);

    if (ch === "-" && atWordStart) {
      const flag = matchAt(RE_FLAG, code, i);
      if (flag) {
        push("flag", flag[0]);
        i += flag[0].length;
        commandStart = false;
        assignmentPrefix = false;
        continue;
      }
    }

    const word = matchAt(RE_WORD, code, i);
    if (word && atWordStart) {
      // Nombre de archivo o ruta (`mana-vms.sh`): una sola pieza, sin trocear.
      const value = matchAt(RE_BAREWORD, code, i)![0];
      const after = i + value.length;
      // `nombre()` declara una función; `NOMBRE=` o `NOMBRE[i]=` asignan.
      // Un `nombre=` que es argumento de otro comando (`alias ls=...`) no.
      const isDefinition = matchAt(RE_FUNC_PARENS, code, after) !== null;
      const isAssignment =
        value === word[0] &&
        (commandStart || DECLARATIONS.has(lastWord)) &&
        matchAt(RE_ASSIGN, code, after) !== null;

      let type: CodeTokenType;
      if (isDefinition || functions.has(value)) type = "function";
      else if (isAssignment) type = "variable";
      else if (KEYWORDS.has(value)) type = "keyword";
      else if (!commandStart) type = "plain"; // argumento o subcomando
      else if (BUILTINS.has(value)) type = "builtin";
      else type = "command";

      push(type, value);
      i = after;
      lastWord = value;
      assignmentPrefix = type === "variable" && commandStart;
      commandStart = type === "keyword" && KEYWORD_OPENERS.has(value);
      continue;
    }

    if (word) {
      // Palabra en medio de otra (argumento, subcomando): sin color.
      push("plain", word[0]);
      i += word[0].length;
      commandStart = false;
      continue;
    }

    if (ch >= "0" && ch <= "9") {
      const number = matchAt(RE_NUMBER, code, i);
      if (number) {
        push("number", number[0]);
        i += number[0].length;
        commandStart = false;
        continue;
      }
    }

    if ((ch === "/" || ch === "." || ch === "~") && atWordStart) {
      const path = matchAt(RE_PATH, code, i);
      if (path && path[0].length > 1) {
        push("plain", path[0]);
        i += path[0].length;
        commandStart = false;
        continue;
      }
    }

    const operator = matchAt(RE_OPERATOR, code, i);
    if (operator) {
      push("operator", operator[0]);
      i += operator[0].length;
      if (COMMAND_OPENERS.has(operator[0])) {
        commandStart = true;
        assignmentPrefix = false;
      }
      continue;
    }

    push("plain", ch);
    i += 1;
  }

  return tokens;
}
