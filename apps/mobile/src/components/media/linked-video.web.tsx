export function LinkedVideo({ url, label, onError }: { url: string; label: string; onError: () => void }) {
  return <iframe src={url} title={label} onError={onError} allow="encrypted-media; fullscreen" allowFullScreen
    sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin"
    style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }} />;
}
