import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { SignJWT } from "jose";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { createServiceClient } from "@/lib/supabase";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

// POST /api/auth/siwe — verify signature, upsert user, return JWT
export async function POST(req: NextRequest) {
  const { message, signature } = await req.json();

  // Verify SIWE signature
  const siweMessage = new SiweMessage(message);
  let fields;
  try {
    fields = await siweMessage.verify({ signature });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const address = fields.data.address.toLowerCase();

  // Resolve ENS name
  let ensName: string | null = null;
  try {
    ensName = await publicClient.getEnsName({
      address: fields.data.address as `0x${string}`,
    });
  } catch {}

  // Upsert user in Supabase
  const supabase = createServiceClient();
  const { data: user, error } = await supabase
    .from("users")
    .upsert(
      { wallet_address: address, ens_name: ensName },
      { onConflict: "wallet_address" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Issue JWT for Supabase RLS
  const token = await new SignJWT({
    sub: user.id,
    wallet: address,
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  return NextResponse.json({ token, user });
}
