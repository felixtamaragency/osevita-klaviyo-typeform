export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;
  const LIST_ID = "VeeVZ3";
  const REVISION = "2025-04-15";

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
    "revision": REVISION,
  };

  try {
    const payload = req.body;
    const formResponse = payload.form_response;
    const resultsUrl = formResponse?.response_url;
    const formId = formResponse?.form_id;
    const responseId = formResponse?.token;

    const urlParams = new URL(resultsUrl).searchParams;
    const qui = urlParams.get("qui") || "";

    const answers = formResponse?.answers || [];
    const email = answers.find(a => a.type === "email")?.email;
    const firstName = answers.find(a => a.type === "text" || a.type === "short_text")?.text || "";

    if (!email) {
      return res.status(400).json({ error: "No email found", answers });
    }

    // 1. Abonner à la liste
    const subRes = await fetch(
      "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [
                  {
                    type: "profile",
                    attributes: {
                      email,
                      subscriptions: {
                        email: { marketing: { consent: "SUBSCRIBED" } },
                      },
                    },
                  },
                ],
              },
            },
            relationships: {
              list: { data: { type: "list", id: LIST_ID } },
            },
          },
        }),
      }
    );
    const subBody = await subRes.text();
    console.log("SUBSCRIPTION", subRes.status, subBody);

    // 2. Laisser Klaviyo traiter l'abonnement
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Envoyer l'event
    const evtRes = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            profile: {
              data: {
                type: "profile",
                attributes: { email, first_name: firstName },
              },
            },
            metric: {
              data: {
                type: "metric",
                attributes: { name: "Typeform Completed" },
              },
            },
            properties: {
              results_url: resultsUrl,
              first_name: firstName,
              qui,
              form_id: formId,
              response_id: responseId,
            },
          },
        },
      }),
    });
    const evtBody = await evtRes.text();
    console.log("EVENT", evtRes.status, evtBody);

    return res.status(200).json({
      ok: true,
      subscription: { status: subRes.status, body: subBody },
      event: { status: evtRes.status, body: evtBody },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}