import { NOINDEX } from "@/lib/robots";
import AddDetailsClientPage from "./add-details-client";

export const metadata = {
  title: "Add Details",
  robots: NOINDEX,
};

export default function AddDetailsPage() {
  return <AddDetailsClientPage />;
}
