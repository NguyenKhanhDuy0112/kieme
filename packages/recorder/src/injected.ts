/**
 * In-page part of the recorder [K-01]. Runs in every page and iframe of the
 * recorded context and reports user actions through the binding.
 *
 * `installRecorder` is serialised with `Function.prototype.toString()`, so it
 * must stay self-contained: no imports, no references to outer variables.
 */

/** Name of the binding the injected script calls. */
export const RECORDER_BINDING = '__kiemiRecord';

/** Options of the in-page script (structured-cloneable). */
export interface InjectedConfig {
  /** Strings of the toolbar and menus (`recorder.*` of `@kiemi/shared`). */
  strings: Record<string, string>;
  /** Show the floating toolbar in the top frame [K-03]. */
  toolbar: boolean;
  /** Report user actions (off = only Pick / Highlight, e.g. picking from the editor). */
  capture: boolean;
}

export function installRecorder(binding: string, config: InjectedConfig): void {
  const w = window as unknown as Record<string, unknown>;
  if (w.__kiemiRecorderInstalled) return;
  w.__kiemiRecorderInstalled = true;
  const state = {
    capture: config.capture,
    /** Pick mode: the next click chooses an element instead of acting on the page. */
    pick: null as null | 'pick' | 'assert' | 'extract',
  };
  const fromUi = (e: Event): boolean =>
    e.composedPath().some((n) => n instanceof Element && n.hasAttribute('data-kiemi-ui'));

  const send = (payload: unknown): void => {
    const fn = w[binding];
    if (typeof fn === 'function') {
      try {
        const result = (fn as (p: unknown) => unknown)(payload);
        if (result instanceof Promise) result.catch(() => undefined);
      } catch {
        // Binding gone (page closing) — nothing to record.
      }
    }
  };

  // ---- element identity -------------------------------------------------
  const keys = new WeakMap<Element, string>();
  let nextKey = 1;
  const keyOf = (el: Element): string => {
    let k = keys.get(el);
    if (!k) {
      k = `e${nextKey++}`;
      keys.set(el, k);
    }
    return k;
  };

  // ---- element kinds ----------------------------------------------------
  const NON_TEXT_INPUTS = [
    'checkbox',
    'radio',
    'file',
    'submit',
    'button',
    'reset',
    'image',
    'hidden',
  ];
  const isInput = (el: Element): el is HTMLInputElement => el.tagName === 'INPUT';
  const isCheckable = (el: Element): el is HTMLInputElement =>
    isInput(el) && (el.type === 'checkbox' || el.type === 'radio');
  const isTextField = (el: Element): boolean =>
    el.tagName === 'TEXTAREA' ||
    (isInput(el) && !NON_TEXT_INPUTS.includes(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable);
  const isSelect = (el: Element): el is HTMLSelectElement => el.tagName === 'SELECT';
  /** Clicks that only focus/open a field — the field's own event is recorded instead [K-02]. */
  const isQuietClick = (el: Element): boolean => {
    if (isTextField(el) || isSelect(el) || isCheckable(el)) return true;
    if (el.tagName === 'OPTION' || (isInput(el) && el.type === 'file')) return true;
    if (el.tagName === 'LABEL') {
      const control = (el as HTMLLabelElement).control;
      if (control) return true;
    }
    return false;
  };

  const INTERACTIVE =
    'button, a[href], summary, input[type=button], input[type=submit], input[type=reset], input[type=image], ' +
    '[role=button], [role=link], [role=menuitem], [role=option], [role=tab], [role=checkbox], ' +
    '[role=radio], [role=switch], [role=treeitem], [onclick]';
  /** The element a tester means: the nearest clickable ancestor, else the element itself. */
  const clickTarget = (el: Element): Element => el.closest(INTERACTIVE) ?? el;

  const eventTarget = (e: Event): Element | undefined => {
    const t = e.composedPath()[0];
    if (!(t instanceof Element))
      return t instanceof Text ? (t.parentElement ?? undefined) : undefined;
    return t;
  };

  // ---- locator: several strategies + fingerprint [C-01, C-02] ------------------
  const MAX_TEXT = 80;
  const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const cssEscape = (s: string): string => (window.CSS?.escape ? window.CSS.escape(s) : s);
  const attrValue = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const visibleText = (el: Element): string =>
    // biome-ignore lint/performance/useDomNodeTextContent: the rendered text is what testers see
    clean((el as HTMLElement).innerText ?? el.textContent);

  const INPUT_ROLES: Record<string, string> = {
    button: 'button',
    submit: 'button',
    reset: 'button',
    image: 'button',
    checkbox: 'checkbox',
    radio: 'radio',
    range: 'slider',
    number: 'spinbutton',
    search: 'searchbox',
    email: 'textbox',
    tel: 'textbox',
    text: 'textbox',
    url: 'textbox',
  };
  /** ARIA role the way Playwright's `getByRole` sees it (explicit, else implicit). */
  const roleOf = (el: Element): string | undefined => {
    const explicit = clean(el.getAttribute('role')).split(' ')[0];
    if (explicit) return explicit;
    const tag = el.tagName;
    if (isInput(el)) {
      if (el.hasAttribute('list')) return 'combobox';
      return INPUT_ROLES[el.type || 'text'];
    }
    if (isSelect(el)) return el.multiple || el.size > 1 ? 'listbox' : 'combobox';
    if (tag === 'BUTTON') return 'button';
    if (tag === 'A' && el.hasAttribute('href')) return 'link';
    if (tag === 'TEXTAREA') return 'textbox';
    if (/^H[1-6]$/.test(tag)) return 'heading';
    if (tag === 'IMG' && el.getAttribute('alt')) return 'img';
    if (tag === 'OPTION') return 'option';
    if (tag === 'LI') return 'listitem';
    if (tag === 'TR') return 'row';
    if (tag === 'TD') return 'cell';
    if (tag === 'TH') return 'columnheader';
    if (tag === 'SUMMARY') return undefined;
    return undefined;
  };

  /** Text of the `<label>`s of a form control, without the control's own text. */
  const labelText = (el: Element): string => {
    const labels = (el as HTMLInputElement).labels;
    if (!labels?.length) return '';
    return clean(
      Array.from(labels)
        .map((l) => {
          const copy = l.cloneNode(true) as HTMLElement;
          for (const c of Array.from(copy.querySelectorAll('input, select, textarea, button')))
            c.remove();
          return copy.textContent ?? '';
        })
        .join(' '),
    );
  };

  /** Accessible name, close to what Playwright computes for the common cases. */
  const nameOf = (el: Element, role: string | undefined): string => {
    const labelledBy = clean(el.getAttribute('aria-labelledby'));
    if (labelledBy) {
      const text = clean(
        labelledBy
          .split(' ')
          .map((id) => {
            const ref = el.ownerDocument.getElementById(id);
            return ref ? visibleText(ref) : '';
          })
          .join(' '),
      );
      if (text) return text;
    }
    const aria = clean(el.getAttribute('aria-label'));
    if (aria) return aria;
    if (isInput(el) || isSelect(el) || el.tagName === 'TEXTAREA') {
      if (isInput(el) && ['button', 'submit', 'reset'].includes(el.type))
        return (
          clean(el.value) || (el.type === 'submit' ? 'Submit' : el.type === 'reset' ? 'Reset' : '')
        );
      if (isInput(el) && el.type === 'image') return clean(el.alt);
      return (
        labelText(el) || clean(el.getAttribute('title')) || clean(el.getAttribute('placeholder'))
      );
    }
    if (el.tagName === 'IMG') return clean(el.getAttribute('alt'));
    if (
      role &&
      [
        'button',
        'link',
        'heading',
        'tab',
        'menuitem',
        'option',
        'checkbox',
        'radio',
        'switch',
        'treeitem',
        'listitem',
        'cell',
        'columnheader',
      ].includes(role)
    )
      return visibleText(el) || clean(el.getAttribute('title'));
    return clean(el.getAttribute('title'));
  };

  const cssPath = (el: Element): string => {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.tagName !== 'HTML' && cur.tagName !== 'BODY') {
      if (cur.id && cur !== el) {
        parts.unshift(`#${cssEscape(cur.id)}`);
        break;
      }
      const tag = cur.tagName.toLowerCase();
      const parent: Element | null = cur.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const same = Array.from(parent.children).filter((c) => c.tagName === cur?.tagName);
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
      cur = parent;
    }
    return parts.join(' > ');
  };

  const xpathOf = (el: Element): string => {
    const parts: string[] = [];
    let cur: Element | null = el;
    while (cur && cur.nodeType === 1) {
      if (cur.id && !cur.id.includes('"')) {
        parts.unshift(`//*[@id="${cur.id}"]`);
        return parts.join('/');
      }
      const tag = cur.tagName.toLowerCase();
      const parent: Element | null = cur.parentElement;
      if (!parent) {
        parts.unshift(`/${tag}`);
        break;
      }
      const same = Array.from(parent.children).filter((c) => c.tagName === cur?.tagName);
      parts.unshift(same.length > 1 ? `${tag}[${same.indexOf(cur) + 1}]` : tag);
      cur = parent;
    }
    return `/${parts.join('/')}`.replace(/^\/+/, '/');
  };

  const FINGERPRINT_ATTRS = [
    'id',
    'name',
    'class',
    'type',
    'role',
    'aria-label',
    'placeholder',
    'title',
    'href',
    'alt',
    'required',
    'maxlength',
    'minlength',
    'min',
    'max',
    'pattern',
    'inputmode',
    'autocomplete',
  ];
  /** What the element looked like when recorded — for self-healing later [C-02]. */
  const fingerprintOf = (el: Element) => {
    const attributes: Record<string, string> = {};
    for (const a of FINGERPRINT_ATTRS) {
      const v = el.getAttribute(a);
      if (v !== null) attributes[a] = v.slice(0, 200);
    }
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith('data-') && Object.keys(attributes).length < 30)
        attributes[a.name] = a.value.slice(0, 200);
    }
    if (isInput(el) && el.type !== 'password' && el.getAttribute('value') !== null)
      attributes.value = (el.getAttribute('value') ?? '').slice(0, 200);
    const neighbors: string[] = [];
    const push = (t: string) => {
      const v = t.slice(0, MAX_TEXT);
      if (v && !neighbors.includes(v) && neighbors.length < 5) neighbors.push(v);
    };
    push(labelText(el));
    const prev = el.previousElementSibling;
    if (prev) push(visibleText(prev));
    const group = el.closest('fieldset, section, form, [role=dialog], [role=region], table, nav');
    const heading = group?.querySelector('legend, h1, h2, h3, h4, caption, [role=heading]');
    if (heading) push(visibleText(heading));
    const row = el.closest('tr, li, [role=row]');
    if (row && row !== el) push(visibleText(row));
    const r = el.getBoundingClientRect();
    const text = isTextField(el) || isSelect(el) ? '' : visibleText(el).slice(0, 200);
    return {
      tag: el.tagName.toLowerCase(),
      ...(text ? { text } : {}),
      attributes,
      neighbors,
      box: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
    };
  };

  type Strategy = Record<string, unknown> & { kind: string };
  /** Strategies in priority order: role+name → label → placeholder → text → testId → css → xpath [C-01]. */
  const locatorOf = (el: Element) => {
    const strategies: Strategy[] = [];
    const add = (s: Strategy) => {
      const key = JSON.stringify(s);
      if (!strategies.some((x) => JSON.stringify(x) === key)) strategies.push(s);
    };
    const tag = el.tagName.toLowerCase();
    const field = isTextField(el) || isSelect(el) || isCheckable(el);
    const role = roleOf(el);
    const name = nameOf(el, role);
    if (role && name && name.length <= MAX_TEXT) add({ kind: 'role', role, name, exact: true });
    const label = labelText(el) || (field ? clean(el.getAttribute('aria-label')) : '');
    if (field && label && label.length <= MAX_TEXT)
      add({ kind: 'label', value: label, exact: true });
    const placeholder = clean(el.getAttribute('placeholder'));
    if (placeholder && placeholder.length <= MAX_TEXT)
      add({ kind: 'placeholder', value: placeholder, exact: true });
    if (!field) {
      const text = visibleText(el);
      if (text && text.length <= MAX_TEXT) add({ kind: 'text', value: text, exact: true });
    }
    const testId = el.getAttribute('data-testid');
    if (testId) add({ kind: 'testId', value: testId });
    for (const attr of ['data-test', 'data-test-id', 'data-qa', 'data-cy']) {
      const v = el.getAttribute(attr);
      if (v) add({ kind: 'css', value: `[${attr}="${attrValue(v)}"]` });
    }
    if (el.id) add({ kind: 'css', value: `#${cssEscape(el.id)}` });
    const nameAttr = el.getAttribute('name');
    if (nameAttr && (field || tag === 'button')) {
      const value = isCheckable(el) ? el.getAttribute('value') : null;
      add({
        kind: 'css',
        value: `${tag}[name="${attrValue(nameAttr)}"]${value !== null ? `[value="${attrValue(value)}"]` : ''}`,
      });
    }
    const path = cssPath(el);
    if (path) add({ kind: 'css', value: path });
    add({ kind: 'xpath', value: xpathOf(el) });
    return { strategies, fingerprint: fingerprintOf(el) };
  };

  const target = (el: Element) => ({ key: keyOf(el), locator: locatorOf(el) });

  const modifiersOf = (e: MouseEvent | KeyboardEvent): string[] => {
    const m: string[] = [];
    if (e.altKey) m.push('Alt');
    if (e.ctrlKey) m.push('Control');
    if (e.metaKey) m.push('Meta');
    if (e.shiftKey) m.push('Shift');
    return m;
  };

  const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  // ---- suggested checks: what changed on the page after an action [M-01] -------
  const TOAST =
    '[role="alert"], [role="status"], [aria-live], .toast, .alert, .message, .notification, .snackbar, [class*="toast"], [class*="Toast"], [class*="notif"]';
  const isShown = (x: Element): boolean => {
    const r = x.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(x);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const ours = (n: Node): boolean =>
    n instanceof Element ? n.tagName === 'KIEMI-RECORDER' || !!n.closest('kiemi-recorder') : false;
  let watching: { stop: () => void } | undefined;
  const suggestFrom = (added: Set<Element>, changed: Set<Element>) => {
    const items: Record<string, unknown>[] = [];
    const all = [...added, ...changed];
    for (const x of all) {
      const t = x.closest(TOAST) ?? x.querySelector(TOAST);
      if (!t || !isShown(t)) continue;
      const text = visibleText(t);
      if (text && text.length <= 200) {
        items.push({ kind: 'toast', text: text.slice(0, 120) });
        break;
      }
    }
    for (const x of added) {
      const row = x.tagName === 'TR' ? (x as HTMLTableRowElement) : null;
      if (!row || !isShown(row) || row.closest('thead')) continue;
      const cell = Array.from(row.cells).find((c) => visibleText(c));
      if (cell) {
        items.push({ kind: 'row', text: short(visibleText(row), 80), target: target(cell) });
        break;
      }
    }
    if (!items.length) {
      for (const x of added) {
        if (!isShown(x)) continue;
        const prominent = 'h1, h2, h3, [role=dialog], [role=heading], [role=alertdialog]';
        const e = x.matches(prominent) ? x : (x.querySelector(prominent) ?? x);
        const text = visibleText(e);
        if (text && text.length <= 80 && isShown(e)) {
          items.push({ kind: 'visible', text, target: target(e) });
          break;
        }
      }
    }
    if (items.length) send({ kind: 'suggest', items });
  };
  /** Watches the page for ~1 s after an action and reports what appeared. */
  const watchAfterAction = () => {
    if (!state.capture) return;
    watching?.stop();
    const added = new Set<Element>();
    const changed = new Set<Element>();
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (ours(r.target)) continue;
        if (r.type === 'characterData') {
          const p = r.target.parentElement;
          if (p && !ours(p)) changed.add(p);
          continue;
        }
        for (const n of Array.from(r.addedNodes)) {
          if (n instanceof Element && !ours(n)) added.add(n);
          else if (n instanceof Text && n.parentElement && !ours(n.parentElement))
            changed.add(n.parentElement);
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const timer = window.setTimeout(() => {
      obs.disconnect();
      watching = undefined;
      suggestFrom(added, changed);
    }, 1200);
    watching = {
      stop: () => {
        window.clearTimeout(timer);
        obs.disconnect();
      },
    };
  };

  // ---- listeners (capture phase: pages calling stopPropagation still record) ----
  const opts = { capture: true };
  /** When Enter was last recorded: the click a form submit / button fires for it is not a new action. */
  let enterAt = 0;

  document.addEventListener(
    'click',
    (e) => {
      if (!state.capture || fromUi(e)) return;
      if (!e.isTrusted || e.button !== 0) return;
      if (e.detail === 0 && Date.now() - enterAt < 500) return;
      const raw = eventTarget(e);
      if (!raw || isQuietClick(raw)) return;
      const el = clickTarget(raw);
      if (isQuietClick(el)) return;
      send({ kind: 'click', target: target(el), button: 'left', modifiers: modifiersOf(e) });
      watchAfterAction();
    },
    opts,
  );

  document.addEventListener(
    'dblclick',
    (e) => {
      if (!state.capture || fromUi(e)) return;
      if (!e.isTrusted) return;
      const raw = eventTarget(e);
      if (!raw || isQuietClick(raw)) return;
      send({ kind: 'dblclick', target: target(clickTarget(raw)) });
    },
    opts,
  );

  document.addEventListener(
    'contextmenu',
    (e) => {
      if (!state.capture || fromUi(e)) return;
      if (!e.isTrusted) return;
      const raw = eventTarget(e);
      if (!raw) return;
      send({ kind: 'click', target: target(clickTarget(raw)), button: 'right', modifiers: [] });
    },
    opts,
  );

  document.addEventListener(
    'input',
    (e) => {
      if (!state.capture || fromUi(e)) return;
      if (!e.isTrusted) return;
      const raw = eventTarget(e);
      if (!raw) return;
      const editable = raw.closest('[contenteditable]:not([contenteditable="false"])');
      const el = isInput(raw) || raw.tagName === 'TEXTAREA' ? raw : (editable ?? raw);
      if (!isTextField(el)) return;
      const value =
        isInput(el) || el.tagName === 'TEXTAREA'
          ? (el as HTMLInputElement).value
          : // biome-ignore lint/performance/useDomNodeTextContent: the rendered text is what testers see
            ((el as HTMLElement).innerText ?? '');
      // Password fields: the app offers to turn the value into a Secret [K-05].
      const secret = isInput(el) && el.type === 'password';
      send({ kind: 'fill', target: target(el), value, ...(secret ? { secret } : {}) });
    },
    opts,
  );

  document.addEventListener(
    'change',
    (e) => {
      if (!state.capture || fromUi(e)) return;
      if (!e.isTrusted) return;
      const el = eventTarget(e);
      if (!el) return;
      if (isSelect(el)) {
        const option = el.selectedOptions[0];
        if (option) send({ kind: 'select', target: target(el), option: option.label.trim() });
        watchAfterAction();
      } else if (isCheckable(el)) {
        send({ kind: 'check', target: target(el), checked: el.checked });
        watchAfterAction();
      }
    },
    opts,
  );

  const ALWAYS = [
    'Enter',
    'Escape',
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'F12',
  ];
  const OUTSIDE_FIELDS = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'PageUp',
    'PageDown',
    'Home',
    'End',
    'Backspace',
    'Delete',
  ];
  const EDITING_SHORTCUTS = ['a', 'c', 'v', 'x', 'y', 'z'];

  document.addEventListener(
    'keydown',
    (e) => {
      if (!state.capture || fromUi(e)) return;
      if (!e.isTrusted || e.isComposing || e.repeat) return;
      const key = e.key;
      if (['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'CapsLock'].includes(key)) return;
      const focused = eventTarget(e);
      const inField = !!focused && (isTextField(focused) || isSelect(focused));
      const chord = e.ctrlKey || e.metaKey || e.altKey;
      let record = false;
      if (chord) {
        record = !(inField && EDITING_SHORTCUTS.includes(key.toLowerCase()));
      } else if (ALWAYS.includes(key)) {
        // Enter in a textarea / contenteditable is a newline, already part of the fill.
        record = !(key === 'Enter' && !!focused && isTextField(focused) && !isInput(focused));
      } else if (OUTSIDE_FIELDS.includes(key)) {
        record = !inField;
      }
      if (!record) return;
      const mods = modifiersOf(e).filter((m) => m !== 'Shift' || key.length > 1 || chord);
      const combo = [...mods, key === ' ' ? 'Space' : key].join('+');
      if (key === 'Enter') enterAt = Date.now();
      const el =
        focused && focused !== document.body && focused !== document.documentElement
          ? focused
          : undefined;
      send(
        el ? { kind: 'press', keys: combo, target: target(el) } : { kind: 'press', keys: combo },
      );
      if (key === 'Enter') watchAfterAction();
    },
    opts,
  );

  // ---- in-page UI: toolbar, pick mode, menus, highlight [K-03, C-06] -----------
  const T = (key: string, vars: Record<string, string | number> = {}): string =>
    (config.strings[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));
  const INDIGO = '#1F2A5C';
  const GREEN = '#3DDC84';
  const RED = '#E5484D';
  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .bar { position: fixed; z-index: 2147483647; left: 50%; bottom: 16px; transform: translateX(-50%);
      display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px;
      background: ${INDIGO}; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: ${RED}; }
    .count { opacity: .8; margin-right: 4px; }
    button { cursor: pointer; border: 1px solid rgba(255,255,255,.35); background: transparent; color: inherit;
      border-radius: 8px; padding: 4px 10px; }
    button:hover, button:focus-visible { background: rgba(255,255,255,.15); outline: none; }
    button.stop { background: ${RED}; border-color: ${RED}; }
    .hint { position: fixed; z-index: 2147483647; left: 50%; top: 12px; transform: translateX(-50%);
      padding: 6px 12px; border-radius: 8px; background: ${INDIGO}; color: #fff; }
    .box { position: fixed; z-index: 2147483646; pointer-events: none; border: 2px solid ${INDIGO};
      background: rgba(31,42,92,.12); border-radius: 4px; }
    .box.many { border-color: ${RED}; background: rgba(229,72,77,.12); }
    .tag { position: absolute; left: -2px; top: -22px; white-space: nowrap; padding: 1px 6px; border-radius: 4px;
      background: ${INDIGO}; color: #fff; font-size: 12px; }
    .box.many .tag { background: ${RED}; }
    .menu { position: fixed; z-index: 2147483647; min-width: 220px; max-width: 360px; padding: 6px; border-radius: 12px;
      background: #fff; color: #111; border: 1px solid #d0d4e4; box-shadow: 0 2px 8px rgba(0,0,0,.2);
      display: flex; flex-direction: column; gap: 4px; }
    .menu button { color: ${INDIGO}; border-color: transparent; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .menu button:hover, .menu button:focus-visible { background: #eef0f8; }
    .menu button.cancel { color: #555; }
    .menu input { border: 1px solid #c3c8dc; border-radius: 8px; padding: 4px 8px; color: #111; background: #fff; }
    .menu label { color: #444; font-size: 12px; }
    .err { color: ${RED}; font-size: 12px; }
    .sugs { position: fixed; z-index: 2147483647; left: 50%; bottom: 64px; transform: translateX(-50%);
      display: flex; flex-direction: column; gap: 4px; min-width: 280px; max-width: 480px; padding: 8px 10px;
      border-radius: 12px; background: #fff; color: #111; border: 1px solid #d0d4e4; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
    .sugs strong { color: ${INDIGO}; }
    .sug { display: flex; align-items: center; gap: 6px; }
    .sug span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sug button { color: ${INDIGO}; border-color: #c3c8dc; padding: 2px 8px; }
    .sug button.ok { border-color: ${GREEN}; }
    .sug button.ok::before { content: "✓ "; color: #1a7f4b; }
    .sug button:hover { background: #eef0f8; }
  `;

  /** One shadow-root host per frame, ignored by the recording listeners. */
  let root: ShadowRoot | undefined;
  const ui = (): ShadowRoot => {
    if (root?.host.isConnected) return root;
    const host = document.createElement('kiemi-recorder');
    host.setAttribute('data-kiemi-ui', '');
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.appendChild(style);
    (document.body ?? document.documentElement).appendChild(host);
    return root;
  };
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: { className?: string; text?: string } = {},
  ): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag);
    if (props.className) n.className = props.className;
    if (props.text !== undefined) n.textContent = props.text;
    return n;
  };
  const removeAll = (selector: string) => {
    for (const n of Array.from(root?.querySelectorAll(selector) ?? [])) n.remove();
  };

  // Toolbar (top frame only).
  let stepCount: HTMLElement | undefined;
  const showToolbar = () => {
    if (!config.toolbar || window.top !== window || root?.querySelector('.bar')) return;
    const bar = el('div', { className: 'bar' });
    bar.setAttribute('role', 'toolbar');
    bar.append(el('span', { className: 'dot' }), el('strong', { text: T('recording') }));
    stepCount = el('span', { className: 'count', text: '' });
    bar.append(stepCount);
    const cmd = (key: string, command: string, className = '') => {
      const b = el('button', { className, text: T(key) });
      b.type = 'button';
      b.dataset.command = command;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        send({ kind: 'command', command });
      });
      bar.append(b);
    };
    cmd('addCheck', 'assert');
    cmd('saveValue', 'extract');
    cmd('saveLogin', 'saveLogin');
    cmd('stop', 'stop', 'stop');
    ui().append(bar);
  };
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', showToolbar, { once: true });
  else showToolbar();

  // Hover box + menus while picking.
  const boxFor = (target: Element, label: string, many = false): HTMLElement => {
    const r = target.getBoundingClientRect();
    const box = el('div', { className: many ? 'box many' : 'box' });
    Object.assign(box.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    if (label) box.append(el('span', { className: 'tag', text: label }));
    return box;
  };
  let hovered: Element | undefined;

  const stopPick = () => {
    state.pick = null;
    hovered = undefined;
    removeAll('.hover, .hint, .menu');
  };
  const startPick = (purpose: 'pick' | 'assert' | 'extract') => {
    stopPick();
    state.pick = purpose;
    if (window.top === window) ui().append(el('div', { className: 'hint', text: T('pickHint') }));
  };

  const fieldValue = (t: Element): string | undefined =>
    isTextField(t) && (isInput(t) || t.tagName === 'TEXTAREA')
      ? (t as HTMLInputElement).value
      : isSelect(t)
        ? (t.selectedOptions[0]?.label ?? '')
        : undefined;

  const menuAt = (t: Element): HTMLElement => {
    const r = t.getBoundingClientRect();
    const menu = el('div', { className: 'menu' });
    menu.setAttribute('role', 'menu');
    const top = r.bottom + 6 + 200 > window.innerHeight ? Math.max(8, r.top - 206) : r.bottom + 6;
    Object.assign(menu.style, {
      left: `${Math.max(8, Math.min(r.left, window.innerWidth - 240))}px`,
      top: `${top}px`,
    });
    ui().append(menu);
    return menu;
  };
  const menuButton = (menu: HTMLElement, text: string, onClick: () => void, className = '') => {
    const b = el('button', { className, text });
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    menu.append(b);
    return b;
  };
  const finish = () => {
    stopPick();
    send({ kind: 'pickDone' });
  };

  const assertMenu = (t: Element) => {
    const menu = menuAt(t);
    const tgt = target(t);
    menuButton(menu, T('checkVisible'), () => {
      send({ kind: 'assert', target: tgt, check: 'visible' });
      finish();
    });
    const value = fieldValue(t);
    if (value !== undefined) {
      menuButton(menu, T('checkValue', { value: short(value) }), () => {
        send({ kind: 'assert', target: tgt, check: 'value', value });
        finish();
      });
    } else {
      const text = visibleText(t);
      if (text)
        menuButton(menu, T('checkText', { value: short(text) }), () => {
          send({ kind: 'assert', target: tgt, check: 'text', value: text.slice(0, 1000) });
          finish();
        });
    }
    if (isCheckable(t) && t.checked)
      menuButton(menu, T('checkChecked'), () => {
        send({ kind: 'assert', target: tgt, check: 'checked' });
        finish();
      });
    menuButton(menu, T('cancel'), finish, 'cancel');
    (menu.querySelector('button') as HTMLButtonElement | null)?.focus();
  };

  const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  /** Asks for a name, then calls `done(name)`. */
  const nameForm = (menu: HTMLElement, labelKey: string, done: (name: string) => void) => {
    const label = el('label', { text: T(labelKey) });
    const input = el('input');
    input.setAttribute('aria-label', T(labelKey));
    const err = el('span', { className: 'err' });
    menu.append(label, input, err);
    input.focus();
    return () => {
      const name = input.value.trim();
      if (!NAME_RE.test(name)) {
        err.textContent = T('invalidName');
        input.focus();
        return;
      }
      done(name);
    };
  };

  const extractMenu = (t: Element) => {
    const menu = menuAt(t);
    const tgt = target(t);
    const value = fieldValue(t);
    const text = visibleText(t);
    let from: 'text' | 'value' = value !== undefined ? 'value' : 'text';
    const submit = nameForm(menu, 'variableName', (into) => {
      send({ kind: 'extract', target: tgt, from, into });
      finish();
    });
    if (value !== undefined)
      menuButton(menu, T('saveFieldValue', { value: short(value) }), () => {
        from = 'value';
        submit();
      });
    if (text && value === undefined)
      menuButton(menu, T('saveText', { value: short(text) }), () => {
        from = 'text';
        submit();
      });
    menuButton(menu, T('cancel'), finish, 'cancel');
    menu.querySelector('input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  };

  /** Asks the name of the login session to save (top frame) [F-02]. */
  const loginMenu = () => {
    removeAll('.menu');
    const menu = el('div', { className: 'menu' });
    Object.assign(menu.style, { left: '50%', bottom: '64px', transform: 'translateX(-50%)' });
    ui().append(menu);
    const submit = nameForm(menu, 'loginName', (name) => {
      removeAll('.menu');
      send({ kind: 'saveLogin', name });
    });
    menuButton(menu, T('saveLogin'), submit);
    menuButton(menu, T('cancel'), () => removeAll('.menu'), 'cancel');
    menu.querySelector('input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  };

  const pickTarget = (e: Event): Element | undefined => {
    const raw = eventTarget(e);
    if (!raw) return undefined;
    return isQuietClick(raw) && raw.tagName === 'LABEL'
      ? ((raw as HTMLLabelElement).control ?? raw)
      : clickTarget(raw);
  };

  window.addEventListener(
    'mouseover',
    (e) => {
      if (!state.pick || fromUi(e) || root?.querySelector('.menu')) return;
      const t = pickTarget(e);
      if (!t || t === hovered) return;
      hovered = t;
      removeAll('.hover');
      const box = boxFor(t, short(nameOf(t, roleOf(t)) || t.tagName.toLowerCase(), 50));
      box.classList.add('hover');
      ui().append(box);
    },
    true,
  );
  for (const type of [
    'pointerdown',
    'mousedown',
    'pointerup',
    'mouseup',
    'dblclick',
    'contextmenu',
  ]) {
    window.addEventListener(
      type,
      (e) => {
        if (!state.pick || fromUi(e)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
  }
  window.addEventListener(
    'click',
    (e) => {
      if (!state.pick || fromUi(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (root?.querySelector('.menu')) return;
      const t = pickTarget(e);
      if (!t) return;
      const purpose = state.pick;
      if (purpose === 'pick') {
        send({ kind: 'picked', target: target(t) });
        stopPick();
        return;
      }
      removeAll('.hint');
      if (purpose === 'assert') assertMenu(t);
      else extractMenu(t);
    },
    true,
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (state.pick) {
        e.preventDefault();
        e.stopImmediatePropagation();
        stopPick();
        send({ kind: 'pickDone', cancelled: true });
      } else if (root?.querySelector('.menu')) {
        removeAll('.menu');
      }
    },
    true,
  );

  /** Shows boxes on the given elements (Highlight [C-06]); `null` clears them. */
  const highlight = (els: Element[] | null, label = '') => {
    removeAll('.mark');
    if (!els?.length) return;
    els[0]?.scrollIntoView({ block: 'center', inline: 'nearest' });
    const many = els.length > 1;
    for (const [i, x] of els.entries()) {
      const box = boxFor(x, i === 0 ? label : '', many);
      box.classList.add('mark');
      ui().append(box);
    }
    window.setTimeout(() => removeAll('.mark'), 4000);
  };

  // Suggested checks next to the toolbar, each with ✓ / ✕ [M-01].
  type Sug = { id: string; kind: string; text: string };
  const KIND_KEY: Record<string, string> = {
    toast: 'suggestToast',
    row: 'suggestRow',
    visible: 'suggestVisible',
    url: 'suggestUrl',
  };
  const showSuggestions = (list: Sug[]) => {
    removeAll('.sugs');
    if (!list.length || window.top !== window) return;
    const box = el('div', { className: 'sugs' });
    box.setAttribute('role', 'list');
    box.append(el('strong', { text: T('suggestTitle') }));
    for (const s of list.slice(-3)) {
      const row = el('div', { className: 'sug' });
      row.setAttribute('role', 'listitem');
      row.append(
        el('span', { text: T(KIND_KEY[s.kind] ?? 'suggestVisible', { text: short(s.text, 50) }) }),
      );
      const ok = el('button', { className: 'ok', text: T('accept') });
      ok.type = 'button';
      ok.addEventListener('click', () => send({ kind: 'suggestion', id: s.id, accept: true }));
      const no = el('button', { className: 'no', text: '✕' });
      no.type = 'button';
      no.setAttribute('aria-label', T('dismiss'));
      no.addEventListener('click', () => send({ kind: 'suggestion', id: s.id, accept: false }));
      row.append(ok, no);
      box.append(row);
    }
    ui().append(box);
  };

  // API used by the recorder (Node side) through `frame.evaluate`.
  w.__kiemiRecorder = {
    setPick: (purpose: 'pick' | 'assert' | 'extract' | null) =>
      purpose ? startPick(purpose) : stopPick(),
    setCapture: (on: boolean) => {
      state.capture = on;
    },
    setSteps: (count: number) => {
      if (stepCount) stepCount.textContent = T('steps', { count });
    },
    showSuggestions,
    askLogin: () => {
      if (window.top === window) loginMenu();
    },
    highlight,
    clear: () => highlight(null),
    /** Recording ended: no more events, no toolbar. */
    teardown: () => {
      state.capture = false;
      stopPick();
      root?.host.remove();
      root = undefined;
    },
  };
}

/** Source of the init script that installs the recorder in a page or frame. */
export function injectedSource(config: InjectedConfig, binding: string = RECORDER_BINDING): string {
  return `(${installRecorder.toString()})(${JSON.stringify(binding)}, ${JSON.stringify(config)});`;
}
