import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto h-14 w-14 text-rose-500" />
        <h1 className="mt-4 font-display text-2xl font-bold">You don&apos;t have access to this area</h1>
        <p className="mt-2 text-slate-600">Ask a super admin to upgrade your role.</p>
        <Button href="/admin" variant="outline" className="mt-6">Back to dashboard</Button>
      </div>
    </div>
  );
}
