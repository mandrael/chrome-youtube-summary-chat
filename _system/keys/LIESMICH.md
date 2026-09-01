# Extension-Signaturschlüssel

`extension-signing.pem` ist der private Schlüssel zum öffentlichen Schlüssel im
`key`-Feld des full-Manifests (siehe `extension/wxt.config.ts`). Er nagelt die
Extension-ID auf `abblpkhijcggklokijkhfbkgeljmimpm` fest.

**Nicht ins Repo** – `.gitignore` schliesst `*.pem` aus.

Gebraucht wird er nur, wenn einmal ein `.crx` selbst gepackt werden soll. Für den
unpacked-Build und für den Chrome Web Store ist er nicht nötig: dort reicht der
öffentliche Schlüssel im Manifest bzw. signiert Google selbst.

Geht er verloren, lässt sich ein neues Paar erzeugen – dann ändert sich aber die
Extension-ID, und jede Native-Messaging-Registrierung muss neu geschrieben werden.
