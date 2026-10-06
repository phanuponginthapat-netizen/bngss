import { createElement, isValidElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import Swal from "sweetalert2";
import type { ExternalToast, ToastT } from "sonner";
import { swalOptions } from "./swal";

type Id = string | number;
type Message = ReactNode | (() => ReactNode);
type Notice = ToastT & { title?: Message };
const pending = new Map<Id, Notice>();
let sequence = 0;
let active: Id | undefined;
let poll: ReturnType<typeof setTimeout> | undefined;
let roots: Root[] = [];

function renderNode(node: Message | undefined): HTMLElement {
  const container = document.createElement("div");
  const value = typeof node === "function" ? node() : node;
  if (typeof value === "string" || typeof value === "number") container.textContent = String(value);
  else if (value != null) {
    const root = createRoot(container);
    roots.push(root);
    root.render(value);
  }
  return container;
}

function schedule() {
  if (poll || pending.size === 0) return;
  poll = setTimeout(() => { poll = undefined; flush(); }, 100);
}

function actionOf(value: Notice["action"]) {
  return value && !isValidElement(value) && typeof value === "object" && "label" in value && "onClick" in value
    ? value : undefined;
}

function options(notice: Notice) {
  const action = actionOf(notice.action);
  const cancel = actionOf(notice.cancel);
  const loading = notice.type === "loading";
  const content = document.createElement("div");
  if (notice.jsx) content.append(renderNode(notice.jsx));
  else if (notice.description) content.append(renderNode(notice.description));
  if (isValidElement(notice.action)) content.append(renderNode(notice.action));
  return swalOptions({
    toast: true,
    position: "top-end",
    title: renderNode(notice.title),
    html: content,
    icon: notice.type === "success" || notice.type === "error" || notice.type === "warning" || notice.type === "info" ? notice.type : undefined,
    showConfirmButton: !!action,
    confirmButtonText: action ? String(action.label) : "ตกลง",
    showCancelButton: !!cancel,
    cancelButtonText: cancel ? String(cancel.label) : "ยกเลิก",
    showCloseButton: notice.dismissible !== false && !loading,
    closeButtonAriaLabel: "ปิดการแจ้งเตือน",
    timer: loading || notice.duration === Infinity ? undefined : notice.duration ?? 4000,
    timerProgressBar: !loading,
    didOpen: () => { if (loading) Swal.showLoading(); },
    didDestroy: () => {
      const oldRoots = roots;
      roots = [];
      queueMicrotask(() => oldRoots.forEach(root => root.unmount()));
    },
  });
}

function flush() {
  if (active !== undefined || Swal.isVisible()) { schedule(); return; }
  const notice = pending.values().next().value as Notice | undefined;
  if (!notice) return;
  pending.delete(notice.id);
  active = notice.id;
  void Swal.fire(options(notice)).then(result => {
    active = undefined;
    if (result.isConfirmed) actionOf(notice.action)?.onClick({} as React.MouseEvent<HTMLButtonElement>);
    else if (result.dismiss === Swal.DismissReason.cancel) actionOf(notice.cancel)?.onClick({} as React.MouseEvent<HTMLButtonElement>);
    if (result.dismiss === Swal.DismissReason.timer) notice.onAutoClose?.(notice);
    else if (result.isDismissed) notice.onDismiss?.(notice);
    schedule();
  });
}

function show(type: ToastT["type"], title: Message, data: ExternalToast = {}): Id {
  const id = data.id ?? ++sequence;
  const notice: Notice = { ...data, id, type, title };
  if (active === id && Swal.getPopup()?.classList.contains("swal2-toast")) {
    Swal.hideLoading();
    // Reopen only this notice to reset its loading state and timer.
    pending.set(id, notice);
    Swal.close();
  } else pending.set(id, notice);
  flush();
  return id;
}

function dismiss(id?: Id): Id {
  if (id === undefined) pending.clear();
  else pending.delete(id);
  if ((id === undefined || active === id) && Swal.getPopup()?.classList.contains("swal2-toast")) Swal.close();
  return id ?? 0;
}

type PromiseLabels<T> = ExternalToast & {
  loading?: Message;
  success?: Message | ((value: T) => ReactNode | Promise<ReactNode>);
  error?: Message | ((error: unknown) => ReactNode | Promise<ReactNode>);
  description?: Message | ((value: T | unknown) => ReactNode | Promise<ReactNode>);
  finally?: () => void | Promise<void>;
};

async function resolveLabel<T>(label: Message | ((value: T) => ReactNode | Promise<ReactNode>) | undefined, value: T) {
  return typeof label === "function" ? await label(value) : label;
}

export const toast = Object.assign(
  (title: Message, data?: ExternalToast) => show("info", title, data),
  {
    success: (title: Message, data?: ExternalToast) => show("success", title, data),
    error: (title: Message, data?: ExternalToast) => show("error", title, data),
    warning: (title: Message, data?: ExternalToast) => show("warning", title, data),
    info: (title: Message, data?: ExternalToast) => show("info", title, data),
    message: (title: Message, data?: ExternalToast) => show("info", title, data),
    loading: (title: Message, data?: ExternalToast) => show("loading", title, data),
    custom: (jsx: (id: Id) => React.ReactElement, data: ExternalToast = {}) => {
      const id = data.id ?? ++sequence;
      const notice: Notice = { ...data, id, jsx: jsx(id) };
      pending.set(id, notice);
      flush();
      return id;
    },
    dismiss,
    promise: <T,>(input: Promise<T> | (() => Promise<T>), labels: PromiseLabels<T> = {}) => {
      const { loading, success, error, description, finally: onFinally, ...data } = labels;
      const id = loading !== undefined ? show("loading", loading, data) : data.id ?? ++sequence;
      const promise = typeof input === "function" ? input() : input;
      void promise.then(async value => {
        if (success !== undefined) show("success", await resolveLabel(success, value), { ...data, id, description: await resolveLabel(description, value) });
        else dismiss(id);
      }, async reason => {
        if (error !== undefined) show("error", await resolveLabel(error, reason), { ...data, id, description: await resolveLabel(description, reason) });
        else dismiss(id);
      }).finally(onFinally).catch(() => dismiss(id));
      return { unwrap: () => promise };
    },
  },
);

export function legacyToast(props: {
  title?: ReactNode; description?: ReactNode; action?: ReactNode; variant?: string; duration?: number;
}) {
  const id = show(props.variant === "destructive" ? "error" : "info", props.title, props);
  return { id: String(id), dismiss: () => dismiss(id), update: (next: typeof props) => show(next.variant === "destructive" ? "error" : "info", next.title, { ...next, id }) };
}