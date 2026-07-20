export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;
  const LIST_ID = "VeeVZ3";
  const REVISION = "2025-04-15";
  const QUI_FIELD_ID = "sut2mr1eGqSe"; // field "Cette recommandation est pour…"

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
    const answers = formResponse?.answers || [];

    // Email
    const email = answers.find(a => a.type === "email")?.email;

    // Prénom
    const firstName =
      answers.find(a => a.type === "text" || a.type === "short_text")?.text || "";

    // qui
    let qui = "";
    const quiAnswer = answers.find(a => a.field?.id === QUI_FIELD_ID);
    const quiLabel = quiAnswer?.choice?.label?.toLowerCase() || "";
    if (quiLabel.includes("enfant")) qui = "enfant";
    else if (quiLabel.includes("adulte")) qui = "adulte";

    // URL de résultats complète (avec reco + complements)
    // 1. On retrouve l'ending atteint
    const reachedEndingId = formResponse?.ending?.id;
    const endings = formResponse?.definition?.endings || [];
    const ending = endings.find(e => e.id === reachedEndingId);
    let resultsPageUrl =
      ending?.properties?.redirect_url || ending?.title || "";

    // 2. On remplace les {{field:REF}} par les vraies réponses
    if (resultsPageUrl) {
      resultsPageUrl = resultsPageUrl.replace(
        /\{\{\s*field:([^}]+?)\s*\}\}/g,
        (match, ref) => {
          const a = answers.find(x => x.field?.ref === ref.trim());
          const val =
            a?.text || a?.email || a?.choice?.label || "";
          return encodeURIComponent(val);
        }
      );
    }

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
    console.log("SUBSCRIPTION", subRes.status, await subRes.text());

    // 2. Attendre le traitement de l'abonnement
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
              results_page_url: resultsPageUrl,
              first_name: firstName,
              qui,
              form_id: formId,
              response_id: responseId,
            },
          },
        },
      }),
    });
    console.log("EVENT", evtRes.status, await evtRes.text());

    return res.status(200).json({ ok: true, qui, firstName, resultsPageUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}