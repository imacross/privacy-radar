export function FingerprintAlert({ apis, strong }: { apis: string[]; strong: boolean }) {
  if (!strong) return null;
  const strongApis = apis.filter((a) => /^(canvas|webgl|audio)/.test(a));
  return (
    <div className="fp-alert">
      <div className="fp-title">⚠ Your fingerprint was taken</div>
      <p>Without you clicking anything, this site extracted your browser fingerprint:</p>
      <ul>
        {strongApis.map((a, i) => (
          <li key={i}>
            <code>{a}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
