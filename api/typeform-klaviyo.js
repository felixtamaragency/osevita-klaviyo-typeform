export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const payload = req.body;
    const KLAVIYO_API_KEY = process.env.KLAVIYO_PRIVATE_KEY;
    const LIST_ID = "VeeVZ3";

    const formResponse = payload.form_response;
    const resultsUrl = formResponse?.response_url;
    const formId = formResponse?.form_id;
    const responseId = formResponse?.token;

    const urlParams = new URL(resultsUrl).searchParams;
    const qui = urlParams.get("qui") || "";

    const answers = formResponse?.answers || [];
    const email = answers.find(a => a.type === "email")?.email;
    const firstName = answers.find(a => a.type === "text" || a.type === "short_text")?.text;

    console.log("Email trouvé:", email);
    console.log("Prénom trouvé:", firstName);

    if (!email) {
      return res.status(400).json({ error: "No email found", answers });
    }

    // Abonner à la liste
    const subRes = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        "revision": "2024-02-15",
      },
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
                      email: {
                        marketing: {
                          consent: "SUBSCRIBED"
                        }
                      }
                    }
                  }
                }
              ]
            }
          },
          relationships: {
            list: {
              data: {
                type: "list",
                id: LIST_ID
              }
            }
          }
        }
      })
    });

    const subText = await subRes.text();
    console.log("Klaviyo subscribe status:", subRes.status);
    console.log("Klaviyo subscribe response:", subText);

    // Envoyer l'event
    const eventRes = await fetch("https://a.klaviyo.com/api/events/", {
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
                attributes: {
                  email,
                  first_name: firstName || "",
                }
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
              first_name: firstName || "",
              qui: qui,
              form_id: formId,
              response_id: responseId,
            }
          }
        }
      })
    });

    console.log("Klaviyo event status:", eventRes.status);

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.log("Erreur:", err.message);
    return res.status(500).json({ error: err.message });
  }
}