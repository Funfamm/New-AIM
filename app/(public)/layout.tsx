import Nav from "@/components/nav";
import Footer from "@/components/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: "60px" }}>{children}</div>
      <Footer />
    </>
  );
}
