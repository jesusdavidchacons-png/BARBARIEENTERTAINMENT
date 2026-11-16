export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405, headers: corsHeaders });
    }

    try {
      const { image, mode = "selfie", destination = "medanos" } = await request.json();

      if (!image) {
        return new Response(JSON.stringify({ error: "No se recibió imagen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      // 1. Regla estricta de preservación según el modo (Selfie vs Grupal)
      const subjectInstruction = mode === "group"
        ? "STRICT IDENTITY & CLOTHING PRESERVATION FOR EVERY PERSON IN THE GROUP: Keep ALL people from the input photo exactly as they appear. Do NOT alter, beautify, reshape, or modify any facial features, skin tones, hairstyles, body proportions, poses, or a single piece of clothing, glasses, or accessories on any person. Only replace the background behind and beneath them."
        : "STRICT FACIAL & OUTFIT PRESERVATION: Keep the exact person from the input photo with maximum facial fidelity, preserving every facial detail, skin texture, beard/hair, expression, and their exact original clothing and accessories without altering or beautifying anything. Only integrate them naturally into the new background.";

      // 2. Escenario elegido (Médanos de Coro vs Salto Ángel desde abajo)
      const sceneInstruction = destination === "salto"
        ? "Place them standing at the base viewpoint looking up toward Angel Falls (Salto Ángel) in Canaima National Park, Venezuela. Towering 979-meter waterfall plunging down the massive vertical rock wall of Auyantepuy tepui in the background, lush green tropical rainforest mist, natural daylight with soft mist particles, realistic outdoor lighting matching the subjects. Shot on 35mm lens, photorealistic travel photography, natural colors, ultra sharp."
        : "Place them standing on the golden sand dunes of Los Médanos de Coro in Falcón, Venezuela during golden hour sunset. Warm natural sunlight illuminating them softly with realistic shadows on the sand, gentle wind, vast desert dunes stretching toward the turquoise Caribbean Sea on the horizon. Shot on 35mm lens, photorealistic travel photography, natural colors, ultra sharp.";

      const aspectRatio = mode === "group" ? "4:3" : "3:4";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                  }
                },
                {
                  text: `${subjectInstruction} ${sceneInstruction}`
                }
              ]
            }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: {
                aspectRatio: aspectRatio,
                imageSize: "2K"
              }
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Error en la API de Google");
      }

      const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (!part) {
        throw new Error("El modelo no devolvió ninguna imagen");
      }

      const outputBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;

      return new Response(JSON.stringify({ image: outputBase64 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
