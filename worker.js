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
        ? "STRICT IDENTITY & CLOTHING LOCK: Keep ALL people from the input image in their exact same positions, camera framing, poses, facial structures, expressions, hair, and exact original clothing. Do NOT reshape any person's face, body, or outfit. Apply ONLY a subtle editorial skin retouch to soften harsh wrinkles and blemishes while preserving 100% recognizable facial identity."
        : "STRICT SELFIE IDENTITY & CLOTHING LOCK: Keep the exact selfie framing, camera angle, close-up distance, facial geometry, eyes, nose, mouth, beard/hair, expression, and original clothing 100% unchanged. Do NOT zoom out, re-pose, or alter facial features. Apply ONLY a subtle editorial skin retouch to soften fine lines and blemishes while keeping 100% recognizable facial identity.";

      const scenePosterInstruction = destination === "salto"
        ? "CINEMATIC MOVIE POSTER COMPOSITION & RELIGHTING: Replace ONLY the background with an epic, dramatic IMAX movie poster view looking up from the base viewpoint at Angel Falls (Salto Ángel) in Canaima, Venezuela, with the monumental 979-meter waterfall plunging down the towering Auyantepuy cliff surrounded by dramatic mist, volumetric god-rays, and lush rainforest. Relight the subject(s) with dramatic theatrical rim lighting and rich cinematic color grading. Leave clean, uncluttered sky/atmosphere space at the top and a subtle dark gradient vignette at the bottom for poster branding. Do NOT generate any text or logos."
        : "CINEMATIC MOVIE POSTER COMPOSITION & RELIGHTING: Replace ONLY the background with an epic, dramatic IMAX movie poster view of the sweeping golden sand dunes of Los Médanos de Coro in Falcón, Venezuela at dramatic sunset, with volumetric golden light rays, wind-swept sand crests, and the deep turquoise Caribbean Sea on the horizon. Relight the subject(s) with dramatic golden-hour theatrical rim lighting and rich cinematic color grading. Leave clean, uncluttered sky space at the top and a subtle dark gradient vignette at the bottom for poster branding. Do NOT generate any text or logos.";

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
                  text: `${identityAndSkinInstruction} ${scenePosterInstruction} Shot on anamorphic cinema lens, theatrical color grading, ultra sharp.`
                }
              ]
            }],
            generationConfig: {
              temperature: 0.15,
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
