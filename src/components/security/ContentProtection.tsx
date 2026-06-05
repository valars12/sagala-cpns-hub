import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const PROTECTED_PATHS = ["/dashboard", "/practice", "/admin"];

const isEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") return true;
  if (target.isContentEditable) return true;

  return false;
};

const ContentProtection = ({ children }: { children: React.ReactElement }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const isProtectedPath = useMemo(
    () => PROTECTED_PATHS.some((path) => location.pathname.startsWith(path)),
    [location.pathname]
  );
  const shouldProtectRole = user?.role === "student";

  const watermarkText = useMemo(() => "Hak Cipta Sagala Bimbel", []);

  useEffect(() => {
    if (!isProtectedPath || !shouldProtectRole) return;

    let warningTimeoutId: number | null = null;

    const showWarning = (message: string) => {
      setWarningMessage(message);
      if (warningTimeoutId) window.clearTimeout(warningTimeoutId);
      warningTimeoutId = window.setTimeout(() => {
        setWarningMessage(null);
      }, 2200);
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (isEditableElement(event.target)) return;
      event.preventDefault();
      showWarning("Menu klik kanan dinonaktifkan pada halaman ini.");
    };

    const handleCopy = (event: ClipboardEvent) => {
      if (isEditableElement(event.target)) return;
      event.preventDefault();
      showWarning("Fitur salin konten dinonaktifkan.");
    };

    const handleDragStart = (event: DragEvent) => {
      if (isEditableElement(event.target)) return;
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const printScreenPressed = event.key === "PrintScreen";
      const macScreenshotPressed = event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key);
      const windowsSnipPressed = event.ctrlKey && event.shiftKey && ["s", "x"].includes(key);

      if (printScreenPressed || macScreenshotPressed || windowsSnipPressed) {
        event.preventDefault();
        showWarning("Pengambilan tangkapan layar dibatasi pada halaman ini.");
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText("").catch(() => undefined);
        }
      }

      if ((event.ctrlKey || event.metaKey) && ["c", "u", "s", "p"].includes(key)) {
        if (isEditableElement(event.target)) return;
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCopy);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCopy);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
      if (warningTimeoutId) window.clearTimeout(warningTimeoutId);
    };
  }, [isProtectedPath, shouldProtectRole]);

  if (!isProtectedPath || !shouldProtectRole) {
    return children;
  }

  return (
    <div className="sagala-sensitive-content relative min-h-screen">
      {children}
      <div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden">
        <div className="sagala-watermark" aria-hidden="true">
          <span className="sagala-watermark-item">{watermarkText}</span>
        </div>
      </div>
      {warningMessage ? (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[65] -translate-x-1/2 rounded-full border border-primary/30 bg-white/95 px-4 py-2 text-xs font-medium text-primary shadow-lg">
          {warningMessage}
        </div>
      ) : null}
    </div>
  );
};

export default ContentProtection;
