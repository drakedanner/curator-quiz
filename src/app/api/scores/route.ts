import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createServiceClient } from "@/lib/supabase";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

// POST /api/scores — save a round result (authenticated)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    const { payload: p } = await jwtVerify(authHeader.slice(7), secret);
    payload = p;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("quiz_rounds")
    .insert({
      user_id: payload.sub,
      score: body.score,
      total: body.total,
      category: body.category,
      answers: body.answers,
    })
    .select()
    .single();

  if (error) {
    console.error("Score save error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ round: data });
}

// GET /api/scores — get user's score history (authenticated)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    const { payload: p } = await jwtVerify(authHeader.slice(7), secret);
    payload = p;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("quiz_rounds")
    .select("*")
    .eq("user_id", payload.sub)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({ rounds: data });
}

// DELETE /api/scores — clear user's score history (authenticated)
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    const { payload: p } = await jwtVerify(authHeader.slice(7), secret);
    payload = p;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("quiz_rounds")
    .delete()
    .eq("user_id", payload.sub);

  if (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
