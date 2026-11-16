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

      // 1. Anclaje estricto de rostro, encuadre y ropa (cero cambios geométricos)
      const identityLock = mode === "group"
        ? "STRICT PHOTO COMPOSITING & RELIGHTING ONLY: Keep ALL people from the input image in their exact same positions, camera distance, framing, poses, facial structures, expressions, skin textures, hair, and exact original clothing. Do NOT reshape, beautify, or alter any person's face, body, or outfit. Treat their facial geometry and clothing as completely locked."
        : "STRICT SELFIE COMPOSITING & RELIGHTING ONLY: Keep the exact selfie framing, camera angle, close-up distance, facial geometry, eyes, nose, mouth, skin texture, facial hair, expression, and original clothing 100% unchanged. Do NOT zoom out, re-pose, beautify, or alter any facial feature. Treat the subject's facial structure and outfit as completely locked.";

      // 2. Re-iluminación natural + fondo real del destino
      const relightAndScene = destination === "salto"
        ? "BACKGROUND & RELIGHTING: Replace ONLY the background behind the subject(s) with an authentic candid outdoor view looking up from the base viewpoint at Angel Falls (Salto Ángel) in Canaima, Venezuela, showing the massive 979-meter waterfall cascading down the Auyantepuy rock wall and lush green rainforest mist. Relight the subject(s) naturally so soft, cool-neutral outdoor daylight, subtle mist atmosphere, and natural sky fill light fall realistically across their face, hair, and clothing, making it look like an authentic photo actually taken on location."
        : "BACKGROUND & RELIGHTING: Replace ONLY the background behind the subject(s) with an authentic candid outdoor view of the golden sand dunes of Los Médanos de Coro in Falcón, Venezuela during golden hour sunset, with wind-sculpted sand dunes and the turquoise Caribbean Sea on the horizon. Relight the subject(s) naturally so warm golden-hour sunlight, soft directional shadows, and warm sunset rim light fall realistically across their face, hair, and clothing, making it look like an authentic selfie actually taken on location.";

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
                  text: `${identityLock} ${relightAndScene} Natural smartphone/35mm candid photo grain and depth of field matching the foreground focus.`
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
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
