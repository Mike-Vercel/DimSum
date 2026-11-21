# Private reference material

`REFERENCE/` (any letter case) contains sensitive originals. Never add it to Git,
force-add it, push it, upload it, include it in a deployment/build/archive, expose it
through an HTTP route, or copy its documents into public assets. Read it locally only.
Keep temporary conversions and extracted document text inside this ignored folder.
Only explicitly approved public derivatives may leave it: the restaurant mascot,
transcribed menu data, and necessary company details. Never publish personal identity
or contact details belonging to individuals found in the source documents.
Run `npm run check:private` before packaging, committing or deployment.

The application accepts cash or physical POS payment on delivery/pickup. Do not
reactivate online/Stripe checkout without an explicit new request from the owner.
