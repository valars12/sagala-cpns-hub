const FALLBACK_FILE_NAME = "lampiran-file";

const toSafeFileName = (value?: string | null, fallback = FALLBACK_FILE_NAME) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const parseDataUrl = (dataUrl: string) => {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match?.[1] || !match[2]) {
    throw new Error("Format data file tidak valid.");
  }
  return {
    mimeType: match[1].toLowerCase(),
    base64Payload: match[2].replace(/\s+/g, "")
  };
};

const base64ToBlob = (base64Payload: string, mimeType: string) => {
  const binary = atob(base64Payload);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const createObjectUrlFromDataUrl = (dataUrl: string) => {
  const parsed = parseDataUrl(dataUrl);
  const blob = base64ToBlob(parsed.base64Payload, parsed.mimeType);

  return {
    mimeType: parsed.mimeType,
    objectUrl: URL.createObjectURL(blob)
  };
};

const clickAnchor = (anchor: HTMLAnchorElement) => {
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const triggerDownloadFromDataUrl = (dataUrl: string, fileName?: string | null) => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = toSafeFileName(fileName);
  anchor.rel = "noopener noreferrer";
  clickAnchor(anchor);
};

export const openDataUrlInNewTab = (dataUrl: string, fileName?: string | null) => {
  const popup =
    typeof window !== "undefined"
      ? window.open("", "_blank")
      : null;

  try {
    const { mimeType, objectUrl } = createObjectUrlFromDataUrl(dataUrl);
    const isPdf = mimeType === "application/pdf";

    if (popup) {
      popup.location.href = objectUrl;
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    if (!isPdf) {
      anchor.download = toSafeFileName(fileName);
    }
    clickAnchor(anchor);
    return;
  } catch (error) {
    if (popup && !popup.closed) {
      popup.close();
    }
    triggerDownloadFromDataUrl(dataUrl, fileName);
  }
};
