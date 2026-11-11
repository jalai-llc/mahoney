// Site settings — the one file to edit when an account or link changes.
window.SITE_CONFIG = {
  // Cal.com: the part after cal.com/ in the booking links.
  calUsername: "terrymahoneyauthor",

  // Cal.com event slugs (cal.com/<username>/<slug>), keyed by booking tab.
  calEvents: {
    podcast: "podcast",
    speaking: "speaking",
    greet: "greet",
  },

  // Email sign-up ("Get the first chapter") — Kit form "Website signup".
  // Kit shows its own confirmation page after submit. Set `action` to "" to disable.
  emailSignup: {
    action: "https://app.kit.com/forms/10138863/subscriptions",
    fieldName: "email_address",
    extraFields: { "fields[source]": "website" },
  },

  // YouTube links for the 8 clips (paste the full link or just the ID).
  // A clip with no link is hidden; with none, the whole Clips section is hidden.
  youtube: {
    "dads-phone-call": "",      // Drive: Dad's_shocking phone call.mp4
    "ferry-panic": "",          // Drive: Panic_attack on ferry after tsunami.mp4
    "parental-love-sports": "", // Drive: Pressure of parental love in sports.mp4
    "the-look": "",             // Drive: The_look that changed everything.mp4
    "the-perfect-kiss": "",     // Drive: the_perfect kiss.mp4
    "for-skeptics": "",         // Drive: Religious book for skeptics.mp4
    "joy-of-writing": "",       // Drive: Joy of writing process.mp4
    "never-ending": "",         // Drive: the_never-ending book journey.mp4
  },

  // Shown in the booking section as "Prefer email?" — hidden while empty.
  // e.g. "terry@terrymahoneyauthor.com" once forwarding is tested.
  contactEmail: "",
};
