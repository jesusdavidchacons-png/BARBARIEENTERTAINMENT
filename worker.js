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
      const { image } = await request.json();
      if (!image) {
        return new Response(JSON.stringify({ error: "No se recibió imagen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

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
                  text: "Keep the exact person from the input photo, preserving their facial features, skin tone, hair, expression, and clothing naturally. Place them standing on the golden sand dunes of Los Médanos de Coro in Falcón, Venezuela during golden hour sunset. Warm natural sunlight illuminating their face and casting realistic soft shadows on the sand, gentle wind blowing fine sand, vast desert dunes stretching toward the turquoise Caribbean Sea on the horizon. Shot on 35mm lens, photorealistic editorial travel photography, natural color grading, ultra sharp."
                }
              ]
            }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: {
                aspectRatio: "3:4",
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
