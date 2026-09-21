#!/usr/bin/env bash
# Kimis zwei Blindstellen in shared/scripts/check.sh nachstellen: Browser-Code hinter
# einer URL in derselben Zeile, und ein wxt-Import mit einfachen Anführungszeichen.
# Erwartet: Test 1 schlägt an. Die Sonde wird in jedem Fall wieder entfernt.
set -uo pipefail
cd "$(dirname "$0")/../../.."
SONDE=shared/src/lib/zz_sonde.ts
trap 'rm -f "$SONDE"' EXIT
cat > "$SONDE" <<'EOF'
export const u = "https://openrouter.ai"; export const leck = () => window.fetch(u);
import { storage } from 'wxt/utils/storage';
EOF
bash shared/scripts/check.sh | sed -n '/== 1\./,/== 2\./p'
