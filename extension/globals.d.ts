/**
 * Build-Zeit-Konstante aus wxt.config.ts. Wird von Vite als echtes Boolean-Literal
 * eingesetzt, damit Rolldown den toten Zweig samt der nur dort importierten Module
 * entfernt – im Store-Build steht `false` im Quelltext, nicht die Variable.
 */
declare const __FALLBACK__: boolean;

/** Zeitpunkt des Builds als ISO-String, gezeigt auf der Optionsseite. */
declare const __BAUZEIT__: string;
