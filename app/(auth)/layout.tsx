// Auth pages share a centered, minimal layout
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "radial-gradient(circle at top, var(--color-brand-dark) 0%, var(--color-brand-black) 80%)",
      minHeight: "100dvh"
    }}>
      {children}
    </div>
  );
}
