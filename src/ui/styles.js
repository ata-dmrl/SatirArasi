export const STYLES = `
:host { all: initial; }
:host {
  --bg: #ffffff; --fg: #1c1d21; --muted: #5f6470; --line: #e3e5ea; --soft: #f5f6f8;
  --accent: #2f5bea; --accent-fg: #fff;
  --high: #c62828; --high-bg: #fdecec; --med: #b26a00; --med-bg: #fff4e0; --low: #2e7d32; --low-bg: #eaf5eb;
  --warn-bg: #fff8d6; --warn-line: #e6c34a;
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #17181c; --fg: #e9eaee; --muted: #a0a5b1; --line: #2c2e35; --soft: #202229;
    --accent: #7c9cff; --accent-fg: #0d0f14;
    --high: #ff8a80; --high-bg: #3a1c1c; --med: #ffc069; --med-bg: #36290f; --low: #8fd694; --low-bg: #1a2e1c;
    --warn-bg: #352f12; --warn-line: #8a7424;
  }
}
* { box-sizing: border-box; }
.launcher, .panel { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg); }
.launcher {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; border: 0; cursor: pointer;
  background: var(--accent); color: var(--accent-fg); padding: 10px 14px; border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0,0,0,.25); font-weight: 600; max-width: calc(100vw - 32px);
}
.launcher.subtle { opacity: .85; font-weight: 500; }
.launcher[hidden], .panel[hidden] { display: none; }
.panel {
  position: fixed; top: 0; right: 0; z-index: 2147483647; width: min(440px, 100vw); height: 100vh;
  background: var(--bg); border-left: 1px solid var(--line); box-shadow: -8px 0 24px rgba(0,0,0,.18);
  display: flex; flex-direction: column;
}
header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.brand { font-weight: 700; font-size: 15px; }
.logo { color: var(--accent); }
.tagline { font-size: 11.5px; font-weight: 500; color: var(--muted); margin-top: 1px; }
.icon { background: none; border: 0; color: var(--muted); font-size: 16px; cursor: pointer; padding: 4px 6px; }
.disclaimer { background: var(--warn-bg); border-bottom: 1px solid var(--warn-line); padding: 10px 16px; font-size: 12.5px; }
.body { padding: 14px 16px 24px; overflow-y: auto; flex: 1; }
h3 { font-size: 14px; margin: 18px 0 8px; }
p { margin: 6px 0; }
.muted { color: var(--muted); } .small { font-size: 12px; }
button.primary, button.secondary { border-radius: 8px; padding: 9px 14px; font: inherit; font-weight: 600; cursor: pointer; margin-top: 12px; }
button.primary { background: var(--accent); color: var(--accent-fg); border: 0; width: 100%; }
button.secondary { background: var(--soft); color: var(--fg); border: 1px solid var(--line); }
button.link { background: none; border: 0; color: var(--accent); cursor: pointer; font: inherit; padding: 0; text-decoration: underline; }
.loading { display: flex; gap: 10px; align-items: center; padding: 24px 0; color: var(--muted); }
.spinner { width: 18px; height: 18px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.error { background: var(--high-bg); color: var(--high); padding: 10px 12px; border-radius: 8px; }
.scorecard { display: flex; gap: 14px; align-items: center; padding: 12px; background: var(--soft); border-radius: 12px; }
.gauge { width: 76px; height: 76px; border-radius: 50%; display: flex; align-items: baseline; justify-content: center; padding-top: 18px; border: 6px solid var(--low); flex: none; }
.scorecard[data-level="medium"] .gauge { border-color: var(--med); }
.scorecard[data-level="high"] .gauge, .scorecard[data-level="very_high"] .gauge { border-color: var(--high); }
.score { font-size: 24px; font-weight: 800; } .of { font-size: 11px; color: var(--muted); }
.certainty { margin-top: 2px; } .c-low strong { color: var(--high); } .c-medium strong { color: var(--med); } .c-high strong { color: var(--low); }
.alert { margin-top: 12px; padding: 10px 12px; border-radius: 8px; border: 1px solid; }
.a-high { background: var(--high-bg); border-color: var(--high); } .a-medium { background: var(--med-bg); border-color: var(--med); }
.alert ul, .reasons ul, .missed ul, .rejected ul { margin: 6px 0 0; padding-left: 18px; }
details { margin-top: 12px; background: var(--soft); border-radius: 8px; padding: 8px 12px; }
summary { cursor: pointer; font-weight: 600; }
.clauses { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.clause { border: 1px solid var(--line); border-left: 4px solid var(--low); border-radius: 8px; padding: 10px 12px; }
.clause.s-medium { border-left-color: var(--med); } .clause.s-high { border-left-color: var(--high); }
.chead { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sev { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.sev.s-high { background: var(--high-bg); color: var(--high); } .sev.s-medium { background: var(--med-bg); color: var(--med); } .sev.s-low { background: var(--low-bg); color: var(--low); }
.cat { font-weight: 600; }
blockquote { margin: 8px 0; padding: 6px 10px; border-left: 3px solid var(--line); background: var(--soft); font-family: ui-serif, Georgia, serif; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.cfoot { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; font-size: 12px; }
.cfoot .link { margin-left: auto; }
.verified { color: var(--low); font-weight: 600; }
.warn { color: var(--med); }
.agent form { display: flex; gap: 8px; } .agent input { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: inherit; }
.agent button { margin-top: 0; }
footer.meta { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 8px; }
`;
