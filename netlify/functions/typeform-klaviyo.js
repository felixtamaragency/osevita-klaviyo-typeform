exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);
    const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;

    const formResponse = payload.form_response;
    const resultsUrl = formResponse?.response_url;
    const formId = formResponse?.form_id;
    const responseId = formResponse?.token;

    // Cherche l'email dans tous les types de champs possibles
    const answers = formResponse?.answers || [];
    const emailAnswer = answers.find(a => a.type === "email");
    const email = emailAnswer?.email;

    if (!email) {
      console.log("Answers reçues:", JSON.stringify(answers));
      return { statusCode: 400, body: "No email found" };
    }

    const klaviyoRes = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        "revision": "2024-02-15",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            profile: {
              data: {
                type: "profile",
                attributes: { email }
              }
            },
            metric: {
              data: {
                type: "metric",
                attributes: { name: "Typeform Completed" }
              }
            },
            properties: {
              results_url: resultsUrl,
              form_id: formId,
              response_id: responseId,
            }
          }
        }
      })
    });

    console.log("Klaviyo status:", klaviyoRes.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.log("Erreur:", err.message);
    return { statusCode: 500, body: err.message };
  }
};