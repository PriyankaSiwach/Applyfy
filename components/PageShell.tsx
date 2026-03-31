export function PageShell({
  children,
  narrow = true,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col bg-[#F8FAFC] px-10 py-14 sm:px-10">
      <div
        className={
          narrow
            ? "mx-auto w-full max-w-2xl flex-1"
            : "mx-auto w-full max-w-4xl flex-1"
        }
      >
        {children}
      </div>
    </div>
  );
}
