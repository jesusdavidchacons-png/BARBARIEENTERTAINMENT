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

      const identityAndSkinInstruction = mode === "group"
        ? "STRICT POSE, FRAMING & IDENTITY LOCK: Keep ALL people from the input image in their exact same positions, camera framing, poses, facial structures, expressions, hair, and exact original clothing. Do NOT reshape, beautify, or alter any person's face, body, or outfit. Apply ONLY a subtle editorial skin retouch to soften harsh wrinkles and blemishes while preserving 100% recognizable facial identity."
        : "STRICT SELFIE POSE, FRAMING & IDENTITY LOCK: Keep the exact selfie framing, camera angle, close-up distance, facial geometry, eyes, nose, mouth, beard/hair, expression, and original clothing 100% unchanged. Do NOT zoom out, re-pose, or alter facial features. Apply ONLY a subtle editorial skin retouch to soften fine lines and blemishes while keeping 100% recognizable facial identity.";

      const sceneIntegrationInstruction = destination === "salto"
        ? "REALISTIC LOCATION INTEGRATION & RELIGHTING: Replace ONLY the background behind the subject(s) with an authentic, photorealistic view looking up from the base viewpoint at Angel Falls (Salto Ángel) in Canaima, Venezuela, showing the monumental 979-meter waterfall plunging down the Auyantepuy rock cliff, lush rainforest canopy, and atmospheric mist. Physically integrate the subject(s) so they genuinely feel on location: match black levels, contrast, optical depth-of-field, and wrap realistic cool-natural outdoor daylight, sky bounce light, and subtle misty rim light around their hair, shoulders, skin, and clothing. Leave clean, uncluttered sky at the top and a subtle dark natural shadow area at the bottom for poster typography. Do NOT generate any text or logos."
        : "REALISTIC LOCATION INTEGRATION & RELIGHTING: Replace ONLY the background behind the subject(s) with an authentic, photorealistic view of the golden sand dunes of Los Médanos de Coro in Falcón, Venezuela during golden hour sunset, with wind-sculpted sand ridges, warm airborne sand haze, and the turquoise Caribbean Sea on the horizon. Physically integrate the subject(s) so they genuinely feel on location: match black levels, contrast, optical depth-of-field, and wrap warm golden-hour sunlight, warm sand bounce light, and realistic sunset rim light around their hair, shoulders, skin, and clothing. Leave clean, uncluttered sky at the top and a subtle dark natural shadow area at the bottom for poster typography. Do NOT generate any text or logos.";

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
                  text: `${identityAndSkinInstruction} ${sceneIntegrationInstruction} Shot on 35mm cinema lens, subtle natural film grain, realistic color science, ultra sharp.`
                }
              ]
            }],
            generationConfig: {
              temperature: 0.18,
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
