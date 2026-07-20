exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const payload = JSON.parse(event.body);
  const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;

  const email = payload.form_response?.answers?.find(a => a.type === "email")?.email;
  const responseId = payload.form_response?.token;
  const formId = payload.form_response?.form_id;
  const resultsUrl = `https://admin.typeform.com/form/${formId}/results#responses/${responseId}`;

  if (!email) {
    return { statusCode: 400, body: "No email found" };
  }

  await fetch("https://a.klaviyo.com/api/events/", {
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

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};