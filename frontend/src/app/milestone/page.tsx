import { MilestoneWithAuth } from "@/components/MilestoneWithAuth";

export const dynamic = "force-dynamic";

export default function MilestonePage() {
  return (
    <div className="space-y-4">
      <MilestoneWithAuth />
    </div>
  );
}
