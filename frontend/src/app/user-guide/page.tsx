import type { Metadata } from "next";
import { UserGuideClient } from "./UserGuideClient";

export const metadata: Metadata = {
  title: "User guide | Value Navigator",
  description:
    "Interactive Value Navigator user guide — overview, navigation, search, products, and forecasts."
};

export default function UserGuidePage() {
  return <UserGuideClient />;
}
