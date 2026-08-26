import { useEffect, useState } from "react";

const isLocalAssetReference = (source: string): boolean =>
  Boolean(source) &&
  !source.startsWith("#") &&
  !source.startsWith("//") &&
  !/^[a-z][a-z0-9+.-]*:/i.test(source);

export const LocalImage = ({
  alt,
  sourceDocumentPath,
  sourcePath,
  title,
}: {
  alt?: string;
  sourceDocumentPath: string;
  sourcePath?: string;
  title?: string;
}): React.JSX.Element => {
  const [imageUrl, setImageUrl] = useState<string>();
  const [isUnavailable, setIsUnavailable] = useState(() => !sourcePath);

  useEffect(() => {
    setImageUrl(undefined);
    setIsUnavailable(false);
    if (!sourcePath || !isLocalAssetReference(sourcePath)) {
      setIsUnavailable(true);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    void window.brainarium
      .readLocalImage({
        assetPath: sourcePath,
        sourceRelativePath: sourceDocumentPath,
      })
      .then((image) => {
        if (cancelled) return;
        const exactBytes = new Uint8Array(image.bytes.byteLength);
        exactBytes.set(image.bytes);
        objectUrl = URL.createObjectURL(
          new Blob([exactBytes.buffer], { type: image.mimeType }),
        );
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setIsUnavailable(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceDocumentPath, sourcePath]);

  if (!imageUrl) {
    return (
      <span className="local-image-unavailable" role="status">
        {alt || "Image"}: {isUnavailable ? "unavailable" : "loading…"}
      </span>
    );
  }
  return <img alt={alt ?? ""} src={imageUrl} title={title} />;
};
