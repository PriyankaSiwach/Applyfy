/**
 * Renders a matched-strength / suggested-improvement line that uses em-dash segments.
 */
export function StrengthEmDashLine({ text }: { text: string }) {
  const parts = text.split(/\s*[—–]\s*/);
  const head = parts[0]?.trim() ?? text;
  const tail = parts.slice(1).join(" — ");
  if (!tail) {
    return <span className="text-inherit">{text}</span>;
  }
  return (
    <>
      <span className="font-bold text-inherit">{head}</span>
      <span className="text-inherit"> — {tail}</span>
    </>
  );
}
