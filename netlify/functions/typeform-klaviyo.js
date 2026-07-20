module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const payload = req.body;
    const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;

    const formResponse = payload.form_response;
    const resultsUrl = formResponse?.response_url;
    const formId = formResponse?.form_id;
    const responseId = formResponse?.token;

    const answers = formResponse?.answers || [];
    const email = answers.find(a => a.type === "email")?.email;

    if (!email) {
      return res.status(400).json({ error: "No email found", answers });
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

    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};