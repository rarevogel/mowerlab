#!/bin/sh
# Bouwt MowerLab.apk zonder Gradle: aapt2 -> javac -> dx -> zipalign -> apksigner.
# Nodig: android.jar (platform 23 of hoger), aapt2, dalvik-exchange (dx) of d8, zipalign, apksigner, JDK.
# Gebruik: KEYSTORE_FILE=... KEYSTORE_PASSWORD=... KEY_ALIAS=... ./build.sh
set -e
cd "$(dirname "$0")"
python3 ../build.py                          # zet de pagina als assets/index.html
SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
B=build
rm -rf $B && mkdir -p $B/classes $B/gen $B/dex
aapt2 compile --dir res -o $B/res.zip
aapt2 link -I "$SDK" --manifest AndroidManifest.xml -A assets --java $B/gen \
    --min-sdk-version 24 --target-sdk-version 35 --version-code 2 --version-name 1.1 \
    -o $B/unsigned.apk $B/res.zip
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$SDK" -Xlint:-options -d $B/classes \
    $(find src -name "*.java") $B/gen/nl/rarevogel/mowerlab/R.java
dalvik-exchange --dex --min-sdk-version=24 --output=$B/dex/classes.dex $B/classes
(cd $B/dex && zip -q ../unsigned.apk classes.dex)
zipalign -f -p 4 $B/unsigned.apk $B/aligned.apk
apksigner sign --ks "$KEYSTORE_FILE" --ks-pass env:KEYSTORE_PASSWORD --ks-key-alias "$KEY_ALIAS" \
    --key-pass env:KEYSTORE_PASSWORD --out MowerLab.apk $B/aligned.apk
apksigner verify MowerLab.apk && ls -la MowerLab.apk
