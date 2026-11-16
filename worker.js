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
      const {
        image,
        mode = "selfie",
        destination = "medanos",
        style = "real"
      } = await request.json();

      if (!image) {
        return new Response(JSON.stringify({ error: "No se recibió imagen" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      // 1. Regla de identidad según Modo Real (pose fija) vs Modo Aventura (cuerpo adaptado, cara intacta)
      let subjectInstruction = "";

      if (style === "aventura") {
        subjectInstruction = mode === "group"
          ? "STRICT FACIAL IDENTITY LOCK WITH NATURAL BODY & ENVIRONMENT ADAPTATION: Preserve 100% of every person's exact facial geometry, eyes, nose, mouth, skin tone, beard/hair, and recognizable identity from the input photo without altering or beautifying their faces, and keep their exact original clothing. Adapt their body postures, torso angles, and natural interaction naturally so they appear genuinely standing and exploring inside the expansive landscape rather than a close-up selfie crop. Apply only a subtle editorial skin retouch to soften harsh wrinkles."
          : "STRICT FACIAL IDENTITY LOCK WITH NATURAL BODY & ENVIRONMENT ADAPTATION: Preserve 100% of the person's exact facial geometry, eyes, nose, mouth, skin tone, beard/hair, and recognizable identity from the input photo without altering or beautifying their face, and keep their exact original clothing. Adapt their body posture, shoulders, and camera distance to a natural medium-wide cinematic travel portrait so they appear genuinely standing inside the environment rather than a close-up selfie crop. Apply only a subtle editorial skin retouch to soften fine lines.";
      } else {
        subjectInstruction = mode === "group"
          ? "STRICT POSE, FRAMING & IDENTITY LOCK: Keep ALL people from the input image in their exact same positions, camera framing, poses, facial structures, expressions, hair, and exact original clothing. Do NOT reshape any person's face, body, or outfit. Apply ONLY a subtle editorial skin retouch to soften harsh wrinkles and blemishes while preserving 100% recognizable facial identity."
          : "STRICT SELFIE POSE, FRAMING & IDENTITY LOCK: Keep the exact selfie framing, camera angle, close-up distance, facial geometry, eyes, nose, mouth, beard/hair, expression, and original clothing 100% unchanged. Do NOT zoom out, re-pose, or alter facial features. Apply ONLY a subtle editorial skin retouch to soften fine lines and blemishes while keeping 100% recognizable facial identity.";
      }

      // 2. Escenario cinematográfico y re-iluminación realista
      const sceneInstruction = destination === "salto"
        ? "SEAMLESS REALISTIC SCENE INTEGRATION & RELIGHTING: Place the subject(s) in a breathtaking, photorealistic IMAX view looking up from the base viewpoint at Angel Falls (Salto Ángel) in Canaima, Venezuela, with the monumental 979-meter waterfall plunging down the towering Auyantepuy rock cliff, lush rainforest canopy, and atmospheric mist. Physically integrate the subject(s) into this real environment: match black levels, contrast, optical lens depth-of-field, and wrap realistic cool-natural outdoor daylight, sky bounce light, and subtle misty rim lighting around their hair, shoulders, skin, and clothing so it looks 100% like an authentic photograph captured on location. Leave clean sky/mist space at the top and a subtle dark natural shadow area at the bottom for movie poster typography. Do NOT generate any text or logos."
        : "SEAMLESS REALISTIC SCENE INTEGRATION & RELIGHTING: Place the subject(s) in a breathtaking, photorealistic IMAX view of the sweeping golden sand dunes of Los Médanos de Coro in Falcón, Venezuela during golden hour sunset, with wind-sculpted sand ridges, warm airborne sand haze, and the deep turquoise Caribbean Sea on the horizon. Physically integrate the subject(s) into this real environment: match black levels, contrast, optical lens depth-of-field, and wrap warm golden-hour sunlight, warm sand bounce light, and realistic sunset rim lighting around their hair, shoulders, skin, and clothing so it looks 100% like an authentic photograph captured on location. Leave clean sky space at the top and a subtle dark natural shadow area at the bottom for movie poster typography. Do NOT generate any text or logos.";

      const aspectRatio = mode === "group" ? "4:3" : "3:4";
      const temperature = style === "aventura" ? 0.35 : 0.2;

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
                  text: `${subjectInstruction} ${sceneInstruction} Shot on 35mm cinema prime lens, authentic film grain, natural color science, ultra sharp.`
                }
              ]
            }],
            generationConfig: {
              temperature: temperature,
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
