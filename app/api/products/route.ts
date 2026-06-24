import { NextResponse } from "next/server";
import { products } from "@/lib/products";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");

  let result = products;

  if (category && category !== "toate") {
    result = result.filter((p) => p.category === category);
  }
  if (featured === "true") {
    result = result.filter((p) => p.featured);
  }

  return NextResponse.json({ products: result, total: result.length });
}
