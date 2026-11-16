/**
 * In-page part of the recorder [K-01]. Runs in every page and iframe of the
 * recorded context and reports user actions through the binding.
 *
 * `installRecorder` is serialised with `Function.prototype.toString()`, so it
 * must stay self-contained: no imports, no references to outer variables.
 */

/** Name of the binding the injected script calls. */
export const RECORDER_BINDING = '__kiemiRecord';

export function installRecorder(binding: string): void {
  const w = window as unknown as Record<string, unknown>;
  if (w.__kiemiRecorderInstalled) return;
  w.__kiemiRecorderInstalled = true;

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

  // ---- listeners (capture phase: pages calling stopPropagation still record) ----
  const opts = { capture: true };
  /** When Enter was last recorded: the click a form submit / button fires for it is not a new action. */
  let enterAt = 0;

  document.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted || e.button !== 0) return;
      if (e.detail === 0 && Date.now() - enterAt < 500) return;
      const raw = eventTarget(e);
      if (!raw || isQuietClick(raw)) return;
      const el = clickTarget(raw);
      if (isQuietClick(el)) return;
      send({ kind: 'click', target: target(el), button: 'left', modifiers: modifiersOf(e) });
    },
    opts,
  );

  document.addEventListener(
    'dblclick',
    (e) => {
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
      send({ kind: 'fill', target: target(el), value });
    },
    opts,
  );

  document.addEventListener(
    'change',
    (e) => {
      if (!e.isTrusted) return;
      const el = eventTarget(e);
      if (!el) return;
      if (isSelect(el)) {
        const option = el.selectedOptions[0];
        if (option) send({ kind: 'select', target: target(el), option: option.label.trim() });
      } else if (isCheckable(el)) {
        send({ kind: 'check', target: target(el), checked: el.checked });
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
    },
    opts,
  );
}

/** Source of the init script that installs the recorder in a page or frame. */
export function injectedSource(binding: string = RECORDER_BINDING): string {
  return `(${installRecorder.toString()})(${JSON.stringify(binding)});`;
}
