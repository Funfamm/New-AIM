// Auth pages share a centered, minimal layout
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-brand-black)", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
