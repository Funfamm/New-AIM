// Server component — fetches session and passes to Nav client component
import { auth } from "@/lib/auth";
import Nav from "@/components/nav";
import "./nav.css";

export default async function NavWrapper() {
  const session = await auth();
  return <Nav user={session?.user ?? null} />;
}
