import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";
import { ToastProvider } from "@/components/toast-context";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NavWrapper />
      <div className="nav-offset">{children}</div>
      <Footer />
    </ToastProvider>
  );
}
