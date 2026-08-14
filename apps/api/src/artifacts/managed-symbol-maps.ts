import path from "node:path";

import type { RawStackFrame } from "../common/grouping";

export type ManagedResolvedFrame = {
  filename: string;
  function?: string | null;
  lineno: number;
  colno?: number | null;
};

type ProguardMethod = {
  obfuscatedName: string;
  originalName: string;
  obfuscatedStart?: number;
  obfuscatedEnd?: number;
  originalStart?: number;
  originalEnd?: number;
};

type ProguardClass = {
  originalName: string;
  methods: ProguardMethod[];
};

export type ProguardMap = Map<string, ProguardClass>;
export type DartObfuscationMap = Map<string, string>;

export function parseProguardMap(value: string): ProguardMap {
  const classes: ProguardMap = new Map();
  let current: ProguardClass | null = null;

  for (const line of value.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const classMatch = /^(\S+)\s+->\s+(\S+):$/.exec(line);
    if (classMatch) {
      current = { originalName: classMatch[1], methods: [] };
      classes.set(classMatch[2], current);
      continue;
    }

    if (!current) continue;
    const methodMatch =
      /^\s*(?:(\d+):(\d+):)?\S+\s+([^\s(]+)\([^)]*\)(?::(\d+)(?::(\d+))?)?\s+->\s+(\S+)\s*$/.exec(
        line,
      );
    if (!methodMatch) continue;

    current.methods.push({
      obfuscatedStart: methodMatch[1] ? Number(methodMatch[1]) : undefined,
      obfuscatedEnd: methodMatch[2] ? Number(methodMatch[2]) : undefined,
      originalName: methodMatch[3],
      originalStart: methodMatch[4] ? Number(methodMatch[4]) : undefined,
      originalEnd: methodMatch[5] ? Number(methodMatch[5]) : undefined,
      obfuscatedName: methodMatch[6],
    });
  }

  return classes;
}

function mappedLine(method: ProguardMethod, line: number | null | undefined): number {
  if (line == null || method.originalStart == null) return line ?? 0;
  if (method.obfuscatedStart == null || method.obfuscatedEnd == null) return method.originalStart;
  if (line < method.obfuscatedStart || line > method.obfuscatedEnd) return line;

  const originalEnd = method.originalEnd ?? method.originalStart;
  return Math.min(originalEnd, method.originalStart + (line - method.obfuscatedStart));
}

export function resolveProguardFrame(
  frame: RawStackFrame,
  mapping: ProguardMap,
): ManagedResolvedFrame | null {
  const obfuscatedClass = frame.module ?? frame.package;
  const obfuscatedMethod = frame.function;
  if (!obfuscatedClass || !obfuscatedMethod) return null;

  const classMapping = mapping.get(obfuscatedClass);
  if (!classMapping) return null;

  const candidates = classMapping.methods.filter(
    (method) => method.obfuscatedName === obfuscatedMethod,
  );
  const line = frame.lineno;
  const method =
    candidates.find(
      (candidate) =>
        line != null &&
        candidate.obfuscatedStart != null &&
        candidate.obfuscatedEnd != null &&
        line >= candidate.obfuscatedStart &&
        line <= candidate.obfuscatedEnd,
    ) ?? candidates[0];
  if (!method) return null;

  return {
    filename: `${path.posix.basename(classMapping.originalName.replaceAll(".", "/"))}.java`,
    function: `${classMapping.originalName}.${method.originalName}`,
    lineno: mappedLine(method, line),
    colno: frame.colno,
  };
}

export function parseDartObfuscationMap(value: string): DartObfuscationMap {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length % 2 !== 0) {
    throw new Error("Dart obfuscation map must be an array of name pairs");
  }

  const mapping: DartObfuscationMap = new Map();
  for (let index = 0; index < parsed.length; index += 2) {
    const original = parsed[index];
    const obfuscated = parsed[index + 1];
    if (typeof original !== "string" || typeof obfuscated !== "string") {
      throw new Error("Dart obfuscation map entries must be strings");
    }
    mapping.set(obfuscated, original);
  }
  return mapping;
}

function deobfuscateDartName(value: string | null | undefined, mapping: DartObfuscationMap) {
  if (!value) return value;
  return value.replace(/[A-Za-z_$][\w$]*/g, (part) => mapping.get(part) ?? part);
}

export function resolveDartFrame(
  frame: RawStackFrame,
  mapping: DartObfuscationMap,
): ManagedResolvedFrame | null {
  const resolvedFunction = deobfuscateDartName(frame.function, mapping);
  const resolvedModule = deobfuscateDartName(frame.module, mapping);
  if (resolvedFunction === frame.function && resolvedModule === frame.module) return null;

  return {
    filename: frame.filename ?? frame.absPath ?? resolvedModule ?? frame.module ?? "unknown",
    function: resolvedFunction,
    lineno: frame.lineno ?? 0,
    colno: frame.colno,
  };
}
