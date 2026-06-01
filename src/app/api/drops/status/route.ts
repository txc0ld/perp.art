import { NextResponse } from "next/server";
import { getJob } from "@/lib/drops/jobs";

/**
 * GET /api/drops/status?id=<jobId>
 * Returns the current state of a drop-processing job:
 *   { status, progress, step, result?, error? }
 *
 * Note: the job store is in-memory (see jobs.ts), so polling must hit the same
 * warm instance that ran /api/drops/process. The process route runs the job to
 * completion in-request, so by the time the client receives the job id the
 * result is usually already present.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const job = getJob(id);
  if (!job) {
    return NextResponse.json(
      { error: "job not found (it may have expired or run on another instance)" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    step: job.step,
    result: job.result,
    error: job.error,
  });
}
