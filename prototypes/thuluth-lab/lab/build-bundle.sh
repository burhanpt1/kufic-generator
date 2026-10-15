#!/bin/sh
# Concatenate the lab engine into one script, in dependency order (files share globals).
# style.js (the 15-parameter style layer) and fit.js (the photo fitter) are optional extras.
cd "$(dirname "$0")"
cat engine3.js tarkib.js roundel.js ring.js marks2.js iznik.js counters.js multigrid.js fitted.js learned.js bowl.js > thuluth-lab.bundle.js
cat thuluth-lab.bundle.js style.js fit.js > thuluth-lab.tools.bundle.js
echo "wrote thuluth-lab.bundle.js and thuluth-lab.tools.bundle.js"
