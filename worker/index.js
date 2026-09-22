const ALLOWED_ORIGINS = new Set([
  "https://diogoms.pt",
  "https://www.diogoms.pt",
  "https://diogosantoss.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function errorResponse(request, message, status) {
  return Response.json(
    { error: message },
    { status, headers: corsHeaders(request) },
  );
}

function decodeBase64Image(image) {
  const binary = atob(image);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default {
  async fetch(request, env, context) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/portrait") {
      return errorResponse(request, "Not found", 404);
    }

    const origin = request.headers.get("Origin");
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return errorResponse(request, "Origin not allowed", 403);
    }

    const name = url.searchParams.get("name")?.trim();
    const role = url.searchParams.get("role") === "new" ? "new" : "former";

    if (!name || name.length > 40) {
      return errorResponse(request, "Name must contain 1 to 40 characters", 400);
    }

    const cache = caches.default;
    const cacheKey = new Request(
      `${url.origin}/portrait?name=${encodeURIComponent(name.toLowerCase())}&role=${role}`,
    );
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      Object.entries(corsHeaders(request)).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      response.headers.set("X-Meme-Cache", "HIT");
      return response;
    }

    const relationship =
      role === "former"
        ? "an ex-best-friend who has just been dramatically rejected"
        : "a triumphant new best friend";
    const prompt = [
      `A deliberately terrible low-budget internet meme portrait representing ${JSON.stringify(name)}.`,
      `The character should visually evoke the name or concept ${JSON.stringify(name)} and look like ${relationship}.`,
      "One centered subject, square portrait crop, tacky clip-art aesthetic, oversaturated colors, awkward lighting, cheap 2015 meme energy.",
      "No words, no letters, no captions, no logos, no watermark, no border.",
    ].join(" ");

    try {
      const result = await env.AI.run(
        "@cf/black-forest-labs/flux-1-schnell",
        {
          prompt,
          steps: 4,
        },
      );
      const image = decodeBase64Image(result.image);
      const response = new Response(image, {
        headers: {
          ...corsHeaders(request),
          "Cache-Control": "public, max-age=604800, s-maxage=2592000",
          "Content-Type": "image/jpeg",
          "X-Content-Type-Options": "nosniff",
          "X-Meme-Cache": "MISS",
        },
      });

      context.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      console.error("Workers AI generation failed", error);
      return errorResponse(request, "Image generation failed", 502);
    }
  },
};
