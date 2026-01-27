import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ScrapeRequest = {
  barcode?: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>` ,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim() || null;
}

function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m?.[1]) return null;
  return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function extractTextCategory(html: string): string | null {
  // Look for patterns like "Category: ..." in the raw HTML/text
  const re = /(?:Category|Categories)\s*:?\s*([^\n<]{2,120})/i;
  const m = html.match(re);
  if (!m?.[1]) return null;
  const v = String(m[1]).replace(/\s+/g, " ").trim();
  return v || null;
}

function extractSize(html: string): string | null {
  // Go-UPC page contains "Additional Attributes" lines like: "- Size: 1,5 L"
  const re = /(?:^|\n|>)\s*(?:-|•)?\s*Size\s*:\s*([^\n<]{1,50})/i;
  const m = html.match(re);
  if (!m?.[1]) return null;
  return String(m[1]).replace(/\s+/g, " ").trim() || null;
}

function extractFirstImage(html: string): string | null {
  // Try to find an image that looks like a product image.
  // (Heuristic: contains /images/ or looks like a JPG/PNG)
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const src = String(m[1] || "").trim();
    if (!src) continue;
    const s = src.toLowerCase();
    if (s.includes("go-upc.s3.amazonaws.com/images/")) {
      return src;
    }
    if (s.includes("/images/") || s.endsWith(".jpg") || s.endsWith(".jpeg") || s.endsWith(".png") || s.endsWith(".webp")) {
      return src;
    }
  }
  return null;
}

async function fallbackImageByBarcode(barcode: string): Promise<string> {
  const b = encodeURIComponent(barcode);
  const guesses = [
    `https://go-upc.s3.amazonaws.com/images/${b}.png`,
    `https://go-upc.s3.amazonaws.com/images/${b}.jpg`,
    `https://go-upc.com/images/${b}.png`,
    `https://go-upc.com/images/${b}.jpg`,
  ];

  for (const guess of guesses) {
    try {
      const r = await fetch(guess, { method: "GET" });
      if (!r.ok) continue;
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("image/")) return guess;
    } catch {
      // ignore
    }
  }
  return "";
}

function extractS3ImageUrl(html: string): string | null {
  // Also catch direct occurrences in HTML even if not in <img>
  const m = html.match(/https:\/\/go-upc\.s3\.amazonaws\.com\/images\/[A-Za-z0-9._-]+\.(?:png|jpg|jpeg|webp)/i);
  return m?.[0]?.trim() || null;
}

function extractJsonLd(html: string): any[] {
  const results: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (!raw) continue;
    try {
      results.push(JSON.parse(raw));
    } catch {
      // ignore
    }
  }
  return results;
}

function firstString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    for (const it of v) {
      const s = firstString(it);
      if (s) return s;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ScrapeRequest;
    const barcode = String(body?.barcode || "").trim();

    if (!barcode) {
      return new Response(JSON.stringify({ success: false, error: "Missing barcode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://go-upc.com/search?q=${encodeURIComponent(barcode)}`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Ba9alinoBot/1.0; +https://example.local)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ success: false, error: `Go-UPC HTTP ${res.status}${text ? ": " + text.slice(0, 200) : ""}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await res.text();

    // Best-effort extraction
    const ogTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
    const ogImage = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");

    const h1 = extractH1(html);
    const textCategory = extractTextCategory(html);
    const size = extractSize(html);
    const htmlImg = extractFirstImage(html);
    const s3Img = extractS3ImageUrl(html);

    const jsonLd = extractJsonLd(html);
    let ldName: string | null = null;
    let ldImage: string | null = null;
    let ldCategory: string | null = null;
    let ldBrand: string | null = null;

    for (const doc of jsonLd) {
      const nodes = Array.isArray(doc) ? doc : [doc];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        ldName = ldName || firstString((node as any).name);
        ldImage = ldImage || firstString((node as any).image);
        ldCategory = ldCategory || firstString((node as any).category);
        const brand = (node as any).brand;
        if (!ldBrand) {
          if (typeof brand === "string") ldBrand = brand;
          else if (brand && typeof brand === "object") ldBrand = firstString((brand as any).name);
        }
      }
    }

    const name = (ogTitle || h1 || ldName || "").trim();
    let image = (ogImage || ldImage || s3Img || htmlImg || "").trim();
    let category = (ldCategory || textCategory || "").trim();

    // Normalize relative image URLs if any
    if (image && image.startsWith("/")) {
      image = `https://go-upc.com${image}`;
    }

    // Fallback for product image when Go-UPC doesn't include it in HTML
    if (!image) {
      image = await fallbackImageByBarcode(barcode);
    }

    // Normalize category (sometimes category appears as "Boissons / Eaux")
    category = category.replace(/\s*\|\s*Go-UPC\s*$/i, "").trim();

    if (!name) {
      return new Response(JSON.stringify({ success: false, error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          name,
          category,
          image,
          size: size || "",
          brand: ldBrand || "",
          source_url: res.url,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
